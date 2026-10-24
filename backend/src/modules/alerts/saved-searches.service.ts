import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error-handler';
import { CreateSavedSearchInput, UpdateSavedSearchInput, RunSavedSearchQuery } from './saved-searches.validation';
import { AlertsMatcher } from './alerts.matcher';
import { Prisma } from '@prisma/client';

export class SavedSearchesService {
  /**
   * Create a new saved search for the user
   */
  async create(userId: string, input: CreateSavedSearchInput) {
    const minSalaryDecimal =
      input.minSalary !== undefined && input.minSalary !== null
        ? new Prisma.Decimal(input.minSalary)
        : null;

    const maxSalaryDecimal =
      input.maxSalary !== undefined && input.maxSalary !== null
        ? new Prisma.Decimal(input.maxSalary)
        : null;

    const savedSearch = await prisma.savedSearch.create({
      data: {
        userId,
        name: input.name.trim(),
        search: input.search ? input.search.trim() : null,
        categorySlug: input.categorySlug ? input.categorySlug.trim() : null,
        city: input.city ? input.city.trim() : null,
        country: input.country ? input.country.trim() : null,
        workArrangement: input.workArrangement || null,
        remoteEligibility: input.remoteEligibility ? input.remoteEligibility.trim() : null,
        employmentType: input.employmentType || null,
        experienceLevel: input.experienceLevel || null,
        minSalary: minSalaryDecimal,
        maxSalary: maxSalaryDecimal,
        currency: input.currency || 'ETB',
        isAlertEnabled: input.isAlertEnabled !== undefined ? input.isAlertEnabled : true,
      },
    });

    return savedSearch;
  }

  /**
   * List all saved searches for the user
   */
  async findAll(userId: string) {
    const savedSearches = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { notifications: true },
        },
      },
    });

    return savedSearches.map((s) => ({
      ...s,
      notificationsCount: s._count.notifications,
    }));
  }

  /**
   * Get single saved search by ID (enforcing user ownership)
   */
  async findById(userId: string, id: string) {
    const savedSearch = await prisma.savedSearch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { notifications: true },
        },
      },
    });

    if (!savedSearch) {
      throw AppError.notFound('Saved search not found', 'SAVED_SEARCH_NOT_FOUND');
    }

    if (savedSearch.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this saved search', 'FORBIDDEN');
    }

    return {
      ...savedSearch,
      notificationsCount: savedSearch._count.notifications,
    };
  }

  /**
   * Update saved search (enforcing user ownership)
   */
  async update(userId: string, id: string, input: UpdateSavedSearchInput) {
    await this.findById(userId, id);

    const data: Prisma.SavedSearchUpdateInput = {};

    if (input.name !== undefined) data.name = input.name.trim();
    if (input.search !== undefined) data.search = input.search ? input.search.trim() : null;
    if (input.categorySlug !== undefined) data.categorySlug = input.categorySlug ? input.categorySlug.trim() : null;
    if (input.city !== undefined) data.city = input.city ? input.city.trim() : null;
    if (input.country !== undefined) data.country = input.country ? input.country.trim() : null;
    if (input.workArrangement !== undefined) data.workArrangement = input.workArrangement || null;
    if (input.remoteEligibility !== undefined) data.remoteEligibility = input.remoteEligibility ? input.remoteEligibility.trim() : null;
    if (input.employmentType !== undefined) data.employmentType = input.employmentType || null;
    if (input.experienceLevel !== undefined) data.experienceLevel = input.experienceLevel || null;
    if (input.currency !== undefined) data.currency = input.currency || 'ETB';
    if (input.isAlertEnabled !== undefined) data.isAlertEnabled = input.isAlertEnabled;

    if (input.minSalary !== undefined) {
      data.minSalary =
        input.minSalary !== null ? new Prisma.Decimal(input.minSalary) : null;
    }

    if (input.maxSalary !== undefined) {
      data.maxSalary =
        input.maxSalary !== null ? new Prisma.Decimal(input.maxSalary) : null;
    }

    const updated = await prisma.savedSearch.update({
      where: { id },
      data,
    });

    return updated;
  }

  /**
   * Quick toggle alert status for saved search
   */
  async toggleAlert(userId: string, id: string) {
    const savedSearch = await this.findById(userId, id);

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: {
        isAlertEnabled: !savedSearch.isAlertEnabled,
      },
    });

    return updated;
  }

  /**
   * Delete saved search (enforcing user ownership)
   */
  async delete(userId: string, id: string) {
    await this.findById(userId, id);

    await prisma.savedSearch.delete({
      where: { id },
    });

    return { message: 'Saved search deleted successfully' };
  }

  /**
   * Run a saved search live and return matching catalog jobs
   */
  async runSavedSearch(userId: string, id: string, query: RunSavedSearchQuery) {
    const savedSearch = await this.findById(userId, id);

    // Update lastRunAt timestamp
    await prisma.savedSearch.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = AlertsMatcher.buildWhereClause(savedSearch);

    const [rawJobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          source: {
            select: { id: true, name: true, slug: true },
          },
          savedBy: {
            where: { userId },
            select: { id: true },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    const jobs = rawJobs.map((j) => {
      const { savedBy, ...rest } = j;
      return {
        ...rest,
        isSaved: (savedBy && savedBy.length > 0) || false,
      };
    });

    return {
      savedSearch,
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const savedSearchesService = new SavedSearchesService();
