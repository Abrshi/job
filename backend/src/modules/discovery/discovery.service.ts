import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { jobsRepository, JobsRepository } from '../jobs/jobs.repository';
import { classificationService } from '../classification/classification.service';
import { notificationsService } from '../alerts/notifications.service';
import { telegramPublisherService } from '../telegram/telegram-publisher.service';
import { linkedinAdapter, LinkedInAdapter } from './adapters/linkedin.adapter';
import { linkedInCompaniesService, LinkedInCompaniesService } from './linkedin-companies.service';
import { searchRegistryService, SearchRegistryService } from './search-registry.service';
import { aiSearchPlannerService, AISearchPlannerService } from './ai-search-planner.service';
import {
  LinkedInIntakeInput,
  LinkedInIntakeResult,
} from './discovery.types';
import { DiscoveryReferenceStatus, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error-handler';

export class DiscoveryService {
  constructor(
    private readonly db: typeof prisma = prisma,
    private readonly jobsRepo: JobsRepository = jobsRepository,
    private readonly lAdapter: LinkedInAdapter = linkedinAdapter,
    private readonly registry: SearchRegistryService = searchRegistryService,
    private readonly planner: AISearchPlannerService = aiSearchPlannerService,
    private readonly companiesService: LinkedInCompaniesService = linkedInCompaniesService
  ) {}

  /**
   * Capture a discovered job URL (e.g. from LinkedIn or employer link)
   * Performs URL canonicalization and immediate hash deduplication.
   */
  async captureReference(input: LinkedInIntakeInput): Promise<LinkedInIntakeResult> {
    const rawUrl = (input.url || '').trim();
    if (!rawUrl) {
      throw AppError.badRequest('A valid job posting URL is required.', 'INVALID_URL');
    }

    let canonicalUrl: string;
    let urlHash: string;
    let sourceSlug = 'linkedin';

    if (rawUrl.includes('linkedin.com')) {
      const urlInfo = this.lAdapter.canonicalizeJobUrl(rawUrl);
      if (!urlInfo.isValid || !urlInfo.canonicalUrl || !urlInfo.urlHash) {
        throw AppError.badRequest(urlInfo.error || 'Invalid LinkedIn job URL structure', 'INVALID_LINKEDIN_URL');
      }
      canonicalUrl = urlInfo.canonicalUrl;
      urlHash = urlInfo.urlHash;
    } else {
      // General employer / career page URL
      sourceSlug = 'direct_career';
      try {
        const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        u.hash = ''; // Strip fragments
        // Strip common tracking parameters
        ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'].forEach((p) => u.searchParams.delete(p));
        canonicalUrl = u.toString();
        urlHash = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
      } catch (err: any) {
        throw AppError.badRequest(`Malformed URL: ${err.message}`, 'MALFORMED_URL');
      }
    }

    // O(1) Duplicate detection via unique urlHash index
    const existing = await this.db.jobDiscoveryReference.findUnique({
      where: { urlHash },
    });

    if (existing) {
      logger.info(`[DiscoveryService] Duplicate intake reference detected for hash ${urlHash} (${canonicalUrl})`);
      return {
        referenceId: existing.id,
        url: canonicalUrl,
        urlHash,
        isDuplicate: true,
        status: existing.status,
        message: `This job posting has already been registered (${existing.status}).`,
      };
    }

    const created = await this.db.jobDiscoveryReference.create({
      data: {
        sourceSlug,
        originalUrl: canonicalUrl,
        urlHash,
        title: input.title ? input.title.trim() : null,
        companyName: input.companyName ? input.companyName.trim() : null,
        location: input.location ? input.location.trim() : 'Addis Ababa',
        workArrangement: input.workArrangement || 'ON_SITE',
        status: 'PENDING_REVIEW',
        capturedByUserId: input.capturedByUserId,
        reviewNotes: input.notes,
        rawMetadata: {
          originalSubmittedUrl: rawUrl,
          categorySlug: input.categorySlug,
        },
      },
    });

    logger.info(`[DiscoveryService] Successfully captured intake reference ${created.id} for ${canonicalUrl}`);

    if (input.companyName) {
      this.companiesService.recordCompanyJobDiscovered(input.companyName).catch((err: any) => {
        logger.warn(`Failed to track company '${input.companyName}':`, err.message);
      });
    }

    return {
      referenceId: created.id,
      url: canonicalUrl,
      urlHash,
      isDuplicate: false,
      status: 'PENDING_REVIEW',
      message: 'Job posting registered successfully for administrative review.',
    };
  }

  /**
   * Get captured discovery references with pagination
   */
  async getReferences(options: {
    status?: DiscoveryReferenceStatus;
    sourceSlug?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.JobDiscoveryReferenceWhereInput = {};
    if (options.status) where.status = options.status;
    if (options.sourceSlug) where.sourceSlug = options.sourceSlug;

    const [total, references] = await Promise.all([
      this.db.jobDiscoveryReference.count({ where }),
      this.db.jobDiscoveryReference.findMany({
        where,
        skip,
        take: limit,
        orderBy: { capturedAt: 'desc' },
      }),
    ]);

    return {
      references,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Review and ingest a captured discovery reference into the main Job catalog
   */
  async reviewReference(
    referenceId: string,
    action: 'ACCEPT' | 'REJECT',
    notes?: string
  ): Promise<{ status: DiscoveryReferenceStatus; message: string; jobId?: string }> {
    const reference = await this.db.jobDiscoveryReference.findUnique({
      where: { id: referenceId },
    });

    if (!reference) {
      throw AppError.notFound(`Discovery reference '${referenceId}' not found.`, 'REFERENCE_NOT_FOUND');
    }

    if (action === 'REJECT') {
      await this.db.jobDiscoveryReference.update({
        where: { id: referenceId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewNotes: notes || reference.reviewNotes,
        },
      });
      return { status: 'REJECTED', message: 'Reference rejected.' };
    }

    // Action === 'ACCEPT' -> Ingest into main Job pipeline
    // 1. Ensure a JobSource exists for the sourceSlug (e.g. 'linkedin')
    let source = await this.db.jobSource.findUnique({
      where: { slug: reference.sourceSlug },
    });

    if (!source) {
      source = await this.db.jobSource.create({
        data: {
          name: reference.sourceSlug === 'linkedin' ? 'LinkedIn' : 'Direct Employer Discovery',
          slug: reference.sourceSlug,
          type: 'SCRAPER',
          endpointUrl: 'https://www.linkedin.com/jobs',
          isActive: true,
          pollingInterval: 360,
        },
      });
    }

    // 2. Normalize reference into standard NormalizedJob
    const normalizedJob = this.lAdapter.normalizeReferenceToJob(reference, source);

    // 3. Upsert into main Job catalog
    const { job, isNew } = await this.jobsRepo.upsertJob(normalizedJob);

    // 4. Update reference to INGESTED
    await this.db.jobDiscoveryReference.update({
      where: { id: referenceId },
      data: {
        status: 'INGESTED',
        reviewedAt: new Date(),
        ingestedJobId: job.id,
        reviewNotes: notes || reference.reviewNotes,
      },
    });

    // 5. Trigger classification, alert evaluation, and telegram posting asynchronously
    if (process.env.NODE_ENV !== 'test') {
      setImmediate(() => {
        classificationService.processPendingJobs(10).catch((err) => {
          logger.error('Background classification error after intake ingestion:', err.message);
        });
        notificationsService.processPendingJobAlerts().catch((alertErr) => {
          logger.error('Background alert evaluation error after intake ingestion:', alertErr.message);
        });
        telegramPublisherService.processPendingEligibleJobs().catch((tgErr) => {
          logger.error('Background telegram publication processing error after intake ingestion:', tgErr.message);
        });
      });
    }

    logger.info(
      `[DiscoveryService] Reference ${referenceId} ingested into Job ${job.id} (isNew=${isNew})`
    );

    return {
      status: 'INGESTED',
      jobId: job.id,
      message: `Job ${isNew ? 'created' : 'updated'} successfully from intake reference.`,
    };
  }

  /**
   * Execute a single JobSearchDefinition run
   */
  async executeSearch(searchId: string): Promise<{
    success: boolean;
    resultsCount: number;
    newCount: number;
    duplicateCount: number;
    error?: string;
  }> {
    const search = await this.db.jobSearchDefinition.findUnique({
      where: { id: searchId },
    });

    if (!search) {
      throw AppError.notFound(`Search definition '${searchId}' not found.`, 'SEARCH_NOT_FOUND');
    }

    const run = await this.db.searchExecutionRun.create({
      data: {
        searchDefinitionId: search.id,
        status: 'RUNNING',
      },
    });

    const now = new Date();
    await this.db.jobSearchDefinition.update({
      where: { id: search.id },
      data: {
        lastRunAt: now,
        lastRunStatus: 'RUNNING',
      },
    });

    logger.info(`[DiscoveryService] Executing search '${search.queryText}' (${search.id})`);

    try {
      // In discovery mode: compute yield against matching references and catalogue
      // Query intake references matching this search query or category
      const matchingReferences = await this.db.jobDiscoveryReference.count({
        where: {
          searchDefinitionId: search.id,
        },
      });

      const nextRunAt = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours

      await this.db.searchExecutionRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          resultsCount: matchingReferences,
          newCount: 0,
          duplicateCount: 0,
        },
      });

      await this.db.jobSearchDefinition.update({
        where: { id: search.id },
        data: {
          lastSuccessAt: new Date(),
          nextRunAt,
          lastRunStatus: 'SUCCESS',
          consecutiveErrors: 0,
          lastError: null,
        },
      });

      return {
        success: true,
        resultsCount: matchingReferences,
        newCount: 0,
        duplicateCount: 0,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Search execution failure';
      logger.error(`[DiscoveryService] Search run ${run.id} failed: ${errorMsg}`);

      await this.db.searchExecutionRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorSummary: errorMsg.slice(0, 500),
        },
      });

      await this.db.jobSearchDefinition.update({
        where: { id: search.id },
        data: {
          lastRunStatus: 'FAILED',
          consecutiveErrors: { increment: 1 },
          lastError: errorMsg.slice(0, 500),
        },
      });

      return {
        success: false,
        resultsCount: 0,
        newCount: 0,
        duplicateCount: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Adaptive optimization loop:
   * 1. Evaluates category gaps
   * 2. Prompts AI planner for targeted queries on weak categories
   * 3. Saves newly generated searches into the registry
   */
  async runAdaptiveOptimization(): Promise<{
    gapsIdentified: number;
    newSearchesCreated: number;
    criticalGaps: string[];
  }> {
    logger.info('[DiscoveryService] Running adaptive coverage optimization...');

    const gaps = await this.registry.analyzeCoverageGaps();
    const criticalGaps = gaps.filter((g) => g.status === 'CRITICAL_GAP');

    if (criticalGaps.length === 0) {
      logger.info('[DiscoveryService] No critical coverage gaps found. Coverage is healthy.');
      return { gapsIdentified: 0, newSearchesCreated: 0, criticalGaps: [] };
    }

    logger.info(
      `[DiscoveryService] Identified ${criticalGaps.length} critical gaps: ` +
      criticalGaps.map((g) => g.categoryName).join(', ')
    );

    const targetedSearches = await this.planner.generateTargetedSearchesForGaps(criticalGaps);
    const saveResult = await this.registry.savePlannedSearches(targetedSearches);

    return {
      gapsIdentified: criticalGaps.length,
      newSearchesCreated: saveResult.created,
      criticalGaps: criticalGaps.map((g) => g.categoryName),
    };
  }
}

export const discoveryService = new DiscoveryService();

