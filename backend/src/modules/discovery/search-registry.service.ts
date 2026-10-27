import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import {
  PlannedSearchItem,
  CoverageGapAnalysis,
  DiscoveryStats,
} from './discovery.types';
import { PROFESSIONAL_TAXONOMY } from './taxonomy-data';
import { computeSearchIdentity } from './ai-search-planner.service';
import { linkedinAdapter } from './adapters/linkedin.adapter';
import { SearchDefinitionStatus, Prisma } from '@prisma/client';

export class SearchRegistryService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Persist a batch of planned searches into the adaptive registry
   */
  async savePlannedSearches(searches: PlannedSearchItem[]): Promise<{
    created: number;
    updated: number;
    skipped: number;
  }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of searches) {
      if (!item.queryText || !item.categorySlug) {
        skipped++;
        continue;
      }

      const normalizedIdentity = computeSearchIdentity(
        item.categorySlug,
        item.queryText,
        item.targetLocation,
        item.workArrangement
      );

      // Pre-compute LinkedIn discovery search link for administrative reference
      const linkedinSearchUrl = linkedinAdapter.generateSearchUrl(item.queryText, {
        location: item.targetLocation || 'Ethiopia',
        remoteOnly: item.workArrangement === 'REMOTE',
      });

      const mergedMetadata = {
        ...(item.metadata || {}),
        tags: item.tags || [],
        linkedinSearchUrl,
        plannedAt: new Date().toISOString(),
      };

      try {
        const existing = await this.db.jobSearchDefinition.findUnique({
          where: { normalizedIdentity },
        });

        if (existing) {
          await this.db.jobSearchDefinition.update({
            where: { id: existing.id },
            data: {
              priority: item.priority || existing.priority,
              subcategory: item.subcategory || existing.subcategory,
              targetLocation: item.targetLocation || existing.targetLocation,
              workArrangement: item.workArrangement || existing.workArrangement,
              metadata: mergedMetadata,
            },
          });
          updated++;
        } else {
          await this.db.jobSearchDefinition.create({
            data: {
              normalizedIdentity,
              queryText: item.queryText,
              categorySlug: item.categorySlug,
              subcategory: item.subcategory,
              targetLocation: item.targetLocation || 'Ethiopia',
              workArrangement: item.workArrangement,
              employmentType: item.employmentType,
              experienceLevel: item.experienceLevel,
              sourceSlug: item.sourceSlug || 'all',
              collectionMethod: item.collectionMethod || 'AUTO',
              status: 'ACTIVE',
              priority: item.priority || 5,
              isAIGenerated: true,
              metadata: mergedMetadata,
            },
          });
          created++;
        }
      } catch (err: any) {
        logger.error(`[SearchRegistry] Failed to save search '${item.queryText}': ${err.message}`);
        skipped++;
      }
    }

    logger.info(`[SearchRegistry] Batch save: created=${created}, updated=${updated}, skipped=${skipped}`);
    return { created, updated, skipped };
  }

  /**
   * Get search definitions with filtering and pagination
   */
  async getSearches(options: {
    categorySlug?: string;
    status?: SearchDefinitionStatus;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.JobSearchDefinitionWhereInput = {};

    if (options.categorySlug) {
      where.categorySlug = options.categorySlug;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.search) {
      where.OR = [
        { queryText: { contains: options.search, mode: 'insensitive' } },
        { subcategory: { contains: options.search, mode: 'insensitive' } },
        { targetLocation: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, searches] = await Promise.all([
      this.db.jobSearchDefinition.count({ where }),
      this.db.jobSearchDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      searches,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update search definition status (ACTIVE, PAUSED, DISABLED)
   */
  async updateStatus(id: string, status: SearchDefinitionStatus) {
    return this.db.jobSearchDefinition.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete a search definition
   */
  async deleteSearch(id: string) {
    return this.db.jobSearchDefinition.delete({
      where: { id },
    });
  }

  /**
   * Analyze coverage gaps across all 20 professional categories
   */
  async analyzeCoverageGaps(): Promise<CoverageGapAnalysis[]> {
    const categories = Object.values(PROFESSIONAL_TAXONOMY);
    const gapAnalysis: CoverageGapAnalysis[] = [];

    // Gather active search counts per category
    const searchCounts = await this.db.jobSearchDefinition.groupBy({
      by: ['categorySlug'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });

    const searchCountMap = new Map<string, number>();
    for (const sc of searchCounts) {
      searchCountMap.set(sc.categorySlug, sc._count.id);
    }

    // Gather discovered job counts per category
    const jobCategories = await this.db.jobCategory.findMany({
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });

    const jobCountMap = new Map<string, number>();
    for (const jc of jobCategories) {
      jobCountMap.set(jc.slug, jc._count.jobs);
    }

    for (const cat of categories) {
      const activeSearches = searchCountMap.get(cat.slug) || 0;
      const discoveredJobs = jobCountMap.get(cat.slug) || 0;

      // Score formula: based on active queries (max 50 pts) and discovered jobs (max 50 pts)
      const searchScore = Math.min((activeSearches / 6) * 50, 50);
      const yieldScore = Math.min((discoveredJobs / 20) * 50, 50);
      const coverageScore = Math.round(searchScore + yieldScore);

      let status: 'ADEQUATE' | 'MODERATE' | 'CRITICAL_GAP';
      if (activeSearches < 2 || coverageScore < 30) {
        status = 'CRITICAL_GAP';
      } else if (activeSearches < 4 || coverageScore < 60) {
        status = 'MODERATE';
      } else {
        status = 'ADEQUATE';
      }

      // Generate suggested targeted queries if under-covered
      const suggestedQueries = [
        `${cat.titles[0]} Vacancies Ethiopia`,
        `${cat.titles[1] || cat.titles[0]} Addis Ababa`,
        `Junior ${cat.titles[0]} Ethiopia`,
      ];

      gapAnalysis.push({
        categorySlug: cat.slug,
        categoryName: cat.name,
        activeSearchCount: activeSearches,
        totalDiscoveredCount: discoveredJobs,
        coverageScore,
        status,
        suggestedQueries,
      });
    }

    return gapAnalysis.sort((a, b) => a.coverageScore - b.coverageScore);
  }

  /**
   * Aggregate system-wide discovery telemetry
   */
  async getDiscoveryStats(): Promise<DiscoveryStats> {
    const [
      totalSearches,
      activeSearches,
      pausedSearches,
      yieldStats,
      pendingIntake,
      recentFailures,
    ] = await Promise.all([
      this.db.jobSearchDefinition.count(),
      this.db.jobSearchDefinition.count({ where: { status: 'ACTIVE' } }),
      this.db.jobSearchDefinition.count({ where: { status: 'PAUSED' } }),
      this.db.jobSearchDefinition.aggregate({
        _sum: {
          totalResults: true,
          newJobsFound: true,
          duplicatesFound: true,
        },
      }),
      this.db.jobDiscoveryReference.count({ where: { status: 'PENDING_REVIEW' } }),
      this.db.searchExecutionRun.count({
        where: {
          status: 'FAILED',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalDiscovered = yieldStats._sum.totalResults || 0;
    const newJobsFound = yieldStats._sum.newJobsFound || 0;
    const duplicatesFound = yieldStats._sum.duplicatesFound || 0;
    const overallDuplicateRate = totalDiscovered > 0
      ? Math.round((duplicatesFound / totalDiscovered) * 100)
      : 0;

    const gaps = await this.analyzeCoverageGaps();
    const categoriesCount = gaps.length;
    const coveredCategoriesCount = gaps.filter((g) => g.status === 'ADEQUATE').length;
    const weakCategoriesCount = gaps.filter((g) => g.status === 'CRITICAL_GAP').length;

    const totalScore = gaps.reduce((acc, g) => acc + g.coverageScore, 0);
    const coverageHealthPercentage = categoriesCount > 0
      ? Math.round(totalScore / categoriesCount)
      : 0;

    return {
      totalSearches,
      activeSearches,
      pausedSearches,
      totalDiscovered,
      newJobsFound,
      duplicatesFound,
      overallDuplicateRate,
      categoriesCount,
      coveredCategoriesCount,
      weakCategoriesCount,
      pendingIntakeReferences: pendingIntake,
      recentFailuresCount: recentFailures,
      coverageHealthPercentage,
    };
  }
}

export const searchRegistryService = new SearchRegistryService();
