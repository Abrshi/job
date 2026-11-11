import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { ethioJobsAdapter, EthioJobsAdapter } from '../../src/modules/sources/adapters/ethiojobs.adapter';
import { adapterRegistry } from '../../src/modules/sources/adapters/adapter.registry';
import { generateJobFingerprint, normalizeUrl } from '../../src/modules/sources/adapters/fingerprint.util';
import { JobSource } from '@prisma/client';
import { AppError } from '../../src/middleware/error-handler';

describe('EthioJobsAdapter Unit Tests', () => {
  const dummySource: JobSource = {
    id: 'src-ethio-001',
    name: 'Ethiojobs',
    slug: 'ethiojobs',
    type: 'API',
    endpointUrl: 'https://ethiojobs.net',
    isActive: true,
    pollingInterval: 120,
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    headers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('is registered in AdapterRegistry with slug ethiojobs', () => {
    assert.strictEqual(adapterRegistry.has('ethiojobs'), true);
    const resolved = adapterRegistry.get('ethiojobs');
    assert.strictEqual(resolved.slug, 'ethiojobs');
    assert.strictEqual(resolved.name, 'Ethiojobs');
  });

  it('normalizes raw job posting fields from fixture correctly', () => {
    const fixturePath = path.join(__dirname, '../fixtures/ethiojobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const firstJob = rawFixture.pageProps.jobs.data[0];

    const normalized = ethioJobsAdapter.normalize(
      {
        externalId: firstJob.id,
        originalUrl: `https://ethiojobs.net/jobs/${firstJob.slug}`,
        applicationUrl: `mailto:${firstJob.application_email}`,
        title: firstJob.title,
        description: firstJob.description,
        companyName: firstJob.company?.name,
        country: 'Ethiopia',
        city: firstJob.state,
        isRemote: true,
        workArrangement: 'REMOTE',
        employmentType: 'CONTRACT',
        experienceLevel: 'ENTRY',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        publishedAt: new Date(firstJob.date_published),
        closingDate: new Date(firstJob.date_expiry),
        rawPayload: firstJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.sourceId, 'src-ethio-001');
    assert.strictEqual(normalized.externalId, firstJob.id);
    assert.strictEqual(normalized.fingerprint, `ext:${firstJob.id}`);
    assert.strictEqual(
      normalized.normalizedTitle,
      'RFP: Desk Review of Policy and Regulatory Frameworks Relevant to IRIF and Digital Climate-Smart Agriculture'
    );
    assert.ok(!normalized.normalizedDescription.includes('<p>'));
    assert.ok(normalized.normalizedDescription.includes('Birrama Digital Commerce PLC invites qualified consultants'));
    assert.strictEqual(normalized.companyName, 'Birrama Digital Commerce PLC');
    assert.strictEqual(normalized.city, 'Addis Ababa');
    assert.strictEqual(normalized.country, 'Ethiopia');
    assert.strictEqual(normalized.isRemote, true);
    assert.strictEqual(normalized.workArrangement, 'REMOTE');
    assert.strictEqual(normalized.employmentType, 'CONTRACT');
    assert.strictEqual(normalized.experienceLevel, 'ENTRY');
    assert.strictEqual(normalized.applicationUrl, 'mailto:bids@irif.world');
  });

  it('correctly maps application form URL and ATS method', () => {
    const fixturePath = path.join(__dirname, '../fixtures/ethiojobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const atsJob = rawFixture.pageProps.jobs.data[1];

    const normalized = ethioJobsAdapter.normalize(
      {
        externalId: atsJob.id,
        originalUrl: `https://ethiojobs.net/jobs/${atsJob.slug}`,
        applicationUrl: atsJob.application_form,
        title: atsJob.title,
        description: atsJob.description,
        companyName: atsJob.company?.name,
        country: 'Ethiopia',
        city: atsJob.state,
        isRemote: false,
        workArrangement: 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'JUNIOR',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        publishedAt: new Date(atsJob.date_published),
        closingDate: new Date(atsJob.date_expiry),
        rawPayload: atsJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.isRemote, false);
    assert.strictEqual(normalized.workArrangement, 'ON_SITE');
    assert.strictEqual(normalized.employmentType, 'FULL_TIME');
    assert.strictEqual(normalized.experienceLevel, 'JUNIOR');
    assert.strictEqual(normalized.applicationUrl, 'https://careers.huawei.com/jobs/apply/eth-network-001');
    assert.strictEqual(
      normalized.originalUrl,
      'https://ethiojobs.net/jobs/kL89mNbq12-core-network-product-technical-engineer'
    );
  });

  it('handles in-person application without inventing a fake applicationUrl', () => {
    const fixturePath = path.join(__dirname, '../fixtures/ethiojobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const inPersonJob = rawFixture.pageProps.jobs.data[3];

    const normalized = ethioJobsAdapter.normalize(
      {
        externalId: inPersonJob.id,
        originalUrl: `https://ethiojobs.net/jobs/${inPersonJob.slug}`,
        applicationUrl: null,
        title: inPersonJob.title,
        description: inPersonJob.description,
        companyName: null,
        country: 'Ethiopia',
        city: 'Hawassa',
        isRemote: false,
        workArrangement: 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'ENTRY',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        publishedAt: new Date(inPersonJob.date_published),
        closingDate: new Date(inPersonJob.date_expiry),
        rawPayload: inPersonJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.companyName, null);
    assert.strictEqual(normalized.city, 'Hawassa');
    assert.strictEqual(normalized.applicationUrl, null);
    assert.ok(normalized.originalUrl.includes('ethiojobs.net/jobs/j98Kl2MnOp-junior-office-assistant'));
  });

  it('handles successful fetchJobs with mocked Next.js page data and pagination metadata', async () => {
    const originalFetch = global.fetch;
    const fixturePath = path.join(__dirname, '../fixtures/ethiojobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    try {
      global.fetch = async (input: RequestInfo | URL) => {
        const urlStr = String(input);
        if (urlStr.includes('/en/jobs.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => rawFixture,
            text: async () => JSON.stringify(rawFixture),
          } as unknown as Response;
        }
        // HTML landing page for buildId
        return {
          ok: true,
          status: 200,
          text: async () => '<html><script id="__NEXT_DATA__">{"buildId":"test-build-123"}</script></html>',
        } as unknown as Response;
      };

      const result = await ethioJobsAdapter.fetchJobs(dummySource, { checkpoint: 1 });
      assert.strictEqual(result.recordsFetched, 5);
      assert.strictEqual(result.hasMore, true);
      assert.strictEqual(result.checkpoint, 2);
      assert.strictEqual(result.jobs[0].title.startsWith('RFP: Desk Review'), true);
      assert.strictEqual(result.jobs[0].workArrangement, 'REMOTE');
      assert.strictEqual(result.jobs[1].workArrangement, 'ON_SITE');
      assert.strictEqual(result.jobs[2].workArrangement, 'HYBRID');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('stops pagination when on lastPage or when empty jobs data returned', async () => {
    const originalFetch = global.fetch;
    const endFixture = {
      pageProps: {
        jobs: {
          meta: {
            pageNumber: 90,
            itemsPerPage: 12,
            lastPage: 90,
            total: 1071,
          },
          data: [
            {
              id: 'job-final-page',
              title: 'Last Page Job',
              slug: 'last-page-job',
              type: 8,
              level: 2,
              location_type: 'Office',
              state: 'Addis Ababa',
              company: { name: 'Final Co' },
            },
          ],
        },
      },
    };

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => endFixture,
        } as unknown as Response;
      };

      const result = await ethioJobsAdapter.fetchJobs(dummySource, { checkpoint: 90 });
      assert.strictEqual(result.recordsFetched, 1);
      assert.strictEqual(result.hasMore, false);
      assert.strictEqual(result.checkpoint, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles HTTP 401/403 access control errors with SOURCE_AUTH_REQUIRED', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/en/jobs.json')) {
          return {
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            text: async () => 'Access forbidden',
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => '{"buildId":"test-build-123"}',
        } as unknown as Response;
      };

      await assert.rejects(
        async () => {
          await ethioJobsAdapter.fetchJobs(dummySource);
        },
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SOURCE_AUTH_REQUIRED');
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles invalid JSON gracefully with SOURCE_INVALID_RESPONSE', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/en/jobs.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new Error('Unexpected token < in JSON at position 0');
            },
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => '{"buildId":"test-build-123"}',
        } as unknown as Response;
      };

      await assert.rejects(
        async () => {
          await ethioJobsAdapter.fetchJobs(dummySource);
        },
        (err: AppError) => {
          assert.strictEqual(err.code, 'SOURCE_INVALID_RESPONSE');
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('recovers from HTTP 404 by invalidating buildId cache and retrying', async () => {
    const originalFetch = global.fetch;
    let callCount = 0;
    const fixturePath = path.join(__dirname, '../fixtures/ethiojobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    try {
      global.fetch = async (input: RequestInfo | URL) => {
        const urlStr = String(input);
        if (urlStr.includes('/en/jobs.json')) {
          callCount++;
          if (callCount === 1) {
            // First call with outdated buildId returns 404
            return {
              ok: false,
              status: 404,
              text: async () => 'Not found',
            } as unknown as Response;
          }
          // Second call after refresh returns 200
          return {
            ok: true,
            status: 200,
            json: async () => rawFixture,
            text: async () => JSON.stringify(rawFixture),
          } as unknown as Response;
        }
        // HTML page for buildId
        return {
          ok: true,
          status: 200,
          text: async () => '<html><script id="__NEXT_DATA__">{"buildId":"refreshed-build-456"}</script></html>',
        } as unknown as Response;
      };

      const result = await ethioJobsAdapter.fetchJobs(dummySource);
      assert.strictEqual(result.recordsFetched, 5);
      assert.strictEqual(callCount, 2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('never logs or leaks sensitive tokens or credentials', async () => {
    const originalFetch = global.fetch;
    const sensitivePayload = {
      pageProps: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitivePayloadData.signature',
        jobs: {
          meta: { pageNumber: 1, lastPage: 1 },
          data: [
            {
              id: 'job-with-token-context',
              title: 'Sample Position',
              slug: 'sample-position',
              type: 8,
              level: 2,
              location_type: 'Office',
              state: 'Addis Ababa',
            },
          ],
        },
      },
    };

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => sensitivePayload,
        } as unknown as Response;
      };

      const result = await ethioJobsAdapter.fetchJobs(dummySource);
      assert.strictEqual(result.recordsFetched, 1);
      const rawJob = result.jobs[0];
      // Verify token is NOT attached to job or rawPayload
      assert.strictEqual((rawJob as any).token, undefined);
      assert.strictEqual((rawJob.rawPayload as any).token, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('generates consistent, stable fingerprints for deduplication across repeated runs', () => {
    const externalId = 'eyJpdiI6IktWV0xqR2dPTlZwazArbS90UzlQVlE9PSIsIm1hYyI6IjEyMyJ9';
    const originalUrl = 'https://ethiojobs.net/jobs/sample-job-slug';

    const fp1 = generateJobFingerprint({
      externalId,
      originalUrl,
      title: 'Senior Software Engineer',
      companyName: 'Tech Co',
    });

    const fp2 = generateJobFingerprint({
      externalId,
      originalUrl,
      title: 'Senior Software Engineer',
      companyName: 'Tech Co',
    });

    assert.strictEqual(fp1, fp2);
    assert.strictEqual(fp1, `ext:${externalId}`);
  });
});
