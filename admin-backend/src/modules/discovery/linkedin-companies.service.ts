import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { linkedinAdapter } from './adapters/linkedin.adapter';
import { LinkedInCompanyStatus, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error-handler';

export function normalizeCompanyName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\bs\s*\.?\s*c\s*\.?/gi, ' ')
    .replace(/\b(plc|sc|llc|inc|ltd|corp|corporation|group|bank|ethiopia)\b/gi, ' ')
    .replace(/[^\w\s\u1200-\u137F]/g, ' ')
    .replace(/\bs\s+c\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class LinkedInCompaniesService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Get tracked LinkedIn companies with search, filter, and pagination
   */
  async getCompanies(options: {
    search?: string;
    status?: LinkedInCompanyStatus;
    industry?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.LinkedInCompanyWhereInput = {};

    if (options.status) {
      where.status = options.status;
    }

    if (options.industry) {
      where.industry = options.industry;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { industry: { contains: options.search, mode: 'insensitive' } },
        { location: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, companies] = await Promise.all([
      this.db.linkedInCompany.count({ where }),
      this.db.linkedInCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ jobCount: 'desc' }, { lastJobSeenAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      companies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Register or update a company to track on LinkedIn
   */
  async upsertCompany(data: {
    name: string;
    linkedinUrl?: string | null;
    industry?: string | null;
    location?: string | null;
    status?: LinkedInCompanyStatus;
    notes?: string | null;
  }) {
    const cleanName = (data.name || '').trim();
    if (!cleanName) {
      throw AppError.badRequest('Company name is required.', 'INVALID_COMPANY_NAME');
    }

    const normalizedName = normalizeCompanyName(cleanName) || cleanName.toLowerCase();
    const targetLocation = data.location ? data.location.trim() : 'Ethiopia';

    // Build pre-filtered LinkedIn job search link for this company (restricted to past 7 days)
    const searchUrl = linkedinAdapter.generateSearchUrl(cleanName, {
      location: targetLocation,
      timeRange: 'past_week',
    });

    const existing = await this.db.linkedInCompany.findUnique({
      where: { normalizedName },
    });

    if (existing) {
      return this.db.linkedInCompany.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : existing.linkedinUrl,
          industry: data.industry !== undefined ? data.industry : existing.industry,
          location: targetLocation,
          status: data.status || existing.status,
          searchUrl,
          notes: data.notes !== undefined ? data.notes : existing.notes,
        },
      });
    }

    return this.db.linkedInCompany.create({
      data: {
        name: cleanName,
        normalizedName,
        linkedinUrl: data.linkedinUrl,
        industry: data.industry,
        location: targetLocation,
        status: data.status || 'ACTIVE',
        searchUrl,
        notes: data.notes,
      },
    });
  }

  /**
   * Automatically record a job discovered from a specific company
   */
  async recordCompanyJobDiscovered(companyName?: string | null) {
    if (!companyName || typeof companyName !== 'string') return;
    const cleanName = companyName.trim();
    if (cleanName.length < 2) return;

    const normalizedName = normalizeCompanyName(cleanName) || cleanName.toLowerCase();
    const now = new Date();

    try {
      const existing = await this.db.linkedInCompany.findUnique({
        where: { normalizedName },
      });

      if (existing) {
        await this.db.linkedInCompany.update({
          where: { id: existing.id },
          data: {
            jobCount: { increment: 1 },
            lastJobSeenAt: now,
          },
        });
      } else {
        // Auto-register newly discovered company
        const searchUrl = linkedinAdapter.generateSearchUrl(cleanName, {
          location: 'Ethiopia',
          timeRange: 'past_week',
        });

        await this.db.linkedInCompany.create({
          data: {
            name: cleanName,
            normalizedName,
            location: 'Ethiopia',
            status: 'ACTIVE',
            jobCount: 1,
            lastJobSeenAt: now,
            searchUrl,
          },
        });
        logger.info(`[LinkedInCompaniesService] Auto-registered new company: '${cleanName}'`);
      }
    } catch (err: any) {
      logger.warn(`[LinkedInCompaniesService] Failed to record company '${cleanName}': ${err.message}`);
    }
  }

  /**
   * Update status (ACTIVE, WATCHED, PAUSED)
   */
  async updateStatus(id: string, status: LinkedInCompanyStatus) {
    return this.db.linkedInCompany.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete tracked company
   */
  async deleteCompany(id: string) {
    return this.db.linkedInCompany.delete({
      where: { id },
    });
  }
}

export const linkedInCompaniesService = new LinkedInCompaniesService();
