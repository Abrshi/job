import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sourcesService, SourcesService } from '../sources/sources.service';

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

    // Initial tick after short delay
    setTimeout(() => this.tick(), 2000);

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
    } catch (tickErr) {
      logger.error('Error during scheduler tick:', (tickErr as Error).message);
    } finally {
      this.isProcessing = false;
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
