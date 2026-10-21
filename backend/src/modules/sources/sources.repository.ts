import { JobSource, CollectionRun, RunStatus, SourceType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface SourceStats {
  totalJobs: number;
  activeJobs: number;
  expiredJobs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
}

export type SafeJobSource = Omit<JobSource, 'headers'>;

export class SourcesRepository {
  sanitize(source: JobSource): SafeJobSource {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { headers, ...safe } = source;
    return safe;
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<{ sources: SafeJobSource[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JobSourceWhereInput = {};
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [sources, total] = await Promise.all([
      prisma.jobSource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.jobSource.count({ where }),
    ]);

    return {
      sources: sources.map((s) => this.sanitize(s)),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string): Promise<JobSource | null> {
    return prisma.jobSource.findUnique({
      where: { id },
    });
  }

  async findSafeById(id: string): Promise<SafeJobSource | null> {
    const source = await this.findById(id);
    return source ? this.sanitize(source) : null;
  }

  async findBySlug(slug: string): Promise<JobSource | null> {
    return prisma.jobSource.findUnique({
      where: { slug },
    });
  }

  async findActiveDueSources(now = new Date()): Promise<JobSource[]> {
    return prisma.jobSource.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async create(data: {
    name: string;
    slug: string;
    type?: SourceType;
    endpointUrl: string;
    isActive?: boolean;
    pollingInterval?: number;
    headers?: Record<string, unknown>;
  }): Promise<SafeJobSource> {
    const source = await prisma.jobSource.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type || 'API',
        endpointUrl: data.endpointUrl,
        isActive: data.isActive !== undefined ? data.isActive : true,
        pollingInterval: data.pollingInterval || 60,
        headers: data.headers ? (data.headers as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    return this.sanitize(source);
  }

  async update(
    id: string,
    data: {
      name?: string;
      endpointUrl?: string;
      isActive?: boolean;
      pollingInterval?: number;
      lastRunAt?: Date;
      lastSuccessAt?: Date;
      nextRunAt?: Date;
      headers?: Record<string, unknown> | null;
    }
  ): Promise<SafeJobSource> {
    const updatePayload: Prisma.JobSourceUpdateInput = {
      name: data.name,
      endpointUrl: data.endpointUrl,
      isActive: data.isActive,
      pollingInterval: data.pollingInterval,
      lastRunAt: data.lastRunAt,
      lastSuccessAt: data.lastSuccessAt,
      nextRunAt: data.nextRunAt,
    };

    if (data.headers !== undefined) {
      updatePayload.headers = data.headers ? (data.headers as Prisma.InputJsonValue) : Prisma.DbNull;
    }

    const updated = await prisma.jobSource.update({
      where: { id },
      data: updatePayload,
    });

    return this.sanitize(updated);
  }

  async createRun(sourceId: string): Promise<CollectionRun> {
    return prisma.collectionRun.create({
      data: {
        sourceId,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  async updateRun(
    runId: string,
    data: {
      finishedAt?: Date;
      status?: RunStatus;
      recordsFetched?: number;
      jobsCreated?: number;
      jobsUpdated?: number;
      jobsSkipped?: number;
      errorSummary?: string | null;
      checkpoint?: unknown;
    }
  ): Promise<CollectionRun> {
    return prisma.collectionRun.update({
      where: { id: runId },
      data: {
        finishedAt: data.finishedAt,
        status: data.status,
        recordsFetched: data.recordsFetched,
        jobsCreated: data.jobsCreated,
        jobsUpdated: data.jobsUpdated,
        jobsSkipped: data.jobsSkipped,
        errorSummary: data.errorSummary,
        checkpoint: data.checkpoint ? (data.checkpoint as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async getRecentRuns(sourceId?: string, limit = 20): Promise<CollectionRun[]> {
    return prisma.collectionRun.findMany({
      where: sourceId ? { sourceId } : undefined,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        source: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async getSourceStats(sourceId: string): Promise<SourceStats> {
    const [totalJobs, activeJobs, expiredJobs, totalRuns, successfulRuns, failedRuns, source] =
      await Promise.all([
        prisma.job.count({ where: { sourceId } }),
        prisma.job.count({ where: { sourceId, status: 'ACTIVE' } }),
        prisma.job.count({ where: { sourceId, status: 'EXPIRED' } }),
        prisma.collectionRun.count({ where: { sourceId } }),
        prisma.collectionRun.count({ where: { sourceId, status: 'SUCCESS' } }),
        prisma.collectionRun.count({ where: { sourceId, status: 'FAILED' } }),
        prisma.jobSource.findUnique({
          where: { id: sourceId },
          select: { lastRunAt: true, lastSuccessAt: true },
        }),
      ]);

    return {
      totalJobs,
      activeJobs,
      expiredJobs,
      totalRuns,
      successfulRuns,
      failedRuns,
      lastRunAt: source?.lastRunAt || null,
      lastSuccessAt: source?.lastSuccessAt || null,
    };
  }
}

export const sourcesRepository = new SourcesRepository();
