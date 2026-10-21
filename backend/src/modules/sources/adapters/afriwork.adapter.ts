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
      query GetAfriworkJobs($limit: Int, $offset: Int) {
        jobs(limit: $limit, offset: $offset, order_by: { created_at: desc }) {
          id
          title
          description
          created_at
          deadline
          employment_type
          experience_level
          is_remote
          city
          country
          min_salary
          max_salary
          salary_currency
          salary_period
          company {
            name
            website
          }
          application_url
        }
      }
    `;

    // Construct headers, incorporating source.headers if configured
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'JobAggregator/1.0 (+https://github.com/starcher/job)',
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
          variables: { limit, offset },
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

      return {
        externalId,
        originalUrl,
        applicationUrl: j.application_url || null,
        title: j.title || 'Untitled Position',
        description: j.description || '',
        companyName: j.company?.name || null,
        country: j.country || 'Ethiopia',
        city: j.city || null,
        isRemote: Boolean(j.is_remote),
        workArrangement: j.is_remote ? 'REMOTE' : 'ON_SITE',
        employmentType: this.mapEmploymentType(j.employment_type),
        experienceLevel: this.mapExperienceLevel(j.experience_level),
        salaryMin: typeof j.min_salary === 'number' ? j.min_salary : null,
        salaryMax: typeof j.max_salary === 'number' ? j.max_salary : null,
        salaryCurrency: j.salary_currency || (j.min_salary ? 'ETB' : null),
        salaryPeriod: this.mapSalaryPeriod(j.salary_period),
        publishedAt: j.created_at ? new Date(j.created_at) : null,
        closingDate: j.deadline ? new Date(j.deadline) : null,
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
