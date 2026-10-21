import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/lib/prisma';
import { jobsRepository } from '../../src/modules/jobs/jobs.repository';
import { sourcesService } from '../../src/modules/sources/sources.service';
import { classificationService } from '../../src/modules/classification/classification.service';
import { AppError } from '../../src/middleware/error-handler';
import { JobSource } from '@prisma/client';

describe('Jobs Pipeline and Deduplication Integration', () => {
  let testSource: JobSource;

  before(async () => {
    // Ensure test source exists
    const existing = await prisma.jobSource.findUnique({ where: { slug: 'test-source' } });
    if (existing) {
      testSource = existing;
    } else {
      testSource = await prisma.jobSource.create({
        data: {
          name: 'Test Source',
          slug: 'test-source',
          endpointUrl: 'https://example.com/api',
          pollingInterval: 60,
          isActive: true,
        },
      });
    }

    // Clean up test jobs for testSource to ensure test isolation
    await prisma.jobClassification.deleteMany({
      where: { job: { sourceId: testSource.id } },
    });
    await prisma.job.deleteMany({
      where: { sourceId: testSource.id },
    });
  });

  it('upserts jobs idempotently without duplicate records', async () => {
    const jobData = {
      sourceId: testSource.id,
      externalId: 'ext-dedup-101',
      fingerprint: 'ext:ext-dedup-101',
      originalUrl: 'https://example.com/job/101',
      rawPayload: { raw: 'data' },
      originalTitle: 'DevOps Engineer',
      originalDescription: 'Kubernetes, Terraform, and AWS CI/CD pipelines.',
      normalizedTitle: 'DevOps Engineer',
      normalizedDescription: 'Kubernetes, Terraform, and AWS CI/CD pipelines.',
      companyName: 'Cloud Solutions PLC',
      country: 'Ethiopia',
      city: 'Addis Ababa',
      isRemote: true,
      workArrangement: 'REMOTE' as const,
    };

    // First upsert -> Created
    const { job: job1, isNew: isNew1 } = await jobsRepository.upsertJob(jobData);
    assert.strictEqual(isNew1, true);
    assert.strictEqual(job1.fingerprint, 'ext:ext-dedup-101');

    // Second upsert with updated description -> Updated, no duplicate
    const updatedData = {
      ...jobData,
      normalizedDescription: 'Kubernetes, Terraform, AWS, and GCP CI/CD pipelines.',
    };
    const { job: job2, isNew: isNew2 } = await jobsRepository.upsertJob(updatedData);
    assert.strictEqual(isNew2, false);
    assert.strictEqual(job2.id, job1.id);
    assert.strictEqual(job2.normalizedDescription, updatedData.normalizedDescription);

    // Verify database count for this externalId is exactly 1
    const totalMatching = await prisma.job.count({
      where: { sourceId: testSource.id, externalId: 'ext-dedup-101' },
    });
    assert.strictEqual(totalMatching, 1);
  });

  it('correctly applies expiration policies based on closing date and 30-day fallback', async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next week
    const thirtyFiveDaysAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

    // 1. Job with past closing date
    const jobWithPastDeadline = await jobsRepository.upsertJob({
      sourceId: testSource.id,
      externalId: 'job-expired-deadline',
      fingerprint: 'ext:job-expired-deadline',
      originalUrl: 'https://example.com/job/exp1',
      rawPayload: {},
      originalTitle: 'Expired Job by Deadline',
      originalDescription: 'Should be marked expired.',
      normalizedTitle: 'Expired Job by Deadline',
      normalizedDescription: 'Should be marked expired.',
      closingDate: pastDate,
      isRemote: false,
      workArrangement: 'ON_SITE',
    });

    // 2. Active job with future closing date
    const jobWithFutureDeadline = await jobsRepository.upsertJob({
      sourceId: testSource.id,
      externalId: 'job-active-future',
      fingerprint: 'ext:job-active-future',
      originalUrl: 'https://example.com/job/act1',
      rawPayload: {},
      originalTitle: 'Active Job Future Deadline',
      originalDescription: 'Should remain active.',
      normalizedTitle: 'Active Job Future Deadline',
      normalizedDescription: 'Should remain active.',
      closingDate: futureDate,
      isRemote: false,
      workArrangement: 'ON_SITE',
    });

    // 3. Job with no closing date but created 35 days ago (exceeding fallback)
    const oldJobNoDeadline = await jobsRepository.upsertJob({
      sourceId: testSource.id,
      externalId: 'job-old-fallback',
      fingerprint: 'ext:job-old-fallback',
      originalUrl: 'https://example.com/job/old1',
      rawPayload: {},
      originalTitle: 'Old Job Fallback',
      originalDescription: 'Old posting.',
      normalizedTitle: 'Old Job Fallback',
      normalizedDescription: 'Old posting.',
      closingDate: null,
      isRemote: false,
      workArrangement: 'ON_SITE',
    });
    // Manually backdate firstSeenAt
    await prisma.job.update({
      where: { id: oldJobNoDeadline.job.id },
      data: { firstSeenAt: thirtyFiveDaysAgo },
    });

    // Run expiration policies
    const { expiredByDate, expiredByFallback } = await jobsRepository.applyExpirationPolicies(30);
    assert.ok(expiredByDate >= 1);
    assert.ok(expiredByFallback >= 1);

    // Check statuses
    const check1 = await prisma.job.findUnique({ where: { id: jobWithPastDeadline.job.id } });
    assert.strictEqual(check1?.status, 'EXPIRED');

    const check2 = await prisma.job.findUnique({ where: { id: jobWithFutureDeadline.job.id } });
    assert.strictEqual(check2?.status, 'ACTIVE');

    const check3 = await prisma.job.findUnique({ where: { id: oldJobNoDeadline.job.id } });
    assert.strictEqual(check3?.status, 'EXPIRED');
  });

  it('tracks classification history and preserves one current source of truth', async () => {
    // Create a job for classification
    const { job } = await jobsRepository.upsertJob({
      sourceId: testSource.id,
      externalId: 'job-to-classify',
      fingerprint: 'ext:job-to-classify',
      originalUrl: 'https://example.com/job/cls1',
      rawPayload: {},
      originalTitle: 'Full Stack React & Node Developer',
      originalDescription: 'Building modern web apps with TypeScript, React, Express, and MySQL. Minimum 5 years experience.',
      normalizedTitle: 'Full Stack React & Node Developer',
      normalizedDescription: 'Building modern web apps with TypeScript, React, Express, and MySQL. Minimum 5 years experience.',
      isRemote: true,
      workArrangement: 'REMOTE',
    });

    // Run first classification
    const success1 = await classificationService.classifyJobById(job.id);
    assert.strictEqual(success1, true);

    const afterFirst = await jobsRepository.findById(job.id);
    assert.strictEqual(afterFirst?.classificationStatus, 'CLASSIFIED');
    assert.ok(afterFirst?.categoryId);
    assert.strictEqual(afterFirst?.classifications.length, 1);
    assert.strictEqual(afterFirst?.classifications[0].isCurrent, true);

    // Run second classification (reclassification simulation)
    const success2 = await classificationService.classifyJobById(job.id);
    assert.strictEqual(success2, true);

    const afterSecond = await jobsRepository.findById(job.id);
    assert.strictEqual(afterSecond?.classifications.length, 2);

    const currentClassifications = afterSecond?.classifications.filter((c) => c.isCurrent);
    assert.strictEqual(currentClassifications?.length, 1); // Exactly one current
    const nonCurrentClassifications = afterSecond?.classifications.filter((c) => !c.isCurrent);
    assert.strictEqual(nonCurrentClassifications?.length, 1); // Superseded is preserved
  });

  it('prevents overlapping collection runs for the same source', async () => {
    // Create an artificial active running collection run
    const activeRun = await prisma.collectionRun.create({
      data: {
        sourceId: testSource.id,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      await assert.rejects(
        async () => sourcesService.runCollection(testSource.id),
        (err: any) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'SOURCE_RUN_IN_PROGRESS');
          return true;
        }
      );
    } finally {
      await prisma.collectionRun.delete({ where: { id: activeRun.id } });
    }
  });

  after(async () => {
    await prisma.jobClassification.deleteMany({
      where: { job: { sourceId: testSource.id } },
    });
    await prisma.job.deleteMany({
      where: { sourceId: testSource.id },
    });
    await prisma.$disconnect();
  });
});

