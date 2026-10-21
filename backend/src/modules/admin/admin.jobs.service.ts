import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logAdminAction } from './admin.audit';
import { classificationService } from '../classification/classification.service';
import { Prisma, JobStatus, EmploymentType, ExperienceLevel, ClassificationStatus } from '@prisma/client';

export interface AdminJobQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  sourceId?: string;
  categoryId?: string;
  country?: string;
  isRemote?: boolean;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  status?: JobStatus;
  classificationStatus?: ClassificationStatus;
  sortBy?: 'publishedAt' | 'firstSeenAt' | 'closingDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export class AdminJobsService {
  async getJobs(options: AdminJobQueryOptions) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {};

    if (options.search) {
      const q = options.search.trim();
      where.OR = [
        { originalTitle: { contains: q } },
        { normalizedTitle: { contains: q } },
        { companyName: { contains: q } },
        { externalId: { contains: q } },
      ];
    }

    if (options.sourceId) where.sourceId = options.sourceId;
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.country) where.country = options.country;
    if (options.isRemote !== undefined) where.isRemote = options.isRemote;
    if (options.employmentType) where.employmentType = options.employmentType;
    if (options.experienceLevel) where.experienceLevel = options.experienceLevel;
    if (options.status) where.status = options.status;
    if (options.classificationStatus) where.classificationStatus = options.classificationStatus;

    const sortBy = options.sortBy || 'firstSeenAt';
    const sortOrder = options.sortOrder || 'desc';

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          source: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
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

  async getJobById(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, slug: true, endpointUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
        classifications: {
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!job) {
      throw AppError.notFound(`Job with id '${id}' not found`, 'JOB_NOT_FOUND');
    }

    return job;
  }

  async updateJobStatus(
    id: string,
    status: JobStatus,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw AppError.notFound(`Job with id '${id}' not found`, 'JOB_NOT_FOUND');
    }

    const previousStatus = job.status;
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status,
        expiredAt: status === 'EXPIRED' ? new Date() : job.expiredAt,
      },
      include: {
        source: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'JOB_STATUS_CHANGE',
      targetType: 'JOB',
      targetId: id,
      details: { previousStatus, newStatus: status, jobTitle: job.normalizedTitle },
      ipAddress,
    });

    return updated;
  }

  async triggerReclassification(
    id: string,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw AppError.notFound(`Job with id '${id}' not found`, 'JOB_NOT_FOUND');
    }

    const success = await classificationService.classifyJobById(id);
    if (!success) {
      throw AppError.badRequest('Failed to classify job', 'CLASSIFICATION_FAILED');
    }

    const updatedJob = await this.getJobById(id);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'JOB_RECLASSIFIED',
      targetType: 'JOB',
      targetId: id,
      details: {
        newCategory: updatedJob.category?.name,
        confidence: updatedJob.classificationConfidence,
        status: updatedJob.classificationStatus,
      },
      ipAddress,
    });

    return updatedJob;
  }
}

export const adminJobsService = new AdminJobsService();
