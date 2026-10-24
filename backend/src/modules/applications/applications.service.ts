import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { ApplicationStatus, ApplicationSource, InterviewType, InterviewOutcome, Prisma } from '@prisma/client';

export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['IN_REVIEW', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  IN_REVIEW: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'APPLIED'],
  INTERVIEW: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'IN_REVIEW'],
  OFFER: ['REJECTED', 'WITHDRAWN', 'INTERVIEW'],
  REJECTED: ['IN_REVIEW', 'INTERVIEW', 'APPLIED'],
  WITHDRAWN: ['APPLIED'],
};

export const ACTIVE_STATUSES: ApplicationStatus[] = [
  'DRAFT',
  'APPLIED',
  'IN_REVIEW',
  'INTERVIEW',
  'OFFER',
];

export interface ListApplicationsQuery {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'next_interview' | 'company_asc';
  archived?: boolean;
}

export interface CreateApplicationDto {
  source: ApplicationSource;
  status?: ApplicationStatus;
  jobId?: string;
  documentId?: string;
  coverNoteText?: string;
  externalCompanyName?: string;
  externalJobTitle?: string;
  externalJobUrl?: string;
  externalLocation?: string;
  externalSalary?: string;
  appliedAt?: string;
  notes?: string;
}

export interface UpdateApplicationDto {
  externalCompanyName?: string;
  externalJobTitle?: string;
  externalJobUrl?: string;
  externalLocation?: string;
  externalSalary?: string;
  appliedAt?: string;
  documentId?: string;
  coverNoteText?: string;
  notes?: string;
  isArchived?: boolean;
}

export interface ScheduleInterviewDto {
  roundNumber?: number;
  title: string;
  interviewType?: InterviewType;
  scheduledAt: string;
  timezone?: string;
  durationMinutes?: number;
  locationUrl?: string;
  interviewerInfo?: string;
  preparationNotes?: string;
  feedbackNotes?: string;
  outcome?: InterviewOutcome;
}

export interface UpdateInterviewDto {
  roundNumber?: number;
  title?: string;
  interviewType?: InterviewType;
  scheduledAt?: string;
  timezone?: string;
  durationMinutes?: number;
  locationUrl?: string;
  interviewerInfo?: string;
  preparationNotes?: string;
  feedbackNotes?: string;
  outcome?: InterviewOutcome;
}

export interface CreateReminderDto {
  title: string;
  remindAt: string;
  notes?: string;
}

export interface UpdateReminderDto {
  title?: string;
  remindAt?: string;
  isCompleted?: boolean;
  notes?: string;
}

export class ApplicationsService {
  /**
   * Helper to compute the active unique key for duplicate prevention
   */
  private computeActiveKey(
    source: ApplicationSource,
    userId: string,
    jobId?: string | null,
    status: ApplicationStatus = 'APPLIED'
  ): string | null {
    if (source === 'PLATFORM' && jobId && ACTIVE_STATUSES.includes(status)) {
      return `${userId}_${jobId}`;
    }
    return null;
  }

  /**
   * List candidate applications with search, status, and source filters
   */
  async listApplications(userId: string, query: ListApplicationsQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 15));
    const skip = (page - 1) * limit;

    const where: Prisma.JobApplicationWhereInput = {
      userId,
      isArchived: query.archived ?? false,
    };

    // Filter by Status
    if (query.status && query.status !== 'ALL') {
      if (query.status === 'ACTIVE') {
        where.status = { in: ACTIVE_STATUSES };
      } else {
        where.status = query.status as ApplicationStatus;
      }
    }

    // Filter by Source
    if (query.source && query.source !== 'ALL') {
      where.source = query.source as ApplicationSource;
    }

    // Keyword Search
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { companyName: { contains: term } },
        { jobTitle: { contains: term } },
        { notes: { contains: term } },
        { location: { contains: term } },
      ];
    }

    // Sorting
    let orderBy: Prisma.JobApplicationOrderByWithRelationInput[] = [{ appliedAt: 'desc' }];
    if (query.sort === 'oldest') {
      orderBy = [{ appliedAt: 'asc' }];
    } else if (query.sort === 'company_asc') {
      orderBy = [{ companyName: 'asc' }, { appliedAt: 'desc' }];
    }

    const [applications, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
              salaryMin: true,
              salaryMax: true,
              salaryCurrency: true,
              status: true,
              applicationMethod: true,
              applicationUrl: true,
              originalUrl: true,
            },
          },
          document: {
            select: {
              id: true,
              originalFilename: true,
              mimeType: true,
              fileSize: true,
            },
          },
          interviews: {
            where: { outcome: 'PENDING' },
            orderBy: { scheduledAt: 'asc' },
            take: 1,
            select: {
              id: true,
              roundNumber: true,
              title: true,
              scheduledAt: true,
              timezone: true,
              interviewType: true,
            },
          },
          _count: {
            select: {
              interviews: true,
              reminders: true,
              history: true,
            },
          },
        },
      }),
      prisma.jobApplication.count({ where }),
    ]);

    const formattedApplications = applications.map((app) => ({
      id: app.id,
      source: app.source,
      status: app.status,
      appliedAt: app.appliedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      isArchived: app.isArchived,
      notes: app.notes,
      title: app.jobTitle,
      companyName: app.companyName,
      jobTitle: app.jobTitle,
      externalCompanyName: app.companyName,
      externalJobTitle: app.jobTitle,
      externalJobUrl: app.jobUrl,
      externalLocation: app.location,
      externalSalary: app.salary,
      location: app.location,
      salary: app.salary,
      jobUrl: app.jobUrl,
      job: app.job
        ? {
            id: app.job.id,
            title: app.job.normalizedTitle || app.job.originalTitle,
            companyName: app.job.companyName,
            city: app.job.city,
            country: app.job.country,
            workArrangement: app.job.workArrangement,
            employmentType: app.job.employmentType,
            salaryMin: app.job.salaryMin ? Number(app.job.salaryMin) : null,
            salaryMax: app.job.salaryMax ? Number(app.job.salaryMax) : null,
            salaryCurrency: app.job.salaryCurrency,
            status: app.job.status,
            applicationMethod: app.job.applicationMethod,
            applicationUrl: app.job.applicationUrl,
            originalUrl: app.job.originalUrl,
          }
        : null,
      nextInterview: app.interviews[0] || null,
      documentSnapshot: app.documentSnapshotFilename
        ? {
            documentId: app.documentId,
            filename: app.documentSnapshotFilename,
          }
        : null,
      interviewsCount: app._count.interviews,
      remindersCount: app._count.reminders,
      historyCount: app._count.history,
    }));

    return {
      applications: formattedApplications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get application summary statistics for dashboard metric cards
   */
  async getApplicationStats(userId: string) {
    const applications = await prisma.jobApplication.findMany({
      where: { userId, isArchived: false },
      select: {
        id: true,
        status: true,
        source: true,
      },
    });

    const now = new Date();
    const upcomingInterviewsCount = await prisma.jobApplicationInterview.count({
      where: {
        application: { userId },
        outcome: 'PENDING',
        scheduledAt: { gte: now },
      },
    });

    const byStatus: Record<ApplicationStatus, number> = {
      DRAFT: 0,
      APPLIED: 0,
      IN_REVIEW: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
    };

    const bySource: Record<ApplicationSource, number> = {
      PLATFORM: 0,
      EXTERNAL: 0,
    };

    let activeApplications = 0;
    let offersReceived = 0;

    for (const app of applications) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
      bySource[app.source] = (bySource[app.source] || 0) + 1;

      if (ACTIVE_STATUSES.includes(app.status)) {
        activeApplications += 1;
      }
      if (app.status === 'OFFER') {
        offersReceived += 1;
      }
    }

    return {
      totalApplications: applications.length,
      activeApplications,
      interviewsScheduled: upcomingInterviewsCount,
      offersReceived,
      byStatus,
      bySource,
    };
  }

  /**
   * Retrieve single application by ID with full details, history, interviews, and reminders
   */
  async getApplicationById(userId: string, applicationId: string) {
    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      include: {
        job: {
          select: {
            id: true,
            originalTitle: true,
            normalizedTitle: true,
            originalDescription: true,
            normalizedDescription: true,
            companyName: true,
            city: true,
            country: true,
            workArrangement: true,
            employmentType: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            status: true,
            applicationMethod: true,
            applicationUrl: true,
            originalUrl: true,
            closingDate: true,
            source: { select: { id: true, name: true, slug: true } },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        document: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            fileSize: true,
            storageProvider: true,
            createdAt: true,
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
        interviews: {
          orderBy: { roundNumber: 'asc' },
        },
        reminders: {
          orderBy: { remindAt: 'asc' },
        },
      },
    });

    if (!app) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    return {
      ...app,
      title: app.jobTitle,
      companyName: app.companyName,
      externalCompanyName: app.companyName,
      externalJobTitle: app.jobTitle,
      externalJobUrl: app.jobUrl,
      externalLocation: app.location,
      externalSalary: app.salary,
      coverNoteText: app.coverNote,
      job: app.job
        ? {
            ...app.job,
            title: app.job.normalizedTitle || app.job.originalTitle,
            description: app.job.normalizedDescription || app.job.originalDescription,
            salaryMin: app.job.salaryMin ? Number(app.job.salaryMin) : null,
            salaryMax: app.job.salaryMax ? Number(app.job.salaryMax) : null,
          }
        : null,
    };
  }

  /**
   * Create an application (Platform or External; Draft or Applied)
   */
  async createApplication(userId: string, dto: CreateApplicationDto) {
    const status = dto.status || 'APPLIED';
    let documentSnapshotFilename: string | null = null;
    let documentSnapshotChecksum: string | null = null;

    // 1. If CV document is provided, verify ownership and capture snapshot details
    if (dto.documentId) {
      const doc = await prisma.userDocument.findFirst({
        where: { id: dto.documentId, userId },
      });
      if (!doc) {
        throw AppError.notFound('Selected CV document not found', 'DOCUMENT_NOT_FOUND');
      }
      documentSnapshotFilename = doc.originalFilename;
      documentSnapshotChecksum = doc.fileChecksum;
    }

    let jobTitle = '';
    let companyName = '';
    let jobUrl: string | null = null;
    let location: string | null = null;
    let salary: string | null = null;

    // 2. Platform Job Applications validation
    if (dto.source === 'PLATFORM') {
      if (!dto.jobId) {
        throw AppError.badRequest('jobId is required for platform applications', 'JOB_ID_REQUIRED');
      }

      const job = await prisma.job.findUnique({
        where: { id: dto.jobId },
        select: {
          id: true,
          status: true,
          closingDate: true,
          originalTitle: true,
          normalizedTitle: true,
          companyName: true,
          city: true,
          country: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
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

      // Check email verification if submitting
      if (status === 'APPLIED') {
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
      }

      // Check for active duplicate platform application
      const existingActive = await prisma.jobApplication.findFirst({
        where: {
          userId,
          jobId: dto.jobId,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (existingActive) {
        throw AppError.conflict(
          'You already have an active application for this job posting.',
          'APPLICATION_ALREADY_EXISTS'
        );
      }

      jobTitle = job.normalizedTitle || job.originalTitle;
      companyName = job.companyName || 'Unknown Company';
      jobUrl = job.applicationUrl || job.originalUrl || null;
      location = job.city ? (job.country ? `${job.city}, ${job.country}` : job.city) : job.country || null;
      salary =
        job.salaryMin || job.salaryMax
          ? `${job.salaryMin || ''} - ${job.salaryMax || ''} ${job.salaryCurrency || ''}`.trim()
          : null;
    } else {
      // 3. External Job Applications duplicate prevention
      const company = dto.externalCompanyName?.trim();
      const title = dto.externalJobTitle?.trim();

      if (!company || !title) {
        throw AppError.badRequest(
          'Company name and job title are required for external applications.',
          'MISSING_EXTERNAL_FIELDS'
        );
      }

      const existingActiveExternal = await prisma.jobApplication.findFirst({
        where: {
          userId,
          source: 'EXTERNAL',
          companyName: company,
          jobTitle: title,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (existingActiveExternal) {
        throw AppError.conflict(
          'An active application already exists for this external job title and company.',
          'APPLICATION_ALREADY_EXISTS'
        );
      }

      jobTitle = title;
      companyName = company;
      jobUrl = dto.externalJobUrl?.trim() || null;
      location = dto.externalLocation?.trim() || null;
      salary = dto.externalSalary?.trim() || null;
    }

    const activeKey = this.computeActiveKey(dto.source, userId, dto.jobId, status);

    try {
      const application = await prisma.$transaction(async (tx) => {
        const app = await tx.jobApplication.create({
          data: {
            userId,
            source: dto.source,
            status,
            jobId: dto.source === 'PLATFORM' ? dto.jobId : null,
            activeKey,
            jobTitle,
            companyName,
            jobUrl,
            location,
            salary,
            documentId: dto.documentId || null,
            documentSnapshotFilename,
            documentSnapshotChecksum,
            coverNote: dto.coverNoteText ? dto.coverNoteText.trim() : null,
            notes: dto.notes ? dto.notes.trim() : null,
            appliedAt: dto.appliedAt ? new Date(dto.appliedAt) : new Date(),
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
            document: {
              select: {
                id: true,
                originalFilename: true,
                mimeType: true,
              },
            },
          },
        });

        // Insert initial history record
        await tx.jobApplicationHistory.create({
          data: {
            applicationId: app.id,
            fromStatus: null,
            toStatus: status,
            reason: status === 'DRAFT' ? 'Draft created' : 'Application submitted',
            changedByUserId: userId,
          },
        });

        return app;
      });

      return {
        id: application.id,
        source: application.source,
        status: application.status,
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        jobTitle: application.jobTitle,
        companyName: application.companyName,
      };
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppError.conflict(
          'An active application already exists for this position.',
          'APPLICATION_ALREADY_EXISTS'
        );
      }
      throw err;
    }
  }

  /**
   * Update external application fields, notes, or archive status
   */
  async updateApplication(userId: string, applicationId: string, dto: UpdateApplicationDto) {
    const existing = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!existing) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    const updateData: Prisma.JobApplicationUpdateInput = {};

    if (dto.externalCompanyName !== undefined) updateData.companyName = dto.externalCompanyName?.trim();
    if (dto.externalJobTitle !== undefined) updateData.jobTitle = dto.externalJobTitle?.trim();
    if (dto.externalJobUrl !== undefined) updateData.jobUrl = dto.externalJobUrl?.trim() || null;
    if (dto.externalLocation !== undefined) updateData.location = dto.externalLocation?.trim() || null;
    if (dto.externalSalary !== undefined) updateData.salary = dto.externalSalary?.trim() || null;
    if (dto.appliedAt !== undefined) updateData.appliedAt = new Date(dto.appliedAt);
    if (dto.coverNoteText !== undefined) updateData.coverNote = dto.coverNoteText?.trim() || null;
    if (dto.notes !== undefined) updateData.notes = dto.notes?.trim() || null;
    if (dto.isArchived !== undefined) updateData.isArchived = dto.isArchived;

    if (dto.documentId !== undefined) {
      if (dto.documentId) {
        const doc = await prisma.userDocument.findFirst({
          where: { id: dto.documentId, userId },
        });
        if (!doc) {
          throw AppError.notFound('Selected CV document not found', 'DOCUMENT_NOT_FOUND');
        }
        updateData.document = { connect: { id: doc.id } };
        updateData.documentSnapshotFilename = doc.originalFilename;
        updateData.documentSnapshotChecksum = doc.fileChecksum;
      } else {
        updateData.document = { disconnect: true };
        updateData.documentSnapshotFilename = null;
        updateData.documentSnapshotChecksum = null;
      }
    }

    const updated = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Transition application status with validated state machine rules and audit logging
   */
  async updateStatus(userId: string, applicationId: string, newStatus: ApplicationStatus, reason?: string) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    const currentStatus = application.status;
    if (currentStatus === newStatus) {
      return application;
    }

    const validTargets = VALID_TRANSITIONS[currentStatus] || [];
    if (!validTargets.includes(newStatus)) {
      throw AppError.badRequest(
        `Cannot transition application from '${currentStatus}' directly to '${newStatus}'. Valid target statuses: ${validTargets.join(', ')}.`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Compute updated activeKey
    let nextActiveKey: string | null = application.activeKey;
    if (application.source === 'PLATFORM' && application.jobId) {
      if (newStatus === 'WITHDRAWN') {
        nextActiveKey = null;
      } else if (ACTIVE_STATUSES.includes(newStatus) && !application.activeKey) {
        nextActiveKey = `${userId}_${application.jobId}`;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: newStatus,
          activeKey: nextActiveKey,
        },
      });

      await tx.jobApplicationHistory.create({
        data: {
          applicationId,
          fromStatus: currentStatus,
          toStatus: newStatus,
          reason: reason ? reason.trim() : null,
          changedByUserId: userId,
        },
      });

      return app;
    });

    return updated;
  }

  /**
   * Withdraw an active application
   */
  async withdrawApplication(userId: string, applicationId: string, reason?: string) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    if (application.status === 'WITHDRAWN') {
      throw AppError.badRequest('Application has already been withdrawn', 'APPLICATION_ALREADY_WITHDRAWN');
    }

    return this.updateStatus(userId, applicationId, 'WITHDRAWN', reason || 'Withdrawn by candidate');
  }

  /**
   * Delete draft application (blocks submitted applications with 400)
   */
  async deleteDraft(userId: string, applicationId: string) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    if (application.status !== 'DRAFT') {
      throw AppError.badRequest(
        'Submitted applications cannot be physically deleted. You may withdraw or archive this application instead.',
        'CANNOT_DELETE_SUBMITTED_APPLICATION'
      );
    }

    await prisma.jobApplication.delete({
      where: { id: applicationId },
    });

    return { success: true };
  }

  /**
   * Schedule an interview round for an application
   */
  async scheduleInterview(userId: string, applicationId: string, dto: ScheduleInterviewDto) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      include: {
        interviews: { select: { roundNumber: true } },
      },
    });

    if (!application) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    // Auto calculate round number if not provided
    let roundNumber = dto.roundNumber;
    if (!roundNumber) {
      const maxRound = application.interviews.reduce((max, i) => Math.max(max, i.roundNumber), 0);
      roundNumber = maxRound + 1;
    }

    const interview = await prisma.$transaction(async (tx) => {
      const created = await tx.jobApplicationInterview.create({
        data: {
          applicationId,
          roundNumber,
          title: dto.title.trim(),
          interviewType: dto.interviewType || 'VIDEO',
          scheduledAt: new Date(dto.scheduledAt),
          timezone: dto.timezone || 'UTC',
          durationMinutes: dto.durationMinutes || 60,
          locationUrl: dto.locationUrl?.trim() || null,
          interviewerInfo: dto.interviewerInfo?.trim() || null,
          preparationNotes: dto.preparationNotes?.trim() || null,
          feedbackNotes: dto.feedbackNotes?.trim() || null,
          outcome: dto.outcome || 'PENDING',
        },
      });

      // If application is in APPLIED or IN_REVIEW, auto-advance to INTERVIEW
      if (['APPLIED', 'IN_REVIEW'].includes(application.status)) {
        await tx.jobApplication.update({
          where: { id: applicationId },
          data: { status: 'INTERVIEW' },
        });

        await tx.jobApplicationHistory.create({
          data: {
            applicationId,
            fromStatus: application.status,
            toStatus: 'INTERVIEW',
            reason: `Interview scheduled: ${dto.title.trim()} (Round ${roundNumber})`,
            changedByUserId: userId,
          },
        });
      }

      return created;
    });

    return interview;
  }

  /**
   * Update interview round details or outcome
   */
  async updateInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
    dto: UpdateInterviewDto
  ) {
    const interview = await prisma.jobApplicationInterview.findFirst({
      where: {
        id: interviewId,
        applicationId,
        application: { userId },
      },
    });

    if (!interview) {
      throw AppError.notFound('Interview round not found', 'INTERVIEW_NOT_FOUND');
    }

    const updateData: Prisma.JobApplicationInterviewUpdateInput = {};
    if (dto.roundNumber !== undefined) updateData.roundNumber = dto.roundNumber;
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.interviewType !== undefined) updateData.interviewType = dto.interviewType;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt);
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;
    if (dto.durationMinutes !== undefined) updateData.durationMinutes = dto.durationMinutes;
    if (dto.locationUrl !== undefined) updateData.locationUrl = dto.locationUrl?.trim() || null;
    if (dto.interviewerInfo !== undefined) updateData.interviewerInfo = dto.interviewerInfo?.trim() || null;
    if (dto.preparationNotes !== undefined) updateData.preparationNotes = dto.preparationNotes?.trim() || null;
    if (dto.feedbackNotes !== undefined) updateData.feedbackNotes = dto.feedbackNotes?.trim() || null;
    if (dto.outcome !== undefined) updateData.outcome = dto.outcome;

    const updated = await prisma.jobApplicationInterview.update({
      where: { id: interviewId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Delete an interview round
   */
  async deleteInterview(userId: string, applicationId: string, interviewId: string) {
    const interview = await prisma.jobApplicationInterview.findFirst({
      where: {
        id: interviewId,
        applicationId,
        application: { userId },
      },
    });

    if (!interview) {
      throw AppError.notFound('Interview round not found', 'INTERVIEW_NOT_FOUND');
    }

    await prisma.jobApplicationInterview.delete({
      where: { id: interviewId },
    });

    return { success: true };
  }

  /**
   * Create a follow-up reminder
   */
  async createReminder(userId: string, applicationId: string, dto: CreateReminderDto) {
    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
    });

    if (!application) {
      throw AppError.notFound('Application not found', 'APPLICATION_NOT_FOUND');
    }

    const reminder = await prisma.jobApplicationReminder.create({
      data: {
        applicationId,
        title: dto.title.trim(),
        remindAt: new Date(dto.remindAt),
        notes: dto.notes?.trim() || null,
      },
    });

    return reminder;
  }

  /**
   * Update a reminder (or toggle completion)
   */
  async updateReminder(
    userId: string,
    applicationId: string,
    reminderId: string,
    dto: UpdateReminderDto
  ) {
    const reminder = await prisma.jobApplicationReminder.findFirst({
      where: {
        id: reminderId,
        applicationId,
        application: { userId },
      },
    });

    if (!reminder) {
      throw AppError.notFound('Reminder not found', 'REMINDER_NOT_FOUND');
    }

    const updateData: Prisma.JobApplicationReminderUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.remindAt !== undefined) updateData.remindAt = new Date(dto.remindAt);
    if (dto.notes !== undefined) updateData.notes = dto.notes?.trim() || null;
    if (dto.isCompleted !== undefined) {
      updateData.isCompleted = dto.isCompleted;
      updateData.completedAt = dto.isCompleted ? new Date() : null;
    }

    const updated = await prisma.jobApplicationReminder.update({
      where: { id: reminderId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(userId: string, applicationId: string, reminderId: string) {
    const reminder = await prisma.jobApplicationReminder.findFirst({
      where: {
        id: reminderId,
        applicationId,
        application: { userId },
      },
    });

    if (!reminder) {
      throw AppError.notFound('Reminder not found', 'REMINDER_NOT_FOUND');
    }

    await prisma.jobApplicationReminder.delete({
      where: { id: reminderId },
    });

    return { success: true };
  }
}

export const applicationsService = new ApplicationsService();

