import { Job, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NormalizedJob } from '../sources/adapters/source-adapter.interface';

export class JobsRepository {
  async upsertJob(data: NormalizedJob): Promise<{ job: Job; isNew: boolean }> {
    const existing = await prisma.job.findUnique({
      where: {
        sourceId_fingerprint: {
          sourceId: data.sourceId,
          fingerprint: data.fingerprint,
        },
      },
    });

    const now = new Date();

    if (existing) {
      // Record already exists: update lastSeenAt and mutable fields without destroying classification
      const updated = await prisma.job.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: now,
          normalizedTitle: data.normalizedTitle,
          normalizedDescription: data.normalizedDescription,
          applicationUrl: data.applicationUrl ?? existing.applicationUrl,
          closingDate: data.closingDate ?? existing.closingDate,
          salaryMin: typeof data.salaryMin === 'number' ? new Prisma.Decimal(data.salaryMin) : existing.salaryMin,
          salaryMax: typeof data.salaryMax === 'number' ? new Prisma.Decimal(data.salaryMax) : existing.salaryMax,
          isRemote: data.isRemote,
          workArrangement: data.workArrangement,
          rawPayload: data.rawPayload ? (data.rawPayload as Prisma.InputJsonValue) : (existing.rawPayload ?? Prisma.DbNull),
        },
      });
      return { job: updated, isNew: false };
    }

    // New job creation
    const created = await prisma.job.create({
      data: {
        sourceId: data.sourceId,
        externalId: data.externalId,
        fingerprint: data.fingerprint,
        originalUrl: data.originalUrl,
        applicationUrl: data.applicationUrl,
        rawPayload: data.rawPayload ? (data.rawPayload as Prisma.InputJsonValue) : Prisma.DbNull,
        originalTitle: data.originalTitle,
        originalDescription: data.originalDescription,
        normalizedTitle: data.normalizedTitle,
        normalizedDescription: data.normalizedDescription,
        companyName: data.companyName,
        country: data.country,
        city: data.city,
        isRemote: data.isRemote,
        workArrangement: data.workArrangement,
        remoteEligibility: data.remoteEligibility,
        employmentType: data.employmentType,
        experienceLevel: data.experienceLevel,
        salaryMin: data.salaryMin !== null && data.salaryMin !== undefined ? new Prisma.Decimal(data.salaryMin) : null,
        salaryMax: data.salaryMax !== null && data.salaryMax !== undefined ? new Prisma.Decimal(data.salaryMax) : null,
        salaryCurrency: data.salaryCurrency,
        salaryPeriod: data.salaryPeriod,
        publishedAt: data.publishedAt,
        closingDate: data.closingDate,
        firstSeenAt: now,
        lastSeenAt: now,
        status: 'ACTIVE',
        classificationStatus: 'PENDING',
      },
    });

    return { job: created, isNew: true };
  }

  async findById(id: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { id },
      include: {
        source: true,
        category: true,
        classifications: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getPendingClassificationJobs(limit = 20): Promise<Job[]> {
    return prisma.job.findMany({
      where: {
        classificationStatus: 'PENDING',
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateClassification(
    jobId: string,
    params: {
      categoryId?: string | null;
      status: 'PENDING' | 'CLASSIFIED' | 'FAILED' | 'REVIEW_REQUIRED';
      confidence?: number | null;
    }
  ): Promise<Job> {
    return prisma.job.update({
      where: { id: jobId },
      data: {
        categoryId: params.categoryId,
        classificationStatus: params.status,
        classificationConfidence:
          params.confidence !== null && params.confidence !== undefined
            ? new Prisma.Decimal(params.confidence)
            : null,
      },
    });
  }

  async applyExpirationPolicies(fallbackDays = 30): Promise<{ expiredByDate: number; expiredByFallback: number }> {
    const now = new Date();

    // 1. Expire jobs with past closing dates
    const closingDateResult = await prisma.job.updateMany({
      where: {
        status: 'ACTIVE',
        closingDate: { lt: now },
      },
      data: {
        status: 'EXPIRED',
        expiredAt: now,
      },
    });

    // 2. Expire jobs without closing dates older than fallback policy (e.g. 30 days)
    const fallbackThreshold = new Date(now.getTime() - fallbackDays * 24 * 60 * 60 * 1000);
    const fallbackResult = await prisma.job.updateMany({
      where: {
        status: 'ACTIVE',
        closingDate: null,
        firstSeenAt: { lt: fallbackThreshold },
      },
      data: {
        status: 'EXPIRED',
        expiredAt: now,
      },
    });

    return {
      expiredByDate: closingDateResult.count,
      expiredByFallback: fallbackResult.count,
    };
  }
}

export const jobsRepository = new JobsRepository();
