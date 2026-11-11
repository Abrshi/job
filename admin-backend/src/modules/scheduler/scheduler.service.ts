import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sourcesService, SourcesService } from '../sources/sources.service';
import { notificationsService } from '../alerts/notifications.service';
import { telegramPublisherService } from '../telegram/telegram-publisher.service';
import { discoveryService } from '../discovery/discovery.service';

export class SourceScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly runningSources = new Set<string>();
  private readonly maxConcurrentRuns = 3;

  constructor(private readonly service: SourcesService = sourcesService) {}

  start(intervalMs = 30000): void {
    if (this.timer) {
      logger.warn('Source scheduler is already running.');
      return;
    }

    logger.info(`Starting dynamic job source scheduler (tick interval: ${intervalMs / 1000}s)`);

    // Initial tick after short warmup delay to accommodate remote serverless cold-starts
    setTimeout(() => this.tick(), 5000);

    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Dynamic job source scheduler stopped.');
    }
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  get activeRunningSourceCount(): number {
    return this.runningSources.size;
  }

  /**
   * Main scheduler tick checking for due sources
   */
  async tick(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const now = new Date();
      // Find active sources that are due for polling
      const dueSources = await prisma.jobSource.findMany({
        where: {
          isActive: true,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        },
        orderBy: { nextRunAt: 'asc' },
      });

      if (dueSources.length === 0) {
        return;
      }

      for (const source of dueSources) {
        // Obey concurrency limit
        if (this.runningSources.size >= this.maxConcurrentRuns) {
          logger.info(`Scheduler reached max concurrency limit (${this.maxConcurrentRuns}). Deferring remaining sources.`);
          break;
        }

        // Prevent overlapping runs for the same source
        if (this.runningSources.has(source.id)) {
          continue;
        }

        this.runningSources.add(source.id);

        // Execute run asynchronously without blocking next due sources
        (async () => {
          try {
            await this.service.runCollection(source.id);
          } catch (err) {
            logger.error(`Scheduled run error for source '${source.name}':`, (err as Error).message);
          } finally {
            this.runningSources.delete(source.id);
          }
        })();
      }

      // Check and process pending job alerts for active saved searches
      if (process.env.NODE_ENV !== 'test') {
        notificationsService.processPendingJobAlerts().catch((alertErr) => {
          logger.error('Error during scheduled job alert processing:', (alertErr as Error).message);
        });

        telegramPublisherService.processPendingEligibleJobs().catch((tgErr) => {
          logger.error('Error during scheduled telegram job processing:', (tgErr as Error).message);
        });

        this.processDueDiscoverySearches().catch((discErr) => {
          logger.error('Error during scheduled discovery search processing:', (discErr as Error).message);
        });
      }
    } catch (tickErr: any) {
      const msg = tickErr?.message || String(tickErr);
      const code = tickErr?.code;
      if (
        code === 'P1001' ||
        msg.includes("Can't reach database server") ||
        msg.includes('ECONNRESET') ||
        msg.includes('Connection terminated')
      ) {
        logger.warn(
          'Scheduler database connection cold-starting or temporarily unreachable; will automatically retry on next tick.'
        );
      } else {
        logger.error('Error during scheduler tick: ' + msg);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process due discovery search definitions
   */
  private async processDueDiscoverySearches(): Promise<void> {
    const dueSearches = await prisma.jobSearchDefinition.findMany({
      where: {
        status: 'ACTIVE',
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
      },
      take: 2, // Process small bounded batch per tick to obey rate & resource limits
      orderBy: [{ priority: 'desc' }, { lastRunAt: 'asc' }],
    });

    for (const search of dueSearches) {
      try {
        await discoveryService.executeSearch(search.id);
      } catch (err: any) {
        logger.error(`Error executing scheduled discovery search ${search.id}:`, err.message);
      }
    }
  }

  /**
   * Force immediate evaluation of due sources (e.g. after admin updates interval)
   */
  async refreshSchedule(): Promise<void> {
    logger.info('Scheduler schedule refreshed on source configuration change.');
    await this.tick();
  }
}

export const sourceScheduler = new SourceScheduler();
