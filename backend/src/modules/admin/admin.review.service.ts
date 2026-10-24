import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logAdminAction } from './admin.audit';
import { Prisma, ExperienceLevel } from '@prisma/client';

export class AdminReviewService {
  async getCategories() {
    const categories = await prisma.jobCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { jobs: true },
        },
      },
    });

    return categories;
  }

  async getPendingReviews(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      OR: [
        { classificationStatus: 'REVIEW_REQUIRED' },
        { classificationConfidence: { lt: new Prisma.Decimal(0.85) } },
      ],
      status: 'ACTIVE',
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { firstSeenAt: 'desc' },
        include: {
          source: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          classifications: {
            where: { isCurrent: true },
            take: 1,
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    return {
      jobs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async acceptClassification(jobId: string, admin: { id: string; email: string }, ipAddress?: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        classifications: {
          where: { isCurrent: true },
          take: 1,
        },
      },
    });

    if (!job) {
      throw AppError.notFound(`Job with id '${jobId}' not found`, 'JOB_NOT_FOUND');
    }

    const currentCls = job.classifications[0];
    if (!currentCls) {
      throw AppError.badRequest('No current classification found to accept', 'NO_CLASSIFICATION');
    }

    await prisma.$transaction(async (tx) => {
      await tx.jobClassification.update({
        where: { id: currentCls.id },
        data: { status: 'MANUALLY_REVIEWED' },
      });

      await tx.job.update({
        where: { id: jobId },
        data: {
          classificationStatus: 'CLASSIFIED',
          categoryId: currentCls.categoryId,
        },
      });
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLASSIFICATION_ACCEPTED',
      targetType: 'JOB',
      targetId: jobId,
      details: {
        categoryName: currentCls.predictedCategoryName,
        experienceLevel: currentCls.predictedExperienceLevel,
        confidence: currentCls.confidence,
      },
      ipAddress,
    });

    return { success: true };
  }

  async overrideClassification(
    jobId: string,
    input: {
      categoryId?: string;
      categorySlug?: string;
      experienceLevel?: ExperienceLevel;
      explanation?: string;
    },
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw AppError.notFound(`Job with id '${jobId}' not found`, 'JOB_NOT_FOUND');
    }

    // Resolve category
    let targetCategory = null;
    if (input.categoryId) {
      targetCategory = await prisma.jobCategory.findUnique({ where: { id: input.categoryId } });
    } else if (input.categorySlug) {
      targetCategory = await prisma.jobCategory.findUnique({ where: { slug: input.categorySlug } });
    }

    const finalCategoryId = targetCategory ? targetCategory.id : job.categoryId;
    const finalCategoryName = targetCategory ? targetCategory.name : 'Unspecified';
    const finalExperienceLevel = input.experienceLevel || job.experienceLevel;

    await prisma.$transaction(async (tx) => {
      // 1. Mark previous classifications as superseded
      await tx.jobClassification.updateMany({
        where: { jobId, isCurrent: true },
        data: { isCurrent: false },
      });

      // 2. Create new manual classification entry
      await tx.jobClassification.create({
        data: {
          jobId,
          categoryId: finalCategoryId,
          predictedCategoryName: finalCategoryName,
          predictedExperienceLevel: finalExperienceLevel,
          confidence: new Prisma.Decimal(1.0), // Manual admin override has certainty 1.00
          status: 'MANUALLY_REVIEWED',
          explanation: input.explanation || `Manual categorization by administrator ${admin.email}`,
          modelIdentifier: 'admin-manual-override',
          promptVersion: 'manual-v1',
          isCurrent: true,
        },
      });

      // 3. Update Job
      await tx.job.update({
        where: { id: jobId },
        data: {
          categoryId: finalCategoryId,
          experienceLevel: finalExperienceLevel,
          classificationStatus: 'CLASSIFIED',
          classificationConfidence: new Prisma.Decimal(1.0),
        },
      });
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLASSIFICATION_OVERRIDDEN',
      targetType: 'JOB',
      targetId: jobId,
      details: {
        categoryName: finalCategoryName,
        experienceLevel: finalExperienceLevel,
        adminExplanation: input.explanation,
      },
      ipAddress,
    });

    return { success: true };
  }
}

export const adminReviewService = new AdminReviewService();
