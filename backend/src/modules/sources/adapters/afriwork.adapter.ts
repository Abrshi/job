import { JobSource } from '@prisma/client';
import {
  SourceAdapter,
  RawJobPosting,
  NormalizedJob,
  FetchOptions,
  FetchResult,
  EmploymentTypeEnum,
  ExperienceLevelEnum,
  SalaryPeriodEnum,
  WorkArrangementType,
} from './source-adapter.interface';
import { generateJobFingerprint, normalizeUrl } from './fingerprint.util';
import { AppError } from '../../../middleware/error-handler';
import { logger } from '../../../lib/logger';

export class AfriworkAdapter implements SourceAdapter {
  readonly name = 'Afriwork';
  readonly slug = 'afriwork';

  private normalizeText(str?: string | null): string {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags if any
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapEmploymentType(type?: string | null): EmploymentTypeEnum | null {
    if (!type) return null;
    const lower = type.toLowerCase().replace(/[-_]/g, ' ');
    if (lower.includes('full')) return 'FULL_TIME';
    if (lower.includes('part')) return 'PART_TIME';
    if (lower.includes('contract')) return 'CONTRACT';
    if (lower.includes('intern')) return 'INTERNSHIP';
    if (lower.includes('freelance')) return 'FREELANCE';
    return null;
  }

  private mapExperienceLevel(level?: string | null): ExperienceLevelEnum | null {
    if (!level) return null;
    const lower = level.toLowerCase();
    if (lower.includes('entry') || lower.includes('fresh') || lower.includes('graduate')) return 'ENTRY';
    if (lower.includes('junior')) return 'JUNIOR';
    if (lower.includes('mid') || lower.includes('intermediate')) return 'MID';
    if (lower.includes('senior') || lower.includes('sr')) return 'SENIOR';
    if (lower.includes('lead') || lower.includes('principal')) return 'LEAD';
    if (lower.includes('exec') || lower.includes('director') || lower.includes('head')) return 'EXECUTIVE';
    return 'UNSPECIFIED';
  }

  private mapSalaryPeriod(period?: string | null): SalaryPeriodEnum | null {
    if (!period) return null;
    const lower = period.toLowerCase();
    if (lower.includes('hour')) return 'HOURLY';
    if (lower.includes('month')) return 'MONTHLY';
    if (lower.includes('year') || lower.includes('annual')) return 'YEARLY';
    return null;
  }

  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;
    const offset = typeof options?.checkpoint === 'number' ? options.checkpoint : 0;

    const query = `
      query GetAllJobs($offset: Int!, $limit: Int!, $whereCondition: jobs_bool_exp!, $orderCondition: [jobs_order_by!]) {
        jobs(order_by: $orderCondition, offset: $offset, limit: $limit, where: $whereCondition) {
          id
          title
          created_at
          updated_at
          published_at
          approval_status
          description
          job_type
          job_site
          deadline
          compensation_amount_cents
          compensation_type
          compensation_currency
          experience_level
          entity {
            type
            name
          }
          city {
            name
            country {
              name
            }
          }
          sectors {
            sector {
              name
              id
            }
          }
          skill_requirements {
            skill {
              name
              id
            }
          }
        }
      }
    `;

    // Construct headers, incorporating source.headers if configured
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-hasura-role': 'anonymous',
      Origin: 'https://afriworket.com',
      Referer: 'https://afriworket.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (source.headers && typeof source.headers === 'object' && !Array.isArray(source.headers)) {
      for (const [key, val] of Object.entries(source.headers)) {
        if (typeof val === 'string') {
          requestHeaders[key] = val;
        }
      }
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      response = await fetch(source.endpointUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          query,
          variables: {
            offset,
            limit,
            whereCondition: { approval_status: { _eq: 'PUBLISHED' } },
            orderCondition: [{ latest_activity_at: 'desc' }],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (networkErr: unknown) {
      const err = networkErr as Error;
      logger.error('Afriwork fetch network failure', {
        message: err.message,
        endpoint: source.endpointUrl,
      });
      throw AppError.badRequest(
        `Failed to reach Afriwork endpoint: ${err.message}`,
        'SOURCE_FETCH_ERROR',
        undefined,
        networkErr
      );
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }

      // Check for authentication webhook refusal
      if (errorBody.includes('Authentication hook unauthorized this request') || errorBody.includes('access-denied')) {
        throw new AppError(
          'Afriwork GraphQL endpoint requires authentication (Authentication hook rejected anonymous request). Please configure valid credentials in source settings.',
          401,
          'SOURCE_AUTH_REQUIRED'
        );
      }

      throw AppError.badRequest(
        `Afriwork API returned HTTP ${response.status}`,
        'SOURCE_HTTP_ERROR',
        [{ field: 'endpoint', message: errorBody.slice(0, 300) }]
      );
    }

    let jsonResponse: any;
    try {
      jsonResponse = await response.json();
    } catch {
      throw AppError.badRequest('Invalid JSON received from Afriwork endpoint', 'SOURCE_INVALID_RESPONSE');
    }

    if (jsonResponse.errors && jsonResponse.errors.length > 0) {
      const msg = jsonResponse.errors[0]?.message || 'GraphQL error returned';
      if (msg.includes('Authentication hook unauthorized')) {
        throw new AppError(
          'Afriwork GraphQL endpoint requires authentication credentials.',
          401,
          'SOURCE_AUTH_REQUIRED'
        );
      }
      throw AppError.badRequest(`Afriwork GraphQL error: ${msg}`, 'SOURCE_GRAPHQL_ERROR');
    }

    const rawJobsList: any[] = jsonResponse?.data?.jobs || [];
    const mappedJobs: RawJobPosting[] = rawJobsList.map((j) => {
      const externalId = j.id ? String(j.id) : null;
      const originalUrl = externalId ? `https://afriworket.com/jobs/${externalId}` : source.endpointUrl;

      // Extract company name from entity or company relation
      const companyName = j.entity?.name || j.company?.name || null;

      // Extract city and country
      const cityName = j.city?.name || (typeof j.city === 'string' ? j.city : null);
      let countryName = j.city?.country?.name || (typeof j.country === 'string' ? j.country : 'Ethiopia');
      if (typeof countryName === 'string' && countryName.toUpperCase() === 'ETHIOPIA') {
        countryName = 'Ethiopia';
      }

      // Remote & work arrangement
      const isRemote = j.job_site === 'REMOTE' || Boolean(j.is_remote);
      let workArrangement: WorkArrangementType = 'ON_SITE';
      if (j.job_site === 'REMOTE' || j.is_remote) {
        workArrangement = 'REMOTE';
      } else if (j.job_site === 'HYBRID') {
        workArrangement = 'HYBRID';
      }

      // Employment type & experience level
      const employmentType = this.mapEmploymentType(j.job_type || j.employment_type);
      const experienceLevel = this.mapExperienceLevel(j.experience_level);

      // Salary
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      if (typeof j.compensation_amount_cents === 'number') {
        salaryMin = j.compensation_amount_cents / 100;
        salaryMax = j.compensation_amount_cents / 100;
      } else {
        if (typeof j.min_salary === 'number') salaryMin = j.min_salary;
        if (typeof j.max_salary === 'number') salaryMax = j.max_salary;
      }

      const salaryCurrency = j.compensation_currency || j.salary_currency || (salaryMin ? 'ETB' : null);
      const salaryPeriod = this.mapSalaryPeriod(j.compensation_type || j.salary_period);

      // Dates
      const publishedAt = j.published_at
        ? new Date(j.published_at)
        : j.created_at
        ? new Date(j.created_at)
        : null;
      const closingDate = j.deadline ? new Date(j.deadline) : null;

      return {
        externalId,
        originalUrl,
        applicationUrl: j.application_url || (externalId ? `https://afriworket.com/jobs/${externalId}` : null),
        title: j.title || 'Untitled Position',
        description: j.description || '',
        companyName,
        country: countryName,
        city: cityName,
        isRemote,
        workArrangement,
        employmentType,
        experienceLevel,
        salaryMin,
        salaryMax,
        salaryCurrency,
        salaryPeriod,
        publishedAt,
        closingDate,
        rawPayload: j,
      };
    });

    const hasMore = mappedJobs.length === limit;
    const nextCheckpoint = hasMore ? offset + limit : undefined;

    return {
      jobs: mappedJobs,
      checkpoint: nextCheckpoint,
      hasMore,
      recordsFetched: mappedJobs.length,
    };
  }

  normalize(raw: RawJobPosting, source: JobSource): NormalizedJob {
    const originalTitle = raw.title.trim();
    const originalDescription = raw.description.trim();

    const normalizedTitle = this.normalizeText(originalTitle);
    const normalizedDescription = this.normalizeText(originalDescription);

    const originalUrl = normalizeUrl(raw.originalUrl || `https://afriworket.com/jobs/${raw.externalId || ''}`);

    const fingerprint = generateJobFingerprint({
      externalId: raw.externalId,
      originalUrl,
      title: normalizedTitle,
      companyName: raw.companyName,
      descriptionSnippet: normalizedDescription.slice(0, 150),
    });

    const workArrangement: WorkArrangementType = raw.isRemote
      ? 'REMOTE'
      : raw.workArrangement || 'ON_SITE';

    return {
      sourceId: source.id,
      externalId: raw.externalId ? String(raw.externalId).trim() : null,
      fingerprint,
      originalUrl,
      applicationUrl: raw.applicationUrl ? normalizeUrl(raw.applicationUrl) : null,
      rawPayload: raw.rawPayload,
      originalTitle,
      originalDescription,
      normalizedTitle,
      normalizedDescription,
      companyName: raw.companyName ? raw.companyName.trim() : null,
      country: raw.country ? raw.country.trim() : null,
      city: raw.city ? raw.city.trim() : null,
      isRemote: Boolean(raw.isRemote || workArrangement === 'REMOTE'),
      workArrangement,
      remoteEligibility: raw.remoteEligibility || null,
      employmentType: raw.employmentType || null,
      experienceLevel: raw.experienceLevel || null,
      salaryMin: raw.salaryMin ?? null,
      salaryMax: raw.salaryMax ?? null,
      salaryCurrency: raw.salaryCurrency || null,
      salaryPeriod: raw.salaryPeriod || null,
      publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
      closingDate: raw.closingDate ? new Date(raw.closingDate) : null,
    };
  }
}

export const afriworkAdapter = new AfriworkAdapter();
