import { prisma } from '../../lib/prisma';

export class AdminDashboardService {
  async getStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalJobs,
      activeJobs,
      pendingJobs,
      expiredJobs,
      totalUsers,
      activeUsers,
      totalSources,
      enabledSources,
      jobsToday,
      failedRuns,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'ACTIVE' } }),
      prisma.job.count({
        where: { classificationStatus: { in: ['PENDING', 'REVIEW_REQUIRED'] } },
      }),
      prisma.job.count({
        where: { status: { in: ['EXPIRED', 'CLOSED'] } },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          isActive: true,
          OR: [
            { refreshSessions: { some: { isRevoked: false, expiresAt: { gt: now } } } },
            { lastLoginAt: { gte: thirtyDaysAgo } },
            { createdAt: { gte: thirtyDaysAgo } },
          ],
        },
      }),
      prisma.jobSource.count(),
      prisma.jobSource.count({ where: { isActive: true } }),
      prisma.job.count({
        where: { firstSeenAt: { gte: startOfToday } },
      }),
      prisma.collectionRun.count({
        where: { status: 'FAILED' },
      }),
    ]);

    return {
      totalJobs,
      activeJobs,
      pendingJobs,
      expiredJobs,
      totalUsers,
      activeUsers,
      totalSources,
      enabledSources,
      jobsToday,
      failedRuns,
    };
  }

  async getOverview() {
    const now = new Date();

    const [recentRuns, recentJobs, allSources, last7DaysJobs] = await Promise.all([
      prisma.collectionRun.findMany({
        take: 6,
        orderBy: { startedAt: 'desc' },
        include: {
          source: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.job.findMany({
        take: 6,
        orderBy: { firstSeenAt: 'desc' },
        include: {
          source: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.jobSource.findMany({
        include: {
          runs: {
            take: 1,
            orderBy: { startedAt: 'desc' },
            select: { status: true, finishedAt: true, errorSummary: true },
          },
        },
      }),
      // Fetch jobs created in last 7 days for trend calculation
      prisma.job.findMany({
        where: {
          firstSeenAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { firstSeenAt: true },
      }),
    ]);

    // Calculate failing or overdue sources
    const failingOrOverdueSources = allSources.filter((s) => {
      const lastRun = s.runs[0];
      const isFailing = lastRun?.status === 'FAILED';
      const isOverdue = s.isActive && s.nextRunAt && new Date(s.nextRunAt) < now;
      return isFailing || isOverdue;
    });

    // Group jobs by day for last 7 days
    const trendMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      trendMap[dateStr] = 0;
    }

    last7DaysJobs.forEach((job) => {
      const dateStr = job.firstSeenAt.toISOString().split('T')[0];
      if (trendMap[dateStr] !== undefined) {
        trendMap[dateStr]++;
      }
    });

    const jobsTrend = Object.entries(trendMap).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      recentRuns,
      recentJobs,
      failingSources: failingOrOverdueSources.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        isActive: s.isActive,
        lastRunAt: s.lastRunAt,
        nextRunAt: s.nextRunAt,
        lastStatus: s.runs[0]?.status || 'NEVER_RUN',
        lastError: s.runs[0]?.errorSummary || null,
        isOverdue: Boolean(s.isActive && s.nextRunAt && new Date(s.nextRunAt) < now),
      })),
      jobsTrend,
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
