import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../src/lib/prisma';
import { sourcesService } from '../../src/modules/sources/sources.service';
import { adapterRegistry } from '../../src/modules/sources/adapters/adapter.registry';
import { classificationService } from '../../src/modules/classification/classification.service';
import { jobsRepository } from '../../src/modules/jobs/jobs.repository';
import { JobSource } from '@prisma/client';

describe('HaHuJobs Ingestion Pipeline Integration Tests', () => {
  let hahuSource: JobSource;
  const fixturePath = path.join(__dirname, '../fixtures/hahujobs-jobs.json');
  const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  before(async () => {
    // 1. Ensure HaHuJobs source exists
    let source = await prisma.jobSource.findUnique({
      where: { slug: 'hahujobs' },
    });

    if (!source) {
      source = await prisma.jobSource.create({
        data: {
          name: 'HaHuJobs',
          slug: 'hahujobs',
          type: 'API',
          endpointUrl: 'https://graph.aggregator.hahu.jobs/v1/graphql',
          isActive: false,
          pollingInterval: 120,
        },
      });
    }
    hahuSource = source;

    // 2. Clean up any existing HaHuJobs collection runs and test jobs for isolation
    await prisma.jobClassification.deleteMany({
      where: { job: { sourceId: hahuSource.id } },
    });
    await prisma.savedJob.deleteMany({
      where: { job: { sourceId: hahuSource.id } },
    });
    await prisma.jobNotification.deleteMany({
      where: { jobId: { in: (await prisma.job.findMany({ where: { sourceId: hahuSource.id }, select: { id: true } })).map(j => j.id) } },
    });
    await prisma.job.deleteMany({
      where: { sourceId: hahuSource.id },
    });
    await prisma.collectionRun.deleteMany({
      where: { sourceId: hahuSource.id },
    });
  });

  after(async () => {
    // Clean up test jobs created during integration run
    if (hahuSource) {
      await prisma.jobClassification.deleteMany({
        where: { job: { sourceId: hahuSource.id } },
      });
      await prisma.jobNotification.deleteMany({
        where: { jobId: { in: (await prisma.job.findMany({ where: { sourceId: hahuSource.id }, select: { id: true } })).map(j => j.id) } },
      });
      await prisma.job.deleteMany({
        where: { sourceId: hahuSource.id },
      });
      await prisma.collectionRun.deleteMany({
        where: { sourceId: hahuSource.id },
      });
    }
    await prisma.$disconnect();
  });

  it('registers hahujobs adapter in AdapterRegistry', () => {
    assert.strictEqual(adapterRegistry.has('hahujobs'), true);
    const adapter = adapterRegistry.get('hahujobs');
    assert.strictEqual(adapter.slug, 'hahujobs');
    assert.strictEqual(adapter.name, 'HaHuJobs');
  });

  it('executes a collection run and stores normalized HaHuJobs jobs', async () => {
    const originalFetch = global.fetch;

    try {
      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => fixtureData,
          text: async () => JSON.stringify(fixtureData),
        } as unknown as Response;
      };

      const run = await sourcesService.runCollection(hahuSource.id);

      assert.strictEqual(run.status, 'SUCCESS');
      assert.strictEqual(run.recordsFetched, 3);
      assert.strictEqual(run.jobsCreated, 3);
      assert.strictEqual(run.jobsUpdated, 0);

      // Verify jobs in database
      const storedJobs = await prisma.job.findMany({
        where: { sourceId: hahuSource.id },
        orderBy: { externalId: 'asc' },
      });

      assert.strictEqual(storedJobs.length, 3);

      const salesJob = storedJobs.find((j) => j.externalId === '6ac4b91bbd1ef03672614d3e');
      assert.ok(salesJob);
      assert.strictEqual(salesJob.companyName, 'Transsion Manufacturing PLC');
      assert.strictEqual(salesJob.city, 'Addis Ababa');
      assert.strictEqual(salesJob.employmentType, 'FULL_TIME');
      assert.strictEqual(salesJob.fingerprint, 'ext:6ac4b91bbd1ef03672614d3e');
      assert.strictEqual(salesJob.classificationStatus, 'PENDING');
      assert.strictEqual(salesJob.status, 'ACTIVE');

      const techJob = storedJobs.find((j) => j.externalId === '6ad53368e0864b7a27406df3');
      assert.ok(techJob);
      assert.strictEqual(techJob.companyName, 'US Academy');
      assert.strictEqual(techJob.workArrangement, 'REMOTE');
      assert.strictEqual(techJob.employmentType, 'CONTRACT');
      assert.strictEqual(techJob.applicationUrl, 'https://usacademy.edu.et/careers/apply/arch-01');

      const financeJob = storedJobs.find((j) => j.externalId === '6abdf6ffe62c041b369ddb8c');
      assert.ok(financeJob);
      assert.strictEqual(financeJob.companyName, 'Welkite Cooperative Union');
      assert.strictEqual(financeJob.city, 'Welkite');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('safely handles repeated synchronization without generating duplicate jobs', async () => {
    const originalFetch = global.fetch;

    try {
      // Modify description of second job in repeat mock to test update
      const updatedFixture = JSON.parse(JSON.stringify(fixtureData));
      updatedFixture.data.search_jobs[0].description = '<p>Updated description for Sales Representative position.</p>';

      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => updatedFixture,
          text: async () => JSON.stringify(updatedFixture),
        } as unknown as Response;
      };

      const run = await sourcesService.runCollection(hahuSource.id);

      assert.strictEqual(run.status, 'SUCCESS');
      assert.strictEqual(run.jobsCreated, 0, 'No duplicate jobs should be created');
      assert.strictEqual(run.jobsUpdated, 3, 'All 3 existing jobs should be updated');

      // Total count in database remains exactly 3
      const count = await prisma.job.count({ where: { sourceId: hahuSource.id } });
      assert.strictEqual(count, 3);

      // Verify updated content
      const updated = await prisma.job.findFirst({
        where: { sourceId: hahuSource.id, externalId: '6ac4b91bbd1ef03672614d3e' },
      });
      assert.ok(updated?.normalizedDescription.includes('Updated description for Sales Representative'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('prevents overlapping synchronization runs for the same source', async () => {
    // Manually create a run in RUNNING status
    const activeRun = await prisma.collectionRun.create({
      data: {
        sourceId: hahuSource.id,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      await assert.rejects(
        async () => sourcesService.runCollection(hahuSource.id),
        (err: any) => {
          assert.strictEqual(err.code, 'SOURCE_RUN_IN_PROGRESS');
          return true;
        }
      );
    } finally {
      await prisma.collectionRun.delete({ where: { id: activeRun.id } });
    }
  });

  it('integrates imported HaHuJobs jobs into the AI classification pipeline', async () => {
    // There are 3 jobs currently with classificationStatus PENDING
    const pendingBefore = await jobsRepository.getPendingClassificationJobs(10);
    const hahuPending = pendingBefore.filter((j) => j.sourceId === hahuSource.id);
    assert.strictEqual(hahuPending.length, 3);

    // Run classification
    const result = await classificationService.processPendingJobs(10);
    assert.ok(result.succeeded >= 3, `Expected at least 3 jobs classified, got ${result.succeeded}`);

    // Verify all HaHuJobs jobs were classified
    const classifiedHahuJobs = await prisma.job.findMany({
      where: { sourceId: hahuSource.id },
      include: { category: true, classifications: true },
    });

    for (const job of classifiedHahuJobs) {
      assert.notStrictEqual(job.classificationStatus, 'PENDING');
      assert.ok(job.categoryId, `Job ${job.normalizedTitle} should have an assigned category`);
      assert.ok(job.category?.slug, 'Category should resolve to a valid category slug');
      assert.ok(job.classifications.length > 0, 'Should have an audit log entry');
    }
  });

  it('correctly applies expiration policies to HaHuJobs jobs with elapsed deadlines', async () => {
    // Mark one job with a past closingDate
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.job.updateMany({
      where: { sourceId: hahuSource.id, externalId: '6ac4b91bbd1ef03672614d3e' },
      data: { closingDate: pastDate, status: 'ACTIVE' },
    });

    await jobsRepository.applyExpirationPolicies();

    const expiredJob = await prisma.job.findFirst({
      where: { sourceId: hahuSource.id, externalId: '6ac4b91bbd1ef03672614d3e' },
    });

    assert.strictEqual(expiredJob?.status, 'EXPIRED');
    assert.ok(expiredJob?.expiredAt);
  });
});
