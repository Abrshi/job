import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';
import { geminiClassifier } from '../src/modules/classification/gemini.classifier';
import { evaluateClassificationStatus } from '../src/modules/classification/classification.types';
import { Prisma } from '@prisma/client';

interface ReclassifyOptions {
  dryRun?: boolean;
  limit?: number;
  misclassifiedOnly?: boolean;
  targetCategorySlug?: string;
  all?: boolean;
}

export async function reclassifyJobs(options: ReclassifyOptions = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes('--dry-run');
  const isAll = options.all ?? process.argv.includes('--all');
  const isMisclassifiedOnly =
    options.misclassifiedOnly ?? process.argv.includes('--misclassified-only');

  let limit = options.limit;
  const limitArgIdx = process.argv.indexOf('--limit');
  if (limitArgIdx !== -1 && process.argv[limitArgIdx + 1]) {
    limit = parseInt(process.argv[limitArgIdx + 1], 10);
  }

  logger.info(
    `Starting job reclassification (dryRun=${isDryRun}, all=${isAll}, misclassifiedOnly=${isMisclassifiedOnly}, limit=${limit || 'none'})`
  );

  // Build query filter
  const where: Prisma.JobWhereInput = {};

  if (isMisclassifiedOnly) {
    // Target categories with known high keyword-misclassification rates (e.g. software-it)
    where.category = {
      slug: 'software-it',
    };
  } else if (options.targetCategorySlug) {
    where.category = {
      slug: options.targetCategorySlug,
    };
  }

  const jobs = await prisma.job.findMany({
    where,
    take: limit,
    include: {
      category: true,
      classifications: {
        where: { isCurrent: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  logger.info(`Found ${jobs.length} jobs to evaluate.`);

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    scanned++;
    try {
      // 1. Guard against overwriting manual administrative overrides
      const currentCls = job.classifications[0];
      if (
        currentCls &&
        (currentCls.status === 'MANUALLY_REVIEWED' ||
          currentCls.modelIdentifier === 'admin-manual-override')
      ) {
        logger.info(`[SKIP] Job "${job.normalizedTitle}" (${job.id}) has manual admin override.`);
        skipped++;
        continue;
      }

      // 2. Classify with revised high-accuracy heuristic engine
      const output = geminiClassifier.classifyHeuristic(
        job.normalizedTitle || job.originalTitle,
        job.normalizedDescription || job.originalDescription
      );

      // Resolve category by slug, with fallback for legacy merged slugs if needed
      let targetCategory = await prisma.jobCategory.findUnique({
        where: { slug: output.categorySlug },
      });

      if (!targetCategory) {
        if (output.categorySlug === 'design-creative' || output.categorySlug === 'media') {
          targetCategory = await prisma.jobCategory.findUnique({
            where: { slug: 'media-design-creative' },
          });
        }
      }

      const previousCategorySlug = job.category?.slug || 'UNCATEGORIZED';
      const newCategorySlug = targetCategory?.slug || output.categorySlug;

      if (job.categoryId === targetCategory?.id) {
        unchanged++;
        continue;
      }

      logger.info(
        `[RECLASSIFY] Job "${job.normalizedTitle}" (${job.id.slice(0, 8)}): ` +
          `'${previousCategorySlug}' -> '${newCategorySlug}' (${output.explanation})`
      );

      if (!isDryRun && targetCategory) {
        const { reviewStatus, jobStatus } = evaluateClassificationStatus(output.confidence);

        await prisma.$transaction(async (tx) => {
          // Supersede old classifications
          await tx.jobClassification.updateMany({
            where: { jobId: job.id, isCurrent: true },
            data: { isCurrent: false },
          });

          // Insert new classification record
          await tx.jobClassification.create({
            data: {
              jobId: job.id,
              categoryId: targetCategory.id,
              predictedCategoryName: targetCategory.name,
              predictedExperienceLevel: output.experienceLevel,
              confidence: new Prisma.Decimal(output.confidence),
              status: reviewStatus,
              explanation: output.explanation,
              extractedSkills:
                output.skills && output.skills.length > 0 ? output.skills : Prisma.DbNull,
              modelIdentifier: geminiClassifier.modelIdentifier,
              promptVersion: geminiClassifier.promptVersion,
              isCurrent: true,
            },
          });

          // Update job
          await tx.job.update({
            where: { id: job.id },
            data: {
              categoryId: targetCategory.id,
              classificationStatus: jobStatus,
              classificationConfidence: new Prisma.Decimal(output.confidence),
              experienceLevel:
                job.experienceLevel ||
                (output.experienceLevel !== 'UNSPECIFIED' ? output.experienceLevel : null),
            },
          });
        });
      }

      updated++;
    } catch (err: unknown) {
      failed++;
      logger.error(`Failed to reclassify job ${job.id}:`, (err as Error).message);
    }
  }

  const summary = {
    scanned,
    updated,
    unchanged,
    skipped,
    failed,
    dryRun: isDryRun,
  };

  logger.info('Reclassification complete. Summary:', summary);
  return summary;
}

if (require.main === module) {
  reclassifyJobs()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Reclassification script failed:', err);
      process.exit(1);
    });
}

