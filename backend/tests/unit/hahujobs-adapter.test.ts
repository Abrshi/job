import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { hahuJobsAdapter, HahuJobsAdapter } from '../../src/modules/sources/adapters/hahujobs.adapter';
import { generateJobFingerprint, normalizeUrl } from '../../src/modules/sources/adapters/fingerprint.util';
import { JobSource } from '@prisma/client';
import { AppError } from '../../src/middleware/error-handler';

describe('HahuJobsAdapter Unit Tests', () => {
  const dummySource: JobSource = {
    id: 'src-hahu-001',
    name: 'HaHuJobs',
    slug: 'hahujobs',
    type: 'API',
    endpointUrl: 'https://graph.aggregator.hahu.jobs/v1/graphql',
    isActive: true,
    pollingInterval: 120,
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    headers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('normalizes raw job posting fields from fixture correctly', () => {
    const fixturePath = path.join(__dirname, '../fixtures/hahujobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const firstJob = rawFixture.data.search_jobs[0];

    const normalized = hahuJobsAdapter.normalize(
      {
        externalId: firstJob.id,
        originalUrl: firstJob.url,
        applicationUrl: firstJob.application_email ? `mailto:${firstJob.application_email}` : null,
        title: firstJob.title,
        description: firstJob.description,
        companyName: firstJob.entity?.name,
        country: 'Ethiopia',
        city: firstJob.job_cities?.[0]?.city?.name,
        isRemote: false,
        workArrangement: 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'JUNIOR',
        salaryMin: firstJob.salary,
        salaryMax: firstJob.salary,
        salaryCurrency: firstJob.salary_currency,
        salaryPeriod: 'MONTHLY',
        publishedAt: new Date(firstJob.posted_on),
        closingDate: new Date(firstJob.deadline),
        rawPayload: firstJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.sourceId, 'src-hahu-001');
    assert.strictEqual(normalized.externalId, '6ac4b91bbd1ef03672614d3e');
    assert.strictEqual(normalized.fingerprint, 'ext:6ac4b91bbd1ef03672614d3e');
    assert.strictEqual(normalized.normalizedTitle, 'SALES REPRESENTATIVE');
    assert.ok(!normalized.normalizedDescription.includes('<p>'));
    assert.ok(normalized.normalizedDescription.includes('INFINX Ethiopia is looking for a motivated'));
    assert.strictEqual(normalized.companyName, 'Transsion Manufacturing PLC');
    assert.strictEqual(normalized.city, 'Addis Ababa');
    assert.strictEqual(normalized.country, 'Ethiopia');
    assert.strictEqual(normalized.employmentType, 'FULL_TIME');
    assert.strictEqual(normalized.experienceLevel, 'JUNIOR');
    assert.strictEqual(normalized.salaryMin, 18000);
    assert.strictEqual(normalized.salaryMax, 18000);
    assert.strictEqual(normalized.salaryCurrency, 'ETB');
    assert.strictEqual(normalized.salaryPeriod, 'MONTHLY');
    assert.strictEqual(normalized.applicationUrl, 'mailto:transsionmanufacturinghr@gmail.com');
  });

  it('correctly maps remote work and online application URLs', () => {
    const fixturePath = path.join(__dirname, '../fixtures/hahujobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const techJob = rawFixture.data.search_jobs[1];

    const normalized = hahuJobsAdapter.normalize(
      {
        externalId: techJob.id,
        originalUrl: techJob.url,
        applicationUrl: techJob.application_url,
        title: techJob.title,
        description: techJob.description,
        companyName: techJob.entity?.name,
        country: 'Ethiopia',
        city: null,
        isRemote: true,
        workArrangement: 'REMOTE',
        employmentType: 'CONTRACT',
        experienceLevel: 'SENIOR',
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: 'MONTHLY',
        publishedAt: new Date(techJob.posted_on),
        closingDate: new Date(techJob.deadline),
        rawPayload: techJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.externalId, '6ad53368e0864b7a27406df3');
    assert.strictEqual(normalized.isRemote, true);
    assert.strictEqual(normalized.workArrangement, 'REMOTE');
    assert.strictEqual(normalized.employmentType, 'CONTRACT');
    assert.strictEqual(normalized.experienceLevel, 'SENIOR');
    assert.strictEqual(normalized.applicationUrl, 'https://usacademy.edu.et/careers/apply/arch-01');
  });

  it('handles in-person application with null applicationUrl without fabricating one', () => {
    const fixturePath = path.join(__dirname, '../fixtures/hahujobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const inPersonJob = rawFixture.data.search_jobs[2];

    const normalized = hahuJobsAdapter.normalize(
      {
        externalId: inPersonJob.id,
        originalUrl: inPersonJob.url,
        applicationUrl: null,
        title: inPersonJob.title,
        description: inPersonJob.description,
        companyName: inPersonJob.company?.name,
        country: 'Ethiopia',
        city: inPersonJob.location,
        isRemote: false,
        workArrangement: 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'MID',
        salaryMin: inPersonJob.salary,
        salaryMax: inPersonJob.salary,
        salaryCurrency: inPersonJob.salary_currency,
        salaryPeriod: 'MONTHLY',
        publishedAt: new Date(inPersonJob.posted_on),
        closingDate: new Date(inPersonJob.deadline),
        rawPayload: inPersonJob,
      },
      dummySource
    );

    assert.strictEqual(normalized.companyName, 'Welkite Cooperative Union');
    assert.strictEqual(normalized.city, 'Welkite');
    assert.strictEqual(normalized.applicationUrl, null);
    assert.strictEqual(normalized.originalUrl, 'https://ethiopianreporterjobs.com/jobs/welkite-accountant');
  });

  it('handles successful fetchJobs with mocked GraphQL response and pagination', async () => {
    const originalFetch = global.fetch;
    const fixturePath = path.join(__dirname, '../fixtures/hahujobs-jobs.json');
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => rawFixture,
          text: async () => JSON.stringify(rawFixture),
        } as unknown as Response;
      };

      const result = await hahuJobsAdapter.fetchJobs(dummySource, { limit: 3, checkpoint: 0 });
      assert.strictEqual(result.recordsFetched, 3);
      assert.strictEqual(result.hasMore, true);
      assert.strictEqual(result.checkpoint, 3);
      assert.strictEqual(result.jobs[0].externalId, '6ac4b91bbd1ef03672614d3e');
      assert.strictEqual(result.jobs[1].externalId, '6ad53368e0864b7a27406df3');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('filters out jobs flagged as requested_to_delete', async () => {
    const originalFetch = global.fetch;
    const mockData = {
      data: {
        search_jobs: [
          {
            id: 'job-active-1',
            title: 'Active Job',
            requested_to_delete: false,
            expired: false,
          },
          {
            id: 'job-deleted-2',
            title: 'Deleted Job',
            requested_to_delete: true,
            expired: false,
          },
        ],
      },
    };

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => mockData,
        } as unknown as Response;
      };

      const result = await hahuJobsAdapter.fetchJobs(dummySource, { limit: 10 });
      assert.strictEqual(result.recordsFetched, 1);
      assert.strictEqual(result.jobs[0].externalId, 'job-active-1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles GraphQL error responses gracefully', async () => {
    const originalFetch = global.fetch;

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            errors: [{ message: 'Field "invalid_field" not found on type "jobs"' }],
          }),
        } as unknown as Response;
      };

      await assert.rejects(
        async () => hahuJobsAdapter.fetchJobs(dummySource),
        (err: any) => {
          assert.strictEqual(err.code, 'SOURCE_GRAPHQL_ERROR');
          assert.ok(err.message.includes('Field "invalid_field" not found'));
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles HTTP 401/403 access control errors', async () => {
    const originalFetch = global.fetch;

    try {
      global.fetch = async () => {
        return {
          ok: false,
          status: 403,
          text: async () => 'Forbidden: API key or Origin required',
        } as unknown as Response;
      };

      await assert.rejects(
        async () => hahuJobsAdapter.fetchJobs(dummySource),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SOURCE_AUTH_REQUIRED');
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles empty results and marks hasMore = false', async () => {
    const originalFetch = global.fetch;

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              search_jobs: [],
            },
          }),
        } as unknown as Response;
      };

      const result = await hahuJobsAdapter.fetchJobs(dummySource, { limit: 54, checkpoint: 200 });
      assert.strictEqual(result.recordsFetched, 0);
      assert.strictEqual(result.hasMore, false);
      assert.strictEqual(result.checkpoint, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
