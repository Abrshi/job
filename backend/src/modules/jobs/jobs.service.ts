import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { JobQueryInput } from './jobs.validation';
import { Prisma } from '@prisma/client';

export class JobsService {
  /**
   * Search and filter publicly available jobs
   */
  async getPublicJobs(options: JobQueryInput, currentUserId?: string) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;
    const now = new Date();

    const minSalary =
      options.minSalary !== undefined && options.minSalary !== null && !isNaN(Number(options.minSalary))
        ? Number(options.minSalary)
        : undefined;

    const maxSalary =
      options.maxSalary !== undefined && options.maxSalary !== null && !isNaN(Number(options.maxSalary))
        ? Number(options.maxSalary)
        : undefined;

    const andConditions: Prisma.JobWhereInput[] = [
      { status: 'ACTIVE' },
      {
        classificationStatus: {
          notIn: ['FAILED', 'REVIEW_REQUIRED'],
        },
      },
      {
        OR: [
          { closingDate: null },
          { closingDate: { gte: now } },
        ],
      },
    ];

    // Keyword Search across title, company, description
    if (options.search) {
      const q = options.search.trim();
      andConditions.push({
        OR: [
          { normalizedTitle: { contains: q } },
          { originalTitle: { contains: q } },
          { companyName: { contains: q } },
          { normalizedDescription: { contains: q } },
        ],
      });
    }

    // Category Filter (support slug or UUID)
    if (options.category) {
      const cat = options.category.trim();
      andConditions.push({
        category: {
          OR: [{ slug: cat }, { id: cat }],
        },
      });
    }

    // Location Filters
    if (options.city) {
      andConditions.push({ city: { contains: options.city.trim() } });
    }
    if (options.country) {
      andConditions.push({ country: { contains: options.country.trim() } });
    }

    // Work Arrangement Filter
    if (options.workArrangement) {
      andConditions.push({ workArrangement: options.workArrangement });
    }

    // Employment Type Filter
    if (options.employmentType) {
      andConditions.push({ employmentType: options.employmentType });
    }

    // Experience Level Filter
    if (options.experienceLevel) {
      andConditions.push({ experienceLevel: options.experienceLevel });
    }

    // Salary Range Filters
    if (minSalary !== undefined) {
      andConditions.push({
        OR: [
          { salaryMin: { gte: new Prisma.Decimal(minSalary) } },
          { salaryMax: { gte: new Prisma.Decimal(minSalary) } },
        ],
      });
    }

    if (maxSalary !== undefined) {
      andConditions.push({
        OR: [
          { salaryMin: { lte: new Prisma.Decimal(maxSalary) } },
          { salaryMax: { lte: new Prisma.Decimal(maxSalary) } },
        ],
      });
    }

    const where: Prisma.JobWhereInput = { AND: andConditions };

    // Sorting
    let orderBy: Prisma.JobOrderByWithRelationInput = { publishedAt: 'desc' };
    if (options.sortBy === 'firstSeenAt') {
      orderBy = { firstSeenAt: options.sortOrder || 'desc' };
    } else if (options.sortBy === 'closingDate') {
      // Prioritize jobs closing soon
      orderBy = { closingDate: options.sortOrder || 'asc' };
    } else {
      orderBy = { publishedAt: options.sortOrder || 'desc' };
    }

    const [rawJobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          originalTitle: true,
          normalizedTitle: true,
          companyName: true,
          city: true,
          country: true,
          isRemote: true,
          workArrangement: true,
          remoteEligibility: true,
          employmentType: true,
          experienceLevel: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          salaryPeriod: true,
          publishedAt: true,
          closingDate: true,
          firstSeenAt: true,
          applicationMethod: true,
          applicationUrl: true,
          originalUrl: true,
          source: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    // Check saved state for current user
    let savedJobIds = new Set<string>();
    if (currentUserId && rawJobs.length > 0) {
      const saved = await prisma.savedJob.findMany({
        where: {
          userId: currentUserId,
          jobId: { in: rawJobs.map((j) => j.id) },
        },
        select: { jobId: true },
      });
      savedJobIds = new Set(saved.map((s) => s.jobId));
    }

    const jobs = rawJobs.map((j) => ({
      ...j,
      title: j.normalizedTitle || j.originalTitle,
      isSaved: savedJobIds.has(j.id),
    }));

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieve full details for a single job
   */
  async getPublicJobById(id: string, currentUserId?: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        originalTitle: true,
        normalizedTitle: true,
        originalDescription: true,
        normalizedDescription: true,
        companyName: true,
        city: true,
        country: true,
        isRemote: true,
        workArrangement: true,
        remoteEligibility: true,
        employmentType: true,
        experienceLevel: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryPeriod: true,
        publishedAt: true,
        closingDate: true,
        firstSeenAt: true,
        status: true,
        classificationStatus: true,
        applicationMethod: true,
        applicationUrl: true,
        originalUrl: true,
        source: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!job) {
      throw AppError.notFound('Job listing not found', 'JOB_NOT_FOUND');
    }

    // Verify visibility rules: do not expose unreviewed/rejected jobs to public seekers
    if (
      job.classificationStatus === 'REVIEW_REQUIRED' ||
      job.classificationStatus === 'FAILED'
    ) {
      throw AppError.notFound('This job is currently pending review and is not publicly visible', 'JOB_NOT_AVAILABLE');
    }

    const now = new Date();
    const isExpired = job.status === 'EXPIRED' || (job.closingDate && job.closingDate < now);

    let isSaved = false;
    let hasApplied = false;
    let applicationStatus: string | null = null;
    let applicationId: string | null = null;

    if (currentUserId) {
      const [saved, application] = await Promise.all([
        prisma.savedJob.findUnique({
          where: {
            userId_jobId: {
              userId: currentUserId,
              jobId: job.id,
            },
          },
        }),
        prisma.jobApplication.findFirst({
          where: {
            userId: currentUserId,
            jobId: job.id,
            isArchived: false,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
          },
        }),
      ]);

      isSaved = Boolean(saved);
      hasApplied = Boolean(application && application.status !== 'WITHDRAWN');
      applicationStatus = application?.status || null;
      applicationId = application?.id || null;
    }

    return {
      ...job,
      title: job.normalizedTitle || job.originalTitle,
      description: job.normalizedDescription || job.originalDescription,
      isExpired,
      isSaved,
      hasApplied,
      applicationStatus,
      applicationId,
    };
  }

  /**
   * Retrieve active job categories with live job counts
   */
  async getCategories() {
    const now = new Date();
    const categories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: {
          select: {
            jobs: {
              where: {
                status: 'ACTIVE',
                classificationStatus: { notIn: ['FAILED', 'REVIEW_REQUIRED'] },
                OR: [{ closingDate: null }, { closingDate: { gte: now } }],
              },
            },
          },
        },
      },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      jobCount: c._count.jobs,
    }));
  }

  /**
   * Save a job for the authenticated user
   */
  async saveJob(userId: string, jobId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw AppError.notFound('Job listing not found', 'JOB_NOT_FOUND');
    }

    const saved = await prisma.savedJob.upsert({
      where: {
        userId_jobId: { userId, jobId },
      },
      create: {
        userId,
        jobId,
      },
      update: {},
    });

    return { saved: true, savedJobId: saved.id };
  }

  /**
   * Unsave a job for the authenticated user
   */
  async unsaveJob(userId: string, jobId: string) {
    await prisma.savedJob.deleteMany({
      where: {
        userId,
        jobId,
      },
    });

    return { saved: false };
  }

  /**
   * List saved jobs for the authenticated user
   */
  async getSavedJobs(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const now = new Date();

    const [savedRecords, total] = await Promise.all([
      prisma.savedJob.findMany({
        where: { userId },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              originalTitle: true,
              normalizedTitle: true,
              companyName: true,
              city: true,
              country: true,
              isRemote: true,
              workArrangement: true,
              employmentType: true,
              experienceLevel: true,
              salaryMin: true,
              salaryMax: true,
              salaryCurrency: true,
              salaryPeriod: true,
              publishedAt: true,
              closingDate: true,
              status: true,
              applicationMethod: true,
              applicationUrl: true,
              originalUrl: true,
              source: { select: { id: true, name: true, slug: true } },
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.savedJob.count({ where: { userId } }),
    ]);

    const jobs = savedRecords.map((record) => {
      const isExpired =
        record.job.status === 'EXPIRED' ||
        (record.job.closingDate && record.job.closingDate < now);

      return {
        savedAt: record.createdAt,
        isExpired,
        ...record.job,
        title: record.job.normalizedTitle || record.job.originalTitle,
        isSaved: true,
      };
    });

    return {
      jobs,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Submit an internal job application
   */
  async applyForJob(userId: string, jobId: string, coverNote?: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        normalizedTitle: true,
        originalTitle: true,
        companyName: true,
        status: true,
        closingDate: true,
        applicationMethod: true,
        applicationUrl: true,
        originalUrl: true,
      },
    });

    if (!job) {
      throw AppError.notFound('Job listing not found', 'JOB_NOT_FOUND');
    }

    if (job.status !== 'ACTIVE') {
      throw AppError.badRequest('This job position is no longer accepting applications', 'JOB_INACTIVE');
    }

    if (job.closingDate && job.closingDate < new Date()) {
      throw AppError.badRequest('The application deadline for this job has passed', 'JOB_DEADLINE_PASSED');
    }

    // Check application method
    if (job.applicationMethod === 'EXTERNAL') {
      throw AppError.badRequest(
        'This job requires applying directly on the source platform',
        'EXTERNAL_APPLICATION_REQUIRED',
        [{ field: 'applicationUrl', message: job.applicationUrl || job.originalUrl }]
      );
    }

    // Verify user account and email verification requirements
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isEmailVerified: true },
    });

    if (!user) {
      throw AppError.unauthorized('User account not found', 'USER_NOT_FOUND');
    }

    if (!user.isEmailVerified) {
      throw AppError.forbidden(
        'Please verify your email address before submitting job applications.',
        'EMAIL_NOT_VERIFIED'
      );
    }

    // Prevent duplicate active applications
    const existingApplication = await prisma.jobApplication.findFirst({
      where: {
        userId,
        jobId,
        status: { in: ['DRAFT', 'APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER'] },
      },
    });

    if (existingApplication) {
      throw AppError.conflict(
        'You have already submitted an application for this position',
        'APPLICATION_ALREADY_EXISTS'
      );
    }

    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.jobApplication.create({
        data: {
          userId,
          jobId,
          source: 'PLATFORM',
          status: 'APPLIED',
          activeKey: `${userId}_${jobId}`,
          jobTitle: job.normalizedTitle || job.originalTitle,
          companyName: job.companyName || 'Unknown Company',
          coverNote: coverNote ? coverNote.trim() : null,
          appliedAt: new Date(),
        },
        include: {
          job: {
            select: {
              id: true,
              originalTitle: true,
              normalizedTitle: true,
              companyName: true,
            },
          },
        },
      });

      await tx.jobApplicationHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: null,
          toStatus: 'APPLIED',
          reason: 'Direct platform application submission',
          changedByUserId: userId,
        },
      });

      return app;
    });

    return {
      applicationId: application.id,
      status: application.status,
      submittedAt: application.createdAt,
      jobTitle: application.job?.normalizedTitle || application.job?.originalTitle,
      companyName: application.job?.companyName,
    };
  }

  /**
   * List application history for the authenticated user
   */
  async getUserApplications(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [applications, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where: { userId },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              originalTitle: true,
              normalizedTitle: true,
              companyName: true,
              city: true,
              country: true,
              workArrangement: true,
              employmentType: true,
              status: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      prisma.jobApplication.count({ where: { userId } }),
    ]);

    return {
      applications: applications.map((app) => ({
        id: app.id,
        status: app.status,
        coverNote: app.coverNote,
        submittedAt: app.appliedAt || app.createdAt,
        updatedAt: app.updatedAt,
        job: app.job
          ? {
              id: app.job.id,
              title: app.job.normalizedTitle || app.job.originalTitle,
              companyName: app.job.companyName,
              city: app.job.city,
              country: app.job.country,
              workArrangement: app.job.workArrangement,
              employmentType: app.job.employmentType,
              status: app.job.status,
              categoryName: app.job.category?.name || 'General',
            }
          : {
              id: null,
              title: app.jobTitle,
              companyName: app.companyName,
              city: app.location,
              country: null,
              workArrangement: null,
              employmentType: null,
              status: null,
              categoryName: 'External',
            },
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }
}

export const jobsService = new JobsService();
