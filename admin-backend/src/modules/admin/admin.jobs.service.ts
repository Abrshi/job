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

  async updateJob(
    id: string,
    data: {
      title?: string;
      companyName?: string;
      city?: string;
      country?: string;
      isRemote?: boolean;
      workArrangement?: any;
      employmentType?: any;
      experienceLevel?: any;
      salaryMin?: number | null;
      salaryMax?: number | null;
      salaryCurrency?: string;
      salaryPeriod?: any;
      status?: JobStatus;
      categoryId?: string | null;
      applicationUrl?: string;
      originalUrl?: string;
      description?: string;
    },
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw AppError.notFound(`Job with id '${id}' not found`, 'JOB_NOT_FOUND');
    }

    const updateData: any = {};
    if (data.title !== undefined) {
      updateData.normalizedTitle = data.title;
      updateData.originalTitle = data.title;
    }
    if (data.companyName !== undefined) updateData.companyName = data.companyName;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.isRemote !== undefined) updateData.isRemote = data.isRemote;
    if (data.workArrangement !== undefined) updateData.workArrangement = data.workArrangement;
    if (data.employmentType !== undefined) updateData.employmentType = data.employmentType;
    if (data.experienceLevel !== undefined) updateData.experienceLevel = data.experienceLevel;
    if (data.salaryMin !== undefined) updateData.salaryMin = data.salaryMin;
    if (data.salaryMax !== undefined) updateData.salaryMax = data.salaryMax;
    if (data.salaryCurrency !== undefined) updateData.salaryCurrency = data.salaryCurrency;
    if (data.salaryPeriod !== undefined) updateData.salaryPeriod = data.salaryPeriod;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'EXPIRED') updateData.expiredAt = new Date();
    }
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.applicationUrl !== undefined) updateData.applicationUrl = data.applicationUrl;
    if (data.originalUrl !== undefined) updateData.originalUrl = data.originalUrl;
    if (data.description !== undefined) {
      updateData.normalizedDescription = data.description;
      updateData.originalDescription = data.description;
    }

    const updated = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        source: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'JOB_UPDATED',
      targetType: 'JOB',
      targetId: id,
      details: { updatedFields: Object.keys(updateData), title: updated.normalizedTitle },
      ipAddress,
    });

    return updated;
  }

  async deleteJob(
    id: string,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      throw AppError.notFound(`Job with id '${id}' not found`, 'JOB_NOT_FOUND');
    }

    await prisma.job.delete({ where: { id } });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'JOB_DELETED',
      targetType: 'JOB',
      targetId: id,
      details: { title: job.normalizedTitle, company: job.companyName },
      ipAddress,
    });

    return { deleted: true };
  }

  async bulkUpdateJobStatus(
    ids: string[],
    status: JobStatus,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw AppError.badRequest('At least one job ID must be provided', 'INVALID_JOB_IDS');
    }

    const updateData: any = { status };
    if (status === 'EXPIRED') updateData.expiredAt = new Date();

    const result = await prisma.job.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'JOB_BULK_STATUS_CHANGE',
      targetType: 'JOB',
      details: { targetIds: ids, count: result.count, newStatus: status },
      ipAddress,
    });

    return { count: result.count };
  }
}

export const adminJobsService = new AdminJobsService();
