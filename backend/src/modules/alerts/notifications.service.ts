import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../lib/logger';
import { AlertsMatcher } from './alerts.matcher';
import { emailNotificationProvider, inAppNotificationProvider } from './notification.provider';
import { Prisma } from '@prisma/client';

export interface AlertProcessingResult {
  searchesProcessed: number;
  notificationsCreated: number;
  durationMs: number;
}

export class NotificationsService {
  private isAlertProcessing = false;

  /**
   * Get paginated notifications for an authenticated user
   */
  async getUserNotifications(userId: string, options: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.JobNotificationWhereInput = {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.jobNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              normalizedTitle: true,
              originalTitle: true,
              companyName: true,
              city: true,
              country: true,
              workArrangement: true,
              employmentType: true,
              experienceLevel: true,
              salaryMin: true,
              salaryMax: true,
              salaryCurrency: true,
              status: true,
              publishedAt: true,
              closingDate: true,
              applicationUrl: true,
              originalUrl: true,
            },
          },
          savedSearch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.jobNotification.count({ where }),
      prisma.jobNotification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fast unread count for navbar badge
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.jobNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.jobNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    if (notification.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this notification', 'FORBIDDEN');
    }

    const updated = await prisma.jobNotification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Mark all unread notifications as read for current user
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.jobNotification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'All notifications marked as read',
      updatedCount: result.count,
    };
  }

  /**
   * Delete a single notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.jobNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    if (notification.userId !== userId) {
      throw AppError.forbidden('You do not have permission to delete this notification', 'FORBIDDEN');
    }

    await prisma.jobNotification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted successfully' };
  }

  /**
   * Clear all read notifications for current user
   */
  async clearReadNotifications(userId: string) {
    const result = await prisma.jobNotification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });

    return {
      message: 'Read notifications cleared',
      deletedCount: result.count,
    };
  }

  /**
   * Core Alert Evaluation Engine:
   * Evaluates active saved searches against candidate jobs, deduplicating alerts.
   * Can be triggered on scheduler tick, collection run completion, or manual trigger.
   */
  async processPendingJobAlerts(): Promise<AlertProcessingResult> {
    if (this.isAlertProcessing) {
      logger.info('[AlertsMatcher] Alert processing already in progress. Skipping duplicate tick.');
      return { searchesProcessed: 0, notificationsCreated: 0, durationMs: 0 };
    }

    this.isAlertProcessing = true;
    const startTime = Date.now();
    let notificationsCreated = 0;
    let searchesProcessed = 0;

    try {
      // Find all active saved searches
      const activeSearches = await prisma.savedSearch.findMany({
        where: { isAlertEnabled: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      searchesProcessed = activeSearches.length;
      if (searchesProcessed === 0) {
        return { searchesProcessed: 0, notificationsCreated: 0, durationMs: Date.now() - startTime };
      }

      const now = new Date();

      for (const search of activeSearches) {
        try {
          // If search was never alerted, evaluate jobs from past 7 days, else since lastAlertAt
          const sinceThreshold = search.lastAlertAt
            ? new Date(search.lastAlertAt.getTime() - 60 * 1000) // 1 min buffer
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          const baseWhere = AlertsMatcher.buildWhereClause(search, now);

          // Add threshold filter so we only alert for newly created/updated active jobs
          const searchWhere: Prisma.JobWhereInput = {
            AND: [
              baseWhere,
              {
                OR: [
                  { firstSeenAt: { gte: sinceThreshold } },
                  { publishedAt: { gte: sinceThreshold } },
                  { updatedAt: { gte: sinceThreshold } },
                ],
              },
            ],
          };

          // Find up to 30 candidate jobs for this saved search
          const matchingJobs = await prisma.job.findMany({
            where: searchWhere,
            take: 30,
            orderBy: { publishedAt: 'desc' },
            select: {
              id: true,
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

          for (const job of matchingJobs) {
            // Deduplication policy: at most one notification per job per user (@@unique([userId, jobId]))
            const existingNotification = await prisma.jobNotification.findUnique({
              where: {
                userId_jobId: {
                  userId: search.userId,
                  jobId: job.id,
                },
              },
            });

            if (existingNotification) {
              // Notification already exists. Check if this saved search is recorded in matchedSearchNames
              let currentMatched: string[] = [];
              if (Array.isArray(existingNotification.matchedSearchNames)) {
                currentMatched = existingNotification.matchedSearchNames as string[];
              }
              if (!currentMatched.includes(search.name)) {
                currentMatched.push(search.name);
                await prisma.jobNotification.update({
                  where: { id: existingNotification.id },
                  data: { matchedSearchNames: currentMatched },
                });
              }
            } else {
              // Create brand new in-app notification
              try {
                await prisma.jobNotification.create({
                  data: {
                    userId: search.userId,
                    jobId: job.id,
                    savedSearchId: search.id,
                    matchedSearchNames: [search.name],
                    channel: 'IN_APP',
                    status: 'DELIVERED',
                    isRead: false,
                  },
                });

                notificationsCreated++;

                // Format salary string for notification payload
                let salaryText: string | null = null;
                if (job.salaryMin || job.salaryMax) {
                  const curr = job.salaryCurrency || 'ETB';
                  salaryText =
                    job.salaryMin && job.salaryMax
                      ? `${job.salaryMin} - ${job.salaryMax} ${curr}`
                      : `${job.salaryMin || job.salaryMax} ${curr}`;
                }

                // Extensible notification provider hook
                await emailNotificationProvider.send({
                  userId: search.user.id,
                  userEmail: search.user.email,
                  userName: [search.user.firstName, search.user.lastName].filter(Boolean).join(' ') || search.user.email,
                  jobId: job.id,
                  jobTitle: job.normalizedTitle,
                  companyName: job.companyName,
                  jobLocation: [job.city, job.country].filter(Boolean).join(', '),
                  salaryText,
                  jobUrl: job.applicationUrl || job.originalUrl,
                  matchedSearches: [search.name],
                });
              } catch (createErr: any) {
                // If unique constraint race condition hit (P2002), ignore gracefully
                if (createErr.code !== 'P2002') {
                  logger.warn(`Failed to create notification for user ${search.userId} on job ${job.id}:`, createErr.message);
                }
              }
            }
          }

          // Update saved search lastAlertAt
          await prisma.savedSearch.update({
            where: { id: search.id },
            data: { lastAlertAt: now },
          });
        } catch (searchErr) {
          logger.error(`Error processing alerts for saved search ${search.id}:`, (searchErr as Error).message);
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info(
        `[AlertsMatcher] Processed ${searchesProcessed} saved search(es), created ${notificationsCreated} new alert(s) in ${durationMs}ms.`
      );

      return {
        searchesProcessed,
        notificationsCreated,
        durationMs,
      };
    } catch (err) {
      logger.error('[AlertsMatcher] Global alert evaluation error:', (err as Error).message);
      return {
        searchesProcessed,
        notificationsCreated,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isAlertProcessing = false;
    }
  }
}

export const notificationsService = new NotificationsService();

