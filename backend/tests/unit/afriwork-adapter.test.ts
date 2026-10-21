import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { afriworkAdapter } from '../../src/modules/sources/adapters/afriwork.adapter';
import { generateJobFingerprint, normalizeUrl } from '../../src/modules/sources/adapters/fingerprint.util';
import { JobSource } from '@prisma/client';
import { AppError } from '../../src/middleware/error-handler';

describe('AfriworkAdapter Normalization', () => {
  const dummySource: JobSource = {
    id: 'src-afriwork-001',
    name: 'Afriwork',
    slug: 'afriwork',
    type: 'API',
    endpointUrl: 'https://api.afriworket.com/v1/graphql',
    isActive: true,
    pollingInterval: 60,
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    headers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('normalizes raw job posting fields correctly', () => {
    const rawJob = {
      externalId: 'job-9988',
      originalUrl: 'https://afriworket.com/jobs/job-9988?utm_source=telegram',
      applicationUrl: 'https://company.example.com/apply?ref=afriwork',
      title: '  <b>Senior Backend Engineer</b>  ',
      description: '<p>Looking for a talented <strong>Senior Backend Engineer</strong> with 5+ years experience.</p>',
      companyName: ' Fintech Ethiopia ',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      isRemote: true,
      employmentType: 'FULL_TIME' as const,
      experienceLevel: 'SENIOR' as const,
      salaryMin: 50000,
      salaryMax: 70000,
      salaryCurrency: 'ETB',
      salaryPeriod: 'MONTHLY' as const,
      publishedAt: new Date('2026-10-15T08:00:00Z'),
      closingDate: new Date('2026-11-15T23:59:59Z'),
      rawPayload: { test: true },
    };

    const normalized = afriworkAdapter.normalize(rawJob, dummySource);

    assert.strictEqual(normalized.sourceId, 'src-afriwork-001');
    assert.strictEqual(normalized.externalId, 'job-9988');
    assert.strictEqual(normalized.fingerprint, 'ext:job-9988');
    assert.strictEqual(normalized.normalizedTitle, 'Senior Backend Engineer');
    assert.strictEqual(
      normalized.normalizedDescription,
      'Looking for a talented Senior Backend Engineer with 5+ years experience.'
    );
    assert.strictEqual(normalized.companyName, 'Fintech Ethiopia');
    assert.strictEqual(normalized.isRemote, true);
    assert.strictEqual(normalized.workArrangement, 'REMOTE');
    assert.strictEqual(normalized.employmentType, 'FULL_TIME');
    assert.strictEqual(normalized.experienceLevel, 'SENIOR');
    assert.strictEqual(normalized.salaryMin, 50000);
    assert.strictEqual(normalized.salaryMax, 70000);
    // URL tracking params should be stripped
    assert.strictEqual(normalized.originalUrl, 'https://afriworket.com/jobs/job-9988');
    assert.strictEqual(normalized.applicationUrl, 'https://company.example.com/apply');
  });

  it('generates fingerprint with stable priorities (externalId > URL > content)', () => {
    // 1. External ID present
    const fp1 = generateJobFingerprint({
      externalId: 'ext-abc-123',
      originalUrl: 'https://example.com/job/1',
      title: 'Dev',
    });
    assert.strictEqual(fp1, 'ext:ext-abc-123');

    // 2. External ID missing, URL present
    const fp2 = generateJobFingerprint({
      externalId: null,
      originalUrl: 'https://example.com/jobs/software-engineer?utm_campaign=feed',
      title: 'Software Engineer',
    });
    assert.ok(fp2.startsWith('url:'));

    // 3. Both missing, content fallback
    const fp3 = generateJobFingerprint({
      externalId: null,
      originalUrl: null,
      title: 'Data Analyst',
      companyName: 'Bank of Abyssinia',
      descriptionSnippet: 'Analyze big financial datasets using Python and SQL.',
    });
    assert.ok(fp3.startsWith('content:'));
  });

  it('parses fixture data from offline test JSON', () => {
    const fixturePath = path.join(__dirname, '../fixtures/afriwork-jobs.json');
    const rawData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const jobsList = rawData.data.jobs;

    assert.strictEqual(jobsList.length, 3);

    const firstJob = jobsList[0];
    const normalized = afriworkAdapter.normalize(
      {
        externalId: firstJob.id,
        originalUrl: `https://afriworket.com/jobs/${firstJob.id}`,
        applicationUrl: firstJob.application_url,
        title: firstJob.title,
        description: firstJob.description,
        companyName: firstJob.company?.name,
        country: firstJob.country,
        city: firstJob.city,
        isRemote: firstJob.is_remote,
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        salaryMin: firstJob.min_salary,
        salaryMax: firstJob.max_salary,
        salaryCurrency: firstJob.salary_currency,
        salaryPeriod: 'MONTHLY',
        publishedAt: firstJob.created_at,
        closingDate: firstJob.deadline,
        rawPayload: firstJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.externalId, 'afriwork-job-001');
    assert.strictEqual(normalized.normalizedTitle, 'Senior Full Stack TypeScript Developer');
    assert.strictEqual(normalized.companyName, 'Addis Tech Innovations');
    assert.strictEqual(normalized.experienceLevel, 'SENIOR');
    assert.strictEqual(normalized.salaryMin, 45000);
    assert.strictEqual(normalized.salaryMax, 65000);
  });

  it('detects authentication hook requirement and throws SOURCE_AUTH_REQUIRED', async () => {
    const originalFetch = global.fetch;
    // Mock response simulating Afriwork GraphQL unauthorized webhook response
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Authentication hook unauthorized this request',
              extensions: { path: '$', code: 'access-denied' },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    try {
      await assert.rejects(
        async () => afriworkAdapter.fetchJobs(dummySource),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'SOURCE_AUTH_REQUIRED');
          assert.match(err.message, /requires authentication/i);
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
