import { Prisma, Job, JobCategory } from '@prisma/client';

export type JobWithCategory = Job & {
  category?: JobCategory | null;
};

export interface SavedSearchCriteria {
  id?: string;
  name?: string;
  search?: string | null;
  categorySlug?: string | null;
  city?: string | null;
  country?: string | null;
  workArrangement?: string | null;
  remoteEligibility?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  minSalary?: Prisma.Decimal | number | null;
  maxSalary?: Prisma.Decimal | number | null;
  currency?: string | null;
  isAlertEnabled?: boolean;
}

export class AlertsMatcher {
  /**
   * Build a Prisma where input condition representing the saved search criteria
   */
  static buildWhereClause(criteria: SavedSearchCriteria, now: Date = new Date()): Prisma.JobWhereInput {
    const andConditions: Prisma.JobWhereInput[] = [
      { status: 'ACTIVE' },
      {
        classificationStatus: {
          notIn: ['FAILED', 'REVIEW_REQUIRED'],
        },
      },
      {
        OR: [{ closingDate: null }, { closingDate: { gte: now } }],
      },
    ];

    if (criteria.search && criteria.search.trim()) {
      const q = criteria.search.trim();
      andConditions.push({
        OR: [
          { normalizedTitle: { contains: q } },
          { originalTitle: { contains: q } },
          { companyName: { contains: q } },
          { normalizedDescription: { contains: q } },
        ],
      });
    }

    if (criteria.categorySlug && criteria.categorySlug.trim()) {
      const cat = criteria.categorySlug.trim();
      andConditions.push({
        category: {
          OR: [{ slug: cat }, { id: cat }],
        },
      });
    }

    if (criteria.city && criteria.city.trim()) {
      andConditions.push({ city: { contains: criteria.city.trim() } });
    }

    if (criteria.country && criteria.country.trim()) {
      andConditions.push({ country: { contains: criteria.country.trim() } });
    }

    if (criteria.workArrangement) {
      andConditions.push({ workArrangement: criteria.workArrangement as any });
    }

    if (criteria.employmentType) {
      andConditions.push({ employmentType: criteria.employmentType as any });
    }

    if (criteria.experienceLevel) {
      andConditions.push({ experienceLevel: criteria.experienceLevel as any });
    }

    if (criteria.remoteEligibility && criteria.remoteEligibility.trim()) {
      andConditions.push({
        remoteEligibility: { contains: criteria.remoteEligibility.trim() },
      });
    }

    if (criteria.minSalary !== undefined && criteria.minSalary !== null) {
      const minVal = Number(criteria.minSalary);
      if (!isNaN(minVal) && minVal > 0) {
        andConditions.push({
          OR: [
            { salaryMin: { gte: new Prisma.Decimal(minVal) } },
            { salaryMax: { gte: new Prisma.Decimal(minVal) } },
          ],
        });
      }
    }

    if (criteria.maxSalary !== undefined && criteria.maxSalary !== null) {
      const maxVal = Number(criteria.maxSalary);
      if (!isNaN(maxVal) && maxVal > 0) {
        andConditions.push({
          OR: [
            { salaryMin: { lte: new Prisma.Decimal(maxVal) } },
            { salaryMax: { lte: new Prisma.Decimal(maxVal) } },
          ],
        });
      }
    }

    return { AND: andConditions };
  }

  /**
   * Evaluates if a given job in memory satisfies the saved search criteria
   */
  static matchesJob(criteria: SavedSearchCriteria, job: JobWithCategory, now: Date = new Date()): boolean {
    // 1. Job lifecycle status
    if (job.status !== 'ACTIVE') return false;
    if (job.classificationStatus === 'FAILED' || job.classificationStatus === 'REVIEW_REQUIRED') return false;
    if (job.closingDate && job.closingDate < now) return false;

    // 2. Keywords check
    if (criteria.search && criteria.search.trim()) {
      const query = criteria.search.trim().toLowerCase();
      const titleMatch =
        (job.normalizedTitle && job.normalizedTitle.toLowerCase().includes(query)) ||
        (job.originalTitle && job.originalTitle.toLowerCase().includes(query));
      const companyMatch = job.companyName && job.companyName.toLowerCase().includes(query);
      const descMatch =
        (job.normalizedDescription && job.normalizedDescription.toLowerCase().includes(query)) ||
        (job.originalDescription && job.originalDescription.toLowerCase().includes(query));

      if (!titleMatch && !companyMatch && !descMatch) {
        return false;
      }
    }

    // 3. Category match
    if (criteria.categorySlug && criteria.categorySlug.trim()) {
      const catReq = criteria.categorySlug.trim().toLowerCase();
      const jobCategorySlug = job.category?.slug?.toLowerCase();
      const jobCategoryId = job.categoryId?.toLowerCase();
      if (jobCategorySlug !== catReq && jobCategoryId !== catReq) {
        return false;
      }
    }

    // 4. City match
    if (criteria.city && criteria.city.trim()) {
      const cityReq = criteria.city.trim().toLowerCase();
      if (!job.city || !job.city.toLowerCase().includes(cityReq)) {
        return false;
      }
    }

    // 5. Country match
    if (criteria.country && criteria.country.trim()) {
      const countryReq = criteria.country.trim().toLowerCase();
      if (!job.country || !job.country.toLowerCase().includes(countryReq)) {
        return false;
      }
    }

    // 6. Work Arrangement
    if (criteria.workArrangement) {
      if (job.workArrangement !== criteria.workArrangement) {
        return false;
      }
    }

    // 7. Employment Type
    if (criteria.employmentType) {
      if (job.employmentType !== criteria.employmentType) {
        return false;
      }
    }

    // 8. Experience Level
    if (criteria.experienceLevel) {
      if (job.experienceLevel !== criteria.experienceLevel) {
        return false;
      }
    }

    // 9. Remote Eligibility
    if (criteria.remoteEligibility && criteria.remoteEligibility.trim()) {
      const req = criteria.remoteEligibility.trim().toLowerCase();
      const jobEligibility = (job.remoteEligibility || '').toLowerCase();
      if (!jobEligibility.includes(req) && !jobEligibility.includes('worldwide') && !jobEligibility.includes('anywhere')) {
        return false;
      }
    }

    // 10. Salary range check
    if (criteria.minSalary !== undefined && criteria.minSalary !== null) {
      const minNum = Number(criteria.minSalary);
      if (!isNaN(minNum) && minNum > 0) {
        const jobMin = job.salaryMin !== null ? Number(job.salaryMin) : null;
        const jobMax = job.salaryMax !== null ? Number(job.salaryMax) : null;
        if (jobMin === null && jobMax === null) {
          // If no salary on job, does not satisfy strict min salary filter
          return false;
        }
        const effectiveMax = jobMax !== null ? jobMax : jobMin!;
        if (effectiveMax < minNum) {
          return false;
        }
      }
    }

    if (criteria.maxSalary !== undefined && criteria.maxSalary !== null) {
      const maxNum = Number(criteria.maxSalary);
      if (!isNaN(maxNum) && maxNum > 0) {
        const jobMin = job.salaryMin !== null ? Number(job.salaryMin) : null;
        const jobMax = job.salaryMax !== null ? Number(job.salaryMax) : null;
        if (jobMin === null && jobMax === null) {
          return false;
        }
        const effectiveMin = jobMin !== null ? jobMin : jobMax!;
        if (effectiveMin > maxNum) {
          return false;
        }
      }
    }

    return true;
  }
}
