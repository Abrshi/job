import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { geminiClassifier, GeminiClassifier } from './gemini.classifier';
import { evaluateClassificationStatus } from './classification.types';
import { Prisma } from '@prisma/client';

export class ClassificationService {
  constructor(private readonly classifier: GeminiClassifier = geminiClassifier) {}

  async classifyJobById(jobId: string): Promise<boolean> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      logger.warn(`Cannot classify job ${jobId}: record not found`);
      return false;
    }

    try {
      const output = await this.classifier.classifyJob(
        job.normalizedTitle || job.originalTitle,
        job.normalizedDescription || job.originalDescription
      );

      // Resolve category by slug, with fallback for legacy merged slugs if needed
      let category = await prisma.jobCategory.findUnique({
        where: { slug: output.categorySlug },
      });

      if (!category) {
        if (output.categorySlug === 'design-creative' || output.categorySlug === 'media') {
          category = await prisma.jobCategory.findUnique({
            where: { slug: 'media-design-creative' },
          });
        }
      }

      const { reviewStatus, jobStatus } = evaluateClassificationStatus(output.confidence);

      // In a transaction, supersede previous classifications and save new current classification
      await prisma.$transaction(async (tx) => {
        // 1. Mark existing classifications for this job as not current
        await tx.jobClassification.updateMany({
          where: { jobId: job.id, isCurrent: true },
          data: { isCurrent: false },
        });

        // 2. Create new classification record
        await tx.jobClassification.create({
          data: {
            jobId: job.id,
            categoryId: category?.id || null,
            predictedCategoryName: category?.name || output.categorySlug,
            predictedExperienceLevel: output.experienceLevel,
            confidence: new Prisma.Decimal(output.confidence),
            status: reviewStatus,
            explanation: output.explanation,
            extractedSkills: output.skills && output.skills.length > 0 ? output.skills : Prisma.DbNull,
            modelIdentifier: this.classifier.modelIdentifier,
            promptVersion: this.classifier.promptVersion,
            isCurrent: true,
          },
        });

        // 3. Update the Job with primary category and classification status
        await tx.job.update({
          where: { id: job.id },
          data: {
            categoryId: category?.id || job.categoryId,
            classificationStatus: jobStatus,
            classificationConfidence: new Prisma.Decimal(output.confidence),
            experienceLevel: job.experienceLevel || (output.experienceLevel !== 'UNSPECIFIED' ? output.experienceLevel : null),
          },
        });
      });

      logger.info(
        `Job ${job.id} classified as '${output.categorySlug}' with confidence ${output.confidence.toFixed(2)} (${jobStatus})`
      );
      return true;
    } catch (err: unknown) {
      logger.error(`Classification error for job ${job.id}:`, (err as Error).message);
      await prisma.job.update({
        where: { id: job.id },
        data: {
          classificationStatus: 'FAILED',
        },
      });
      return false;
    }
  }

  async processPendingJobs(batchSize = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingJobs = await prisma.job.findMany({
      where: { classificationStatus: 'PENDING' },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    let succeeded = 0;
    let failed = 0;

    for (const job of pendingJobs) {
      const ok = await this.classifyJobById(job.id);
      if (ok) succeeded++;
      else failed++;
    }

    return {
      processed: pendingJobs.length,
      succeeded,
      failed,
    };
  }
}

export const classificationService = new ClassificationService();
