import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateSafeUrl,
  isPrivateOrReservedIP,
  createSourceSchema,
  updateSourceSchema,
} from '../../src/modules/sources/sources.validation';

describe('SSRF Mitigation and URL Validation', () => {
  it('identifies private, loopback, and metadata IP addresses', () => {
    assert.strictEqual(isPrivateOrReservedIP('localhost'), true);
    assert.strictEqual(isPrivateOrReservedIP('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIP('127.1.2.3'), true);
    assert.strictEqual(isPrivateOrReservedIP('10.0.0.5'), true);
    assert.strictEqual(isPrivateOrReservedIP('172.16.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIP('172.31.255.255'), true);
    assert.strictEqual(isPrivateOrReservedIP('192.168.1.100'), true);
    assert.strictEqual(isPrivateOrReservedIP('169.254.169.254'), true); // AWS/GCP metadata
    assert.strictEqual(isPrivateOrReservedIP('::1'), true);

    // Public IPs should not be marked as private
    assert.strictEqual(isPrivateOrReservedIP('8.8.8.8'), false);
    assert.strictEqual(isPrivateOrReservedIP('1.1.1.1'), false);
  });

  it('rejects URLs targeting internal services and metadata servers', () => {
    assert.strictEqual(validateSafeUrl('http://localhost:8080/api'), false);
    assert.strictEqual(validateSafeUrl('http://127.0.0.1:3306'), false);
    assert.strictEqual(validateSafeUrl('http://169.254.169.254/latest/meta-data'), false);
    assert.strictEqual(validateSafeUrl('http://metadata.google.internal/computeMetadata/v1/'), false);
    assert.strictEqual(validateSafeUrl('ftp://example.com/feed'), false); // non-HTTP/HTTPS
    assert.strictEqual(validateSafeUrl('not-a-valid-url'), false);
  });

  it('permits valid public HTTP and HTTPS endpoints', () => {
    assert.strictEqual(validateSafeUrl('https://api.afriworket.com/v1/graphql'), true);
    assert.strictEqual(validateSafeUrl('https://example.com/rss/jobs.xml'), true);
    assert.strictEqual(validateSafeUrl('https://careers.google.com/api/jobs'), true);
  });
});

describe('Source Configuration Validation Schemas', () => {
  it('validates valid createSource input', async () => {
    const validData = {
      body: {
        name: 'LinkedIn Jobs',
        slug: 'linkedin-jobs',
        type: 'API',
        endpointUrl: 'https://api.linkedin.com/v2/jobs',
        isActive: true,
        pollingInterval: 30,
      },
    };

    const parsed = await createSourceSchema.parseAsync(validData);
    assert.strictEqual(parsed.body.name, 'LinkedIn Jobs');
    assert.strictEqual(parsed.body.slug, 'linkedin-jobs');
    assert.strictEqual(parsed.body.pollingInterval, 30);
  });

  it('rejects invalid polling intervals and SSRF target in createSource', async () => {
    const invalidData = {
      body: {
        name: 'Bad Source',
        slug: 'bad-source',
        type: 'API',
        endpointUrl: 'http://127.0.0.1:5000/internal',
        pollingInterval: 2, // minimum is 5 minutes
      },
    };

    await assert.rejects(
      async () => createSourceSchema.parseAsync(invalidData),
      (err: any) => {
        const issues = err.issues || [];
        const intervalIssue = issues.find((i: any) => i.path.includes('pollingInterval'));
        const urlIssue = issues.find((i: any) => i.path.includes('endpointUrl'));
        assert.ok(intervalIssue, 'Expected error on pollingInterval < 5');
        assert.ok(urlIssue, 'Expected error on SSRF URL');
        return true;
      }
    );
  });

  it('validates partial updateSource input', async () => {
    const validUpdate = {
      body: {
        pollingInterval: 120,
        isActive: false,
      },
    };

    const parsed = await updateSourceSchema.parseAsync(validUpdate);
    assert.strictEqual(parsed.body.pollingInterval, 120);
    assert.strictEqual(parsed.body.isActive, false);
  });
});
