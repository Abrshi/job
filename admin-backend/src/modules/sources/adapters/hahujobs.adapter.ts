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

export interface HaHuJobEntity {
  id?: string | null;
  name?: string | null;
  logo?: string | null;
}

export interface HaHuJobCompany {
  id?: string | null;
  name?: string | null;
}

export interface HaHuJobCityItem {
  city?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export interface HaHuJobSubSector {
  id?: string | null;
  name?: string | null;
  sector?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

export interface HaHuJobItem {
  id: string;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  type?: string | null;
  years_of_experience?: number | null;
  max_years_of_experience?: number | null;
  salary?: number | null;
  salary_currency?: string | null;
  payment_period?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  approved_on?: string | null;
  posted_on?: string | null;
  location?: string | null;
  is_online?: boolean | null;
  application_method?: string | null;
  application_url?: string | null;
  application_email?: string | null;
  how_to_apply?: string | null;
  url?: string | null;
  source?: string | null;
  expired?: boolean | null;
  requested_to_delete?: boolean | null;
  priority?: number | null;
  number_of_applicants?: number | null;
  view_count?: number | null;
  esco_code?: string | null;
  entity?: HaHuJobEntity | null;
  company?: HaHuJobCompany | null;
  job_cities?: HaHuJobCityItem[] | null;
  sub_sector?: HaHuJobSubSector | null;
}

export interface HaHuGraphQLResponse {
  data?: {
    search_jobs?: HaHuJobItem[];
    search_jobs_aggregate?: {
      aggregate?: {
        count?: number;
      };
    };
  };
  errors?: Array<{
    message: string;
    extensions?: Record<string, unknown>;
  }>;
}

export const HAHU_JOBS_QUERY = `
  query SearchJobs($limit: Int!, $offset: Int!, $where: jobs_bool_exp!, $order_by: [jobs_order_by!]) {
    search_jobs(limit: $limit, offset: $offset, where: $where, order_by: $order_by) {
      id
      title
      summary
      description
      type
      years_of_experience
      max_years_of_experience
      salary
      salary_currency
      payment_period
      deadline
      created_at
      updated_at
      approved_on
      posted_on
      location
      is_online
      application_method
      application_url
      application_email
      how_to_apply
      url
      source
      expired
      requested_to_delete
      priority
      number_of_applicants
      view_count
      esco_code
      entity {
        id
        name
        logo
      }
      company {
        id
        name
      }
      job_cities {
        city {
          id
          name
        }
      }
      sub_sector {
        id
        name
        sector {
          id
          name
        }
      }
    }
    search_jobs_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export class HahuJobsAdapter implements SourceAdapter {
  readonly name = 'HaHuJobs';
  readonly slug = 'hahujobs';

  private normalizeText(str?: string | null): string {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mapEmploymentType(type?: string | null): EmploymentTypeEnum | null {
    if (!type) return null;
    const lower = type.toLowerCase().replace(/[-_\s]+/g, '_');
    if (lower.includes('full_time') || lower === 'fulltime') return 'FULL_TIME';
    if (lower.includes('part_time') || lower === 'parttime') return 'PART_TIME';
    if (lower.includes('contract')) return 'CONTRACT';
    if (lower.includes('intern')) return 'INTERNSHIP';
    if (lower.includes('freelance')) return 'FREELANCE';
    return null;
  }

  private mapExperienceLevel(
    years?: number | null,
    textSnippet?: string | null
  ): ExperienceLevelEnum | null {
    if (typeof years === 'number') {
      if (years === 0) return 'ENTRY';
      if (years >= 1 && years <= 2) return 'JUNIOR';
      if (years >= 3 && years <= 5) return 'MID';
      if (years > 5) return 'SENIOR';
    }

    if (textSnippet) {
      const lower = textSnippet.toLowerCase();
      if (/\b(entry|fresh|graduate|intern)\b/.test(lower)) return 'ENTRY';
      if (/\b(junior|jr)\b/.test(lower)) return 'JUNIOR';
      if (/\b(mid|intermediate)\b/.test(lower)) return 'MID';
      if (/\b(senior|sr)\b/.test(lower)) return 'SENIOR';
      if (/\b(lead|principal|manager)\b/.test(lower)) return 'LEAD';
      if (/\b(executive|director|head of|vp)\b/.test(lower)) return 'EXECUTIVE';
    }

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

  private cleanLocation(
    locationStr?: string | null,
    cities?: HaHuJobCityItem[] | null
  ): { city: string | null; country: string } {
    const country = 'Ethiopia';

    if (cities && cities.length > 0 && cities[0]?.city?.name) {
      return {
        city: cities[0].city.name.trim(),
        country,
      };
    }

    if (!locationStr) {
      return { city: null, country };
    }

    // Clean location strings like ", Addis abeba" or "Addis Ababa, Ethiopia"
    const cleaned = locationStr
      .replace(/^[\s,]+/, '')
      .replace(/[\s,]+$/, '')
      .trim();

    if (!cleaned) {
      return { city: null, country };
    }

    // Split by comma
    const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
    const firstPart = parts[0] || cleaned;

    // Normalize common variations like "Addis abeba" -> "Addis Ababa"
    let cityName = firstPart;
    if (/addis\s*ab[ea]ba/i.test(firstPart)) {
      cityName = 'Addis Ababa';
    }

    return {
      city: cityName,
      country,
    };
  }

  private mapWorkArrangement(
    isOnline?: boolean | null,
    locationStr?: string | null,
    titleAndDesc?: string | null
  ): { isRemote: boolean; arrangement: WorkArrangementType } {
    const combined = `${locationStr || ''} ${titleAndDesc || ''}`.toLowerCase();

    if (combined.includes('hybrid')) {
      return { isRemote: false, arrangement: 'HYBRID' };
    }

    if (combined.includes('remote') || combined.includes('work from home') || combined.includes('telecommute')) {
      return { isRemote: true, arrangement: 'REMOTE' };
    }

    if (isOnline === true) {
      // is_online indicates online access/submission; check if there is an on-site physical location
      if (!locationStr || locationStr.toLowerCase().includes('remote')) {
        return { isRemote: true, arrangement: 'REMOTE' };
      }
    }

    return { isRemote: false, arrangement: 'ON_SITE' };
  }

  private mapApplicationUrls(job: HaHuJobItem): {
    originalUrl: string;
    applicationUrl: string | null;
  } {
    // 1. Original vacancy link
    let originalUrl = `https://hahu.jobs/jobs/${job.id}`;
    if (job.url && job.url.trim().startsWith('http')) {
      originalUrl = normalizeUrl(job.url);
    }

    // 2. Application link
    let applicationUrl: string | null = null;
    if (job.application_url && job.application_url.trim().startsWith('http')) {
      applicationUrl = normalizeUrl(job.application_url);
    } else if (job.application_method === 'email' && job.application_email && job.application_email.includes('@')) {
      applicationUrl = `mailto:${job.application_email.trim()}`;
    }

    return { originalUrl, applicationUrl };
  }

  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 54;
    const offset = typeof options?.checkpoint === 'number' ? options.checkpoint : 0;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: 'https://hahu.jobs',
      Referer: 'https://hahu.jobs/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Incorporate custom source headers if configured (e.g. API keys or authorization)
    if (source.headers && typeof source.headers === 'object' && !Array.isArray(source.headers)) {
      for (const [key, val] of Object.entries(source.headers)) {
        if (typeof val === 'string') {
          requestHeaders[key] = val;
        }
      }
    }

    const payload = {
      query: HAHU_JOBS_QUERY,
      variables: {
        limit,
        offset,
        where: {
          expired: { _eq: false },
          requested_to_delete: { _eq: false },
        },
        order_by: [
          { priority: 'desc' },
          { deadline: 'asc' },
        ],
      },
    };

    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: unknown = null;

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        response = await fetch(source.endpointUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we got a 5xx response, retry
        if (response.status >= 500 && attempts < maxAttempts) {
          logger.warn(`HaHuJobs API returned HTTP ${response.status}, retrying attempt ${attempts}...`);
          await new Promise((r) => setTimeout(r, 1000 * attempts));
          continue;
        }

        break;
      } catch (networkErr: unknown) {
        clearTimeout(timeoutId);
        lastError = networkErr;
        logger.warn(`HaHuJobs fetch attempt ${attempts} failed: ${(networkErr as Error).message}`);
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempts));
        }
      }
    }

    if (!response) {
      throw AppError.badRequest(
        `Failed to reach HaHuJobs endpoint after ${maxAttempts} attempts: ${(lastError as Error)?.message || 'Network failure'}`,
        'SOURCE_FETCH_ERROR',
        undefined,
        lastError
      );
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }

      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          `HaHuJobs endpoint returned HTTP ${response.status} (Access restricted). Please configure authorized credentials in source settings.`,
          response.status,
          'SOURCE_AUTH_REQUIRED'
        );
      }

      throw AppError.badRequest(
        `HaHuJobs API returned HTTP ${response.status}`,
        'SOURCE_HTTP_ERROR',
        [{ field: 'endpoint', message: errorBody.slice(0, 300) }]
      );
    }

    let jsonResponse: HaHuGraphQLResponse;
    try {
      jsonResponse = (await response.json()) as HaHuGraphQLResponse;
    } catch {
      throw AppError.badRequest('Invalid JSON received from HaHuJobs endpoint', 'SOURCE_INVALID_RESPONSE');
    }

    if (jsonResponse.errors && jsonResponse.errors.length > 0) {
      const msg = jsonResponse.errors[0]?.message || 'GraphQL error returned from HaHuJobs';
      logger.error('HaHuJobs GraphQL error:', { message: msg });
      throw AppError.badRequest(`HaHuJobs GraphQL error: ${msg}`, 'SOURCE_GRAPHQL_ERROR');
    }

    const rawList: HaHuJobItem[] = jsonResponse.data?.search_jobs || [];
    const mappedJobs: RawJobPosting[] = rawList
      .filter((j) => !j.requested_to_delete)
      .map((j) => {
        const externalId = j.id ? String(j.id) : null;
        const { originalUrl, applicationUrl } = this.mapApplicationUrls(j);
        const companyName = j.entity?.name || j.company?.name || null;
        const { city, country } = this.cleanLocation(j.location, j.job_cities);

        const { isRemote, arrangement } = this.mapWorkArrangement(
          j.is_online,
          j.location,
          `${j.title || ''} ${j.summary || ''}`
        );

        const employmentType = this.mapEmploymentType(j.type);
        const experienceLevel = this.mapExperienceLevel(
          j.years_of_experience,
          `${j.title || ''} ${j.summary || ''}`
        );

        const salaryNumeric = typeof j.salary === 'number' ? j.salary : null;
        const salaryCurrency = j.salary_currency || (salaryNumeric ? 'ETB' : null);
        const salaryPeriod = this.mapSalaryPeriod(j.payment_period);

        const publishedAt = j.posted_on
          ? new Date(j.posted_on)
          : j.approved_on
          ? new Date(j.approved_on)
          : j.created_at
          ? new Date(j.created_at)
          : null;

        const closingDate = j.deadline ? new Date(j.deadline) : null;

        return {
          externalId,
          originalUrl,
          applicationUrl,
          title: j.title ? j.title.trim() : 'Untitled Position',
          description: j.description || j.summary || '',
          companyName,
          country,
          city,
          isRemote,
          workArrangement: arrangement,
          employmentType,
          experienceLevel,
          salaryMin: salaryNumeric,
          salaryMax: salaryNumeric,
          salaryCurrency,
          salaryPeriod,
          publishedAt,
          closingDate,
          rawPayload: j as unknown as Record<string, unknown>,
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

    const originalUrl = normalizeUrl(raw.originalUrl);

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
      country: raw.country ? raw.country.trim() : 'Ethiopia',
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

export const hahuJobsAdapter = new HahuJobsAdapter();
