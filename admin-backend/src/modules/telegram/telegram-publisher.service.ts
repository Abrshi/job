import { Job, Prisma, TelegramPostStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { salaryEligibilityService, SalaryEligibilityService } from './salary-eligibility.service';
import { telegramApiClient, TelegramApiClient } from './telegram-api.client';
import { formatTelegramJobMessage } from './telegram-message.formatter';
import { BackfillOptions, BackfillResult, TelegramPublishResult } from './telegram.types';

export class TelegramPublisherService {
  // Service startup timestamp used to prevent auto-posting ancient historical jobs on initial deployment
  private readonly serviceStartTime: Date;
  private isProcessingBatch = false;

  constructor(
    private readonly eligibilityService: SalaryEligibilityService = salaryEligibilityService,
    private readonly apiClient: TelegramApiClient = telegramApiClient,
    private readonly db: typeof prisma = prisma
  ) {
    if (env.TELEGRAM_AUTO_POST_START_DATE) {
      const parsed = new Date(env.TELEGRAM_AUTO_POST_START_DATE);
      this.serviceStartTime = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      this.serviceStartTime = new Date();
    }
  }

  /**
   * Helper delay for respecting Telegram channel rate limits (1-2s between posts)
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Publish a single job to the Telegram channel with strict eligibility check and duplicate protection
   */
  async publishJob(jobId: string, options: { force?: boolean } = {}): Promise<TelegramPublishResult> {
    const channelId = env.TELEGRAM_CHANNEL_ID || '@etjobcollector';

    // 1. Fetch job with any existing telegram publication record
    const job = await this.db.job.findUnique({
      where: { id: jobId },
      include: { telegramPost: true },
    });

    if (!job) {
      return { success: false, jobId, error: `Job with ID '${jobId}' not found.` };
    }

    // 2. Concurrency & duplicate prevention check
    const existing = job.telegramPost;
    if (existing) {
      if (existing.status === 'POSTED' && !options.force) {
        logger.info(`[TelegramPublisher] Job ${jobId} was already published to Telegram on ${existing.publishedAt?.toISOString()}. Skipping.`);
        return {
          success: true,
          jobId,
          skipped: true,
          messageId: existing.telegramMsgId ?? undefined,
          reason: 'Job has already been published to Telegram.',
        };
      }

      if (existing.status === 'SKIPPED' && !options.force) {
        return {
          success: false,
          jobId,
          skipped: true,
          reason: existing.errorMessage || 'Job was previously evaluated and marked ineligible for Telegram posting.',
        };
      }

      // Check if another concurrent run is actively sending this job
      if (existing.status === 'PENDING' && !options.force) {
        const timeSinceAttemptMs = Date.now() - (existing.lastAttemptAt?.getTime() || 0);
        if (timeSinceAttemptMs < 2 * 60 * 1000) {
          logger.warn(`[TelegramPublisher] Job ${jobId} is currently being processed by another worker (${Math.round(timeSinceAttemptMs / 1000)}s ago).`);
          return {
            success: false,
            jobId,
            skipped: true,
            reason: 'Concurrent publication lock in progress.',
          };
        }
      }
    }

    // 3. Salary eligibility check
    // Only publish jobs with a confirmed salary strictly greater than 20,000 ETB per month.
    const eligibility = this.eligibilityService.checkEligibility({
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      employmentType: job.employmentType,
      rawPayload: job.rawPayload,
    });

    if (!eligibility.isEligible && !options.force) {
      // Mark as SKIPPED so future scheduler ticks do not repeatedly evaluate permanently ineligible jobs
      await this.db.telegramPost.upsert({
        where: { jobId },
        create: {
          jobId,
          channelId,
          status: 'SKIPPED',
          errorMessage: eligibility.reason,
          lastAttemptAt: new Date(),
        },
        update: {
          status: 'SKIPPED',
          errorMessage: eligibility.reason,
          lastAttemptAt: new Date(),
        },
      });

      logger.info(`[TelegramPublisher] Job ${jobId} ('${job.normalizedTitle}') skipped: ${eligibility.reason}`);

      return {
        success: false,
        jobId,
        skipped: true,
        reason: eligibility.reason,
      };
    }

    // 4. Mark status as PENDING lock before calling Telegram API
    await this.db.telegramPost.upsert({
      where: { jobId },
      create: {
        jobId,
        channelId,
        status: 'PENDING',
        lastAttemptAt: new Date(),
      },
      update: {
        status: 'PENDING',
        lastAttemptAt: new Date(),
      },
    });

    // 5. Format message using safe Telegram HTML
    const formattedHtml = formatTelegramJobMessage(job);

    // 6. Send message to Telegram
    const apiResult = await this.apiClient.sendMessage(formattedHtml, { channelId });

    if (apiResult.ok && apiResult.result?.message_id) {
      const msgId = apiResult.result.message_id;
      const now = new Date();

      await this.db.telegramPost.update({
        where: { jobId },
        data: {
          status: 'POSTED',
          telegramMsgId: msgId,
          publishedAt: now,
          errorMessage: null,
          lastAttemptAt: now,
        },
      });

      logger.info(
        `[TelegramPublisher] Successfully published job ${jobId} ('${job.normalizedTitle}') to ${channelId} (Telegram Msg ID: ${msgId})`
      );

      return {
        success: true,
        jobId,
        messageId: msgId,
      };
    }

    // 7. Handle Telegram API failure: Record error and permit retry later
    const errorDesc = apiResult.description || 'Unknown Telegram API error';
    await this.db.telegramPost.update({
      where: { jobId },
      data: {
        status: 'FAILED',
        errorMessage: errorDesc.slice(0, 1000),
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    logger.error(`[TelegramPublisher] Failed to post job ${jobId} to Telegram: ${errorDesc}`);

    return {
      success: false,
      jobId,
      error: errorDesc,
    };
  }

  /**
   * Process pending newly collected or due jobs for automatic Telegram posting.
   * Runs safely in the background after collection runs or on scheduler ticks.
   */
  async processPendingEligibleJobs(limit = 10): Promise<{
    processed: number;
    posted: number;
    skipped: number;
    failed: number;
  }> {
    if (this.isProcessingBatch) {
      logger.info('[TelegramPublisher] A batch is already being processed. Deferring.');
      return { processed: 0, posted: 0, skipped: 0, failed: 0 };
    }

    this.isProcessingBatch = true;
    let processed = 0;
    let posted = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Rollout safety: Only evaluate jobs created after startup cutoff, or where status is ACTIVE
      // and no successful or skipped telegram post exists yet.
      const candidateJobs = await this.db.job.findMany({
        where: {
          status: 'ACTIVE',
          // Historical rollout safeguard: only process newly collected jobs
          createdAt: { gte: this.serviceStartTime },
          OR: [
            { telegramPost: null },
            {
              telegramPost: {
                status: 'FAILED',
                retryCount: { lt: 5 }, // Cap retry attempts to avoid spamming broken messages
              },
            },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });

      if (candidateJobs.length === 0) {
        return { processed, posted, skipped, failed };
      }

      logger.info(`[TelegramPublisher] Evaluating ${candidateJobs.length} candidate jobs for Telegram publishing...`);

      for (const job of candidateJobs) {
        try {
          const result = await this.publishJob(job.id);
          processed++;

          if (result.success && !result.skipped) {
            posted++;
            // Rate limit delay: pause 1.5s between consecutive posts to respect Telegram channel rate limits
            await this.delay(1500);
          } else if (result.skipped) {
            skipped++;
          } else {
            failed++;
          }
        } catch (jobErr) {
          failed++;
          logger.error(`[TelegramPublisher] Unexpected error while processing job ${job.id}:`, (jobErr as Error).message);
        }
      }

      if (posted > 0 || failed > 0) {
        logger.info(`[TelegramPublisher] Batch completed: posted=${posted}, skipped=${skipped}, failed=${failed}`);
      }

      return { processed, posted, skipped, failed };
    } catch (batchErr) {
      logger.error('[TelegramPublisher] Batch processing error:', (batchErr as Error).message);
      return { processed, posted, skipped, failed };
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Controlled backfill tool for historical jobs
   * Supports dry-run, max limit, and custom threshold
   */
  async backfill(options: BackfillOptions = {}): Promise<BackfillResult> {
    const isDryRun = options.dryRun ?? true;
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const minSalary = options.minSalary ?? env.TELEGRAM_MIN_SALARY_ETB ?? 20000;

    const whereClause: Prisma.JobWhereInput = {
      status: 'ACTIVE',
      ...(options.sourceId ? { sourceId: options.sourceId } : {}),
      OR: [
        { telegramPost: null },
        { telegramPost: { status: { in: ['FAILED', 'PENDING'] } } },
      ],
    };

    const jobs = await this.db.job.findMany({
      where: whereClause,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: { telegramPost: true },
    });

    const result: BackfillResult = {
      dryRun: isDryRun,
      totalEvaluated: jobs.length,
      eligibleCount: 0,
      postedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      details: [],
    };

    for (const job of jobs) {
      const eligibility = this.eligibilityService.checkEligibility(
        {
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryPeriod: job.salaryPeriod,
          employmentType: job.employmentType,
          rawPayload: job.rawPayload,
        },
        { thresholdEtb: minSalary }
      );

      const salarySummary = `${job.salaryMin ? Number(job.salaryMin).toLocaleString() : '?'} - ${
        job.salaryMax ? Number(job.salaryMax).toLocaleString() : '?'
      } ${job.salaryCurrency || 'NoCurr'} (${job.salaryPeriod || 'NoPeriod'})`;

      if (eligibility.isEligible) {
        result.eligibleCount++;

        if (isDryRun) {
          result.details.push({
            jobId: job.id,
            title: job.normalizedTitle,
            company: job.companyName,
            salary: salarySummary,
            isEligible: true,
            reason: eligibility.reason,
            posted: false,
          });
        } else {
          // Live backfill: publish with rate limit delay
          const pubResult = await this.publishJob(job.id);
          const wasPosted = pubResult.success && !pubResult.skipped;
          if (wasPosted) {
            result.postedCount++;
            await this.delay(2000);
          } else {
            result.failedCount++;
          }

          result.details.push({
            jobId: job.id,
            title: job.normalizedTitle,
            company: job.companyName,
            salary: salarySummary,
            isEligible: true,
            reason: pubResult.reason || pubResult.error || 'Posted to Telegram',
            posted: wasPosted,
          });
        }
      } else {
        result.skippedCount++;
        result.details.push({
          jobId: job.id,
          title: job.normalizedTitle,
          company: job.companyName,
          salary: salarySummary,
          isEligible: false,
          reason: eligibility.reason,
          posted: false,
        });

        if (!isDryRun) {
          // Record skip in database
          await this.db.telegramPost.upsert({
            where: { jobId: job.id },
            create: {
              jobId: job.id,
              channelId: env.TELEGRAM_CHANNEL_ID || '@etjobcollector',
              status: 'SKIPPED',
              errorMessage: eligibility.reason,
              lastAttemptAt: new Date(),
            },
            update: {
              status: 'SKIPPED',
              errorMessage: eligibility.reason,
              lastAttemptAt: new Date(),
            },
          });
        }
      }
    }

    return result;
  }

  /**
   * Get Telegram publication metrics & statistics
   */
  async getStats(): Promise<{
    channelId: string;
    totalTracked: number;
    posted: number;
    skipped: number;
    failed: number;
    pending: number;
    botConfigured: boolean;
  }> {
    const channelId = env.TELEGRAM_CHANNEL_ID || '@etjobcollector';
    const [total, posted, skipped, failed, pending] = await Promise.all([
      this.db.telegramPost.count(),
      this.db.telegramPost.count({ where: { status: 'POSTED' } }),
      this.db.telegramPost.count({ where: { status: 'SKIPPED' } }),
      this.db.telegramPost.count({ where: { status: 'FAILED' } }),
      this.db.telegramPost.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      channelId,
      totalTracked: total,
      posted,
      skipped,
      failed,
      pending,
      botConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
    };
  }
}

export const telegramPublisherService = new TelegramPublisherService();

