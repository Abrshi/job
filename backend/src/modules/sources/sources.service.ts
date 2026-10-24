import { JobSource, CollectionRun } from '@prisma/client';
import { sourcesRepository, SourcesRepository, SafeJobSource } from './sources.repository';
import { jobsRepository, JobsRepository } from '../jobs/jobs.repository';
import { adapterRegistry, AdapterRegistry } from './adapters/adapter.registry';
import { classificationService, ClassificationService } from '../classification/classification.service';
import { notificationsService } from '../alerts/notifications.service';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../lib/logger';

export class SourcesService {
  constructor(
    private readonly sourcesRepo: SourcesRepository = sourcesRepository,
    private readonly jobsRepo: JobsRepository = jobsRepository,
    private readonly registry: AdapterRegistry = adapterRegistry,
    private readonly classificationSvc: ClassificationService = classificationService
  ) {}

  async getSources(options?: { page?: number; limit?: number; isActive?: boolean }) {
    return this.sourcesRepo.findAll(options);
  }

  async getSourceById(id: string): Promise<SafeJobSource> {
    const source = await this.sourcesRepo.findSafeById(id);
    if (!source) {
      throw AppError.notFound(`Job source with id '${id}' not found`, 'SOURCE_NOT_FOUND');
    }
    return source;
  }

  async createSource(data: {
    name: string;
    slug: string;
    type?: 'API' | 'RSS' | 'SCRAPER';
    endpointUrl: string;
    isActive?: boolean;
    pollingInterval?: number;
    headers?: Record<string, unknown>;
  }): Promise<SafeJobSource> {
    const existing = await this.sourcesRepo.findBySlug(data.slug);
    if (existing) {
      throw AppError.conflict(`Job source with slug '${data.slug}' already exists`, 'SOURCE_SLUG_CONFLICT');
    }

    return this.sourcesRepo.create(data);
  }

  async updateSource(
    id: string,
    data: {
      name?: string;
      endpointUrl?: string;
      isActive?: boolean;
      pollingInterval?: number;
      headers?: Record<string, unknown> | null;
    }
  ): Promise<SafeJobSource> {
    await this.getSourceById(id);
    return this.sourcesRepo.update(id, data);
  }

  async getSourceStats(id: string) {
    await this.getSourceById(id);
    return this.sourcesRepo.getSourceStats(id);
  }

  async getRunsForSource(sourceId: string, limit = 20) {
    await this.getSourceById(sourceId);
    return this.sourcesRepo.getRecentRuns(sourceId, limit);
  }

  async getAllRuns(limit = 30) {
    return this.sourcesRepo.getRecentRuns(undefined, limit);
  }

  /**
   * Execute an atomic collection run for a specific JobSource
   */
  async runCollection(sourceId: string): Promise<CollectionRun> {
    const source = await this.sourcesRepo.findById(sourceId);
    if (!source) {
      throw AppError.notFound(`Job source with id '${sourceId}' not found`, 'SOURCE_NOT_FOUND');
    }

    // Overlapping execution prevention: Check if a run is currently active for this source
    const recentRuns = await this.sourcesRepo.getRecentRuns(sourceId, 1);
    const latestRun = recentRuns[0];
    if (latestRun && latestRun.status === 'RUNNING') {
      const runAgeMs = Date.now() - new Date(latestRun.startedAt).getTime();
      // If a run is running and less than 15 minutes old, prevent overlap
      if (runAgeMs < 15 * 60 * 1000) {
        throw AppError.conflict(
          `A collection run is already in progress for source '${source.name}' (started ${Math.round(runAgeMs / 1000)}s ago)`,
          'SOURCE_RUN_IN_PROGRESS'
        );
      } else {
        // Mark stale run as failed
        await this.sourcesRepo.updateRun(latestRun.id, {
          status: 'FAILED',
          finishedAt: new Date(),
          errorSummary: 'Run timed out / abandoned by previous instance',
        });
      }
    }

    const run = await this.sourcesRepo.createRun(source.id);
    const now = new Date();
    await this.sourcesRepo.update(source.id, { lastRunAt: now });

    logger.info(`Starting collection run ${run.id} for source '${source.name}' (${source.slug})`);

    let recordsFetched = 0;
    let jobsCreated = 0;
    let jobsUpdated = 0;
    let jobsSkipped = 0;

    try {
      const adapter = this.registry.get(source.slug);
      const fetchResult = await adapter.fetchJobs(source, { limit: 100 });
      recordsFetched = fetchResult.recordsFetched;

      for (const rawJob of fetchResult.jobs) {
        try {
          const normalized = adapter.normalize(rawJob, source);
          const { isNew } = await this.jobsRepo.upsertJob(normalized);
          if (isNew) {
            jobsCreated++;
          } else {
            jobsUpdated++;
          }
        } catch (jobErr) {
          jobsSkipped++;
          logger.warn(`Failed to process job in run ${run.id}:`, (jobErr as Error).message);
        }
      }

      // Apply expiration policies to keep job lifecycles fresh
      await this.jobsRepo.applyExpirationPolicies();

      const finishTime = new Date();
      const nextRunAt = new Date(finishTime.getTime() + source.pollingInterval * 60 * 1000);

      const completedRun = await this.sourcesRepo.updateRun(run.id, {
        finishedAt: finishTime,
        status: 'SUCCESS',
        recordsFetched,
        jobsCreated,
        jobsUpdated,
        jobsSkipped,
        checkpoint: fetchResult.checkpoint,
      });

      await this.sourcesRepo.update(source.id, {
        lastSuccessAt: finishTime,
        nextRunAt,
      });

      logger.info(
        `Collection run ${run.id} succeeded for '${source.name}': ` +
          `fetched=${recordsFetched}, created=${jobsCreated}, updated=${jobsUpdated}, skipped=${jobsSkipped}`
      );

      // Trigger asynchronous classification and alert evaluation (without blocking response, skip during tests)
      if (process.env.NODE_ENV !== 'test') {
        setImmediate(() => {
          this.classificationSvc.processPendingJobs(50).catch((err) => {
            logger.error('Background classification queue processing error:', err.message);
          });
          notificationsService.processPendingJobAlerts().catch((alertErr) => {
            logger.error('Background alert evaluation error after collection:', alertErr.message);
          });
        });
      }

      return completedRun;
    } catch (err: unknown) {
      const finishTime = new Date();
      const errorMsg = (err as Error).message || 'Unknown collection failure';

      logger.error(`Collection run ${run.id} failed for '${source.name}': ${errorMsg}`);

      // Set next run attempt with backoff
      const nextRunAt = new Date(finishTime.getTime() + Math.min(source.pollingInterval, 15) * 60 * 1000);

      const failedRun = await this.sourcesRepo.updateRun(run.id, {
        finishedAt: finishTime,
        status: 'FAILED',
        recordsFetched,
        jobsCreated,
        jobsUpdated,
        jobsSkipped,
        errorSummary: errorMsg.slice(0, 500),
      });

      await this.sourcesRepo.update(source.id, { nextRunAt });

      return failedRun;
    }
  }
}

export const sourcesService = new SourcesService();
