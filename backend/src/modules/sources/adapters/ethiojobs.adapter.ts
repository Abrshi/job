import { JobSource } from '@prisma/client';
import {
  SourceAdapter,
  RawJobPosting,
  NormalizedJob,
  FetchOptions,
  FetchResult,
  EmploymentTypeEnum,
  ExperienceLevelEnum,
  WorkArrangementType,
} from './source-adapter.interface';
import { generateJobFingerprint, normalizeUrl } from './fingerprint.util';
import { AppError } from '../../../middleware/error-handler';
import { logger } from '../../../lib/logger';

export interface EthioJobsCompany {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  logo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface EthioJobsCatalog {
  id?: string | null;
  name?: string | null;
  options?: number | null;
}

export interface EthioJobsItem {
  id: string;
  title?: string | null;
  slug?: string | null;
  type?: number | string | null;
  date_published?: string | null;
  level?: number | string | null;
  location_type?: string | null;
  description?: string | null;
  state?: string | null;
  catalogs?: EthioJobsCatalog[] | null;
  date_expiry?: string | null;
  company?: EthioJobsCompany | null;
  application_form?: string | null;
  career_page_link?: string | null;
  application_method?: string | null;
  application_email?: string | null;
}

export interface EthioJobsMeta {
  pageNumber?: number;
  itemsPerPage?: number;
  lastPage?: number;
  total?: number;
}

export interface EthioJobsResponse {
  pageProps?: {
    jobs?: {
      meta?: EthioJobsMeta;
      data?: EthioJobsItem[];
    };
    token?: string;
  };
}

const DEFAULT_BUILD_ID = 'QtcrrOcxu8l4IzwsA07Nh';
const BUILD_ID_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class EthioJobsAdapter implements SourceAdapter {
  readonly name = 'Ethiojobs';
  readonly slug = 'ethiojobs';

  private cachedBuildId: { buildId: string; expiresAt: number } | null = null;

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

  private mapEmploymentType(
    type?: number | string | null,
    textSnippet?: string | null
  ): EmploymentTypeEnum | null {
    if (typeof type === 'number') {
      if (type === 8) return 'FULL_TIME';
      if (type === 13) return 'CONTRACT';
    }

    if (typeof type === 'string') {
      const lower = type.toLowerCase().replace(/[-_\s]+/g, '_');
      if (lower.includes('full_time') || lower === 'fulltime') return 'FULL_TIME';
      if (lower.includes('part_time') || lower === 'parttime') return 'PART_TIME';
      if (lower.includes('contract')) return 'CONTRACT';
      if (lower.includes('intern')) return 'INTERNSHIP';
      if (lower.includes('freelance')) return 'FREELANCE';
    }

    if (textSnippet) {
      const lower = textSnippet.toLowerCase();
      if (/\b(full[\s-]?time)\b/.test(lower)) return 'FULL_TIME';
      if (/\b(part[\s-]?time)\b/.test(lower)) return 'PART_TIME';
      if (/\b(contract|consultancy|rfp|temporary)\b/.test(lower)) return 'CONTRACT';
      if (/\b(intern|internship)\b/.test(lower)) return 'INTERNSHIP';
      if (/\b(freelance|freelancer)\b/.test(lower)) return 'FREELANCE';
    }

    return null;
  }

  private mapExperienceLevel(
    level?: number | string | null,
    textSnippet?: string | null
  ): ExperienceLevelEnum | null {
    const numericLevel = typeof level === 'string' ? parseInt(level, 10) : typeof level === 'number' ? level : null;

    if (numericLevel !== null && !isNaN(numericLevel)) {
      if (numericLevel === 1) return 'ENTRY';
      if (numericLevel === 2) return 'JUNIOR';
      if (numericLevel === 3) return 'MID';
      if (numericLevel === 4) return 'SENIOR';
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

  private cleanLocation(state?: string | null): { city: string | null; country: string } {
    const country = 'Ethiopia';
    if (!state) return { city: null, country };

    const cleaned = state
      .replace(/^[\s,]+/, '')
      .replace(/[\s,]+$/, '')
      .trim();

    if (!cleaned) return { city: null, country };

    // E.g. "Hawassa, Sidama" -> take primary location "Hawassa"
    const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[0] || cleaned;

    return { city, country };
  }

  private mapWorkArrangement(
    locationType?: string | null,
    state?: string | null,
    textSnippet?: string | null
  ): { isRemote: boolean; arrangement: WorkArrangementType } {
    const locLower = (locationType || '').toLowerCase();
    const textLower = `${state || ''} ${textSnippet || ''}`.toLowerCase();

    if (locLower.includes('remote') || /\b(fully remote|100% remote|remote work)\b/.test(textLower)) {
      return { isRemote: true, arrangement: 'REMOTE' };
    }

    if (locLower.includes('hybrid') || /\b(hybrid work|hybrid arrangement)\b/.test(textLower)) {
      return { isRemote: false, arrangement: 'HYBRID' };
    }

    return { isRemote: false, arrangement: 'ON_SITE' };
  }

  private mapApplicationUrls(job: EthioJobsItem): { originalUrl: string; applicationUrl: string | null } {
    const slug = job.slug ? job.slug.trim() : job.id;
    const originalUrl = `https://ethiojobs.net/jobs/${slug}`;

    let applicationUrl: string | null = null;

    if (job.application_form && job.application_form.trim().startsWith('http')) {
      applicationUrl = normalizeUrl(job.application_form);
    } else if (job.career_page_link && job.career_page_link.trim().startsWith('http')) {
      applicationUrl = normalizeUrl(job.career_page_link);
    } else if (job.application_email && job.application_email.includes('@')) {
      applicationUrl = `mailto:${job.application_email.trim()}`;
    }

    return { originalUrl, applicationUrl };
  }

  /**
   * Dynamically resolves the active Next.js buildId from ethiojobs.net/en/jobs
   * or falls back to custom header override or cached buildId.
   */
  async resolveBuildId(source: JobSource): Promise<string> {
    // 1. Check custom header override
    if (source.headers && typeof source.headers === 'object' && !Array.isArray(source.headers)) {
      const customBuildId = (source.headers as Record<string, unknown>).buildId;
      if (typeof customBuildId === 'string' && customBuildId.trim()) {
        return customBuildId.trim();
      }
    }

    // 2. Check active in-memory cache
    if (this.cachedBuildId && Date.now() < this.cachedBuildId.expiresAt) {
      return this.cachedBuildId.buildId;
    }

    // 3. Dynamically discover from landing page
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('https://ethiojobs.net/en/jobs', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const match = html.match(/"buildId":"([^"]+)"/);
        if (match && match[1]) {
          const discovered = match[1].trim();
          this.cachedBuildId = {
            buildId: discovered,
            expiresAt: Date.now() + BUILD_ID_CACHE_TTL_MS,
          };
          logger.info(`Ethiojobs buildId dynamically resolved: ${discovered}`);
          return discovered;
        }
      }
    } catch (err) {
      logger.warn(`Ethiojobs dynamic buildId discovery failed: ${(err as Error).message}. Falling back.`);
    }

    return DEFAULT_BUILD_ID;
  }

  /**
   * Invalidate cached buildId when a 404 is encountered.
   */
  invalidateBuildIdCache(): void {
    this.cachedBuildId = null;
  }

  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const pageNumber = typeof options?.checkpoint === 'number' ? options.checkpoint : 1;

    let buildId = await this.resolveBuildId(source);
    let targetUrl = `https://ethiojobs.net/_next/data/${buildId}/en/jobs.json?page=${pageNumber}&isFeatured=false`;

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Incorporate custom headers if configured (stripping any sensitive keys)
    if (source.headers && typeof source.headers === 'object' && !Array.isArray(source.headers)) {
      for (const [key, val] of Object.entries(source.headers)) {
        if (typeof val === 'string' && key.toLowerCase() !== 'buildid') {
          requestHeaders[key] = val;
        }
      }
    }

    let response: Response | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: unknown = null;
    let retried404 = false;

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        response = await fetch(targetUrl, {
          method: 'GET',
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If 404, buildId may have expired upstream; refresh once and retry
        if (response.status === 404 && !retried404) {
          retried404 = true;
          this.invalidateBuildIdCache();
          buildId = await this.resolveBuildId(source);
          targetUrl = `https://ethiojobs.net/_next/data/${buildId}/en/jobs.json?page=${pageNumber}&isFeatured=false`;
          logger.warn(`Ethiojobs returned 404, refreshed buildId to '${buildId}' and retrying...`);
          continue;
        }

        // Retry on 5xx server errors
        if (response.status >= 500 && attempts < maxAttempts) {
          logger.warn(`Ethiojobs returned HTTP ${response.status}, retrying attempt ${attempts}...`);
          await new Promise((r) => setTimeout(r, 1000 * attempts));
          continue;
        }

        break;
      } catch (networkErr: unknown) {
        clearTimeout(timeoutId);
        lastError = networkErr;
        logger.warn(`Ethiojobs fetch attempt ${attempts} failed: ${(networkErr as Error).message}`);
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempts));
        }
      }
    }

    if (!response) {
      throw AppError.badRequest(
        `Failed to reach Ethiojobs endpoint after ${maxAttempts} attempts: ${(lastError as Error)?.message || 'Network failure'}`,
        'SOURCE_FETCH_ERROR',
        undefined,
        lastError
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          `Ethiojobs endpoint returned HTTP ${response.status} (Access restricted). Please check authorization settings.`,
          response.status,
          'SOURCE_AUTH_REQUIRED'
        );
      }

      throw AppError.badRequest(
        `Ethiojobs API returned HTTP ${response.status}`,
        'SOURCE_HTTP_ERROR'
      );
    }

    let jsonResponse: EthioJobsResponse;
    try {
      jsonResponse = (await response.json()) as EthioJobsResponse;
    } catch {
      throw AppError.badRequest('Invalid JSON received from Ethiojobs endpoint', 'SOURCE_INVALID_RESPONSE');
    }

    const jobsContainer = jsonResponse.pageProps?.jobs;
    const rawList: EthioJobsItem[] = jobsContainer?.data || [];
    const meta: EthioJobsMeta = jobsContainer?.meta || {};

    const mappedJobs: RawJobPosting[] = rawList.map((j) => {
      const externalId = j.id ? String(j.id) : j.slug ? String(j.slug) : null;
      const { originalUrl, applicationUrl } = this.mapApplicationUrls(j);
      const companyName = j.company?.name ? j.company.name.trim() : null;
      const { city, country } = this.cleanLocation(j.state);

      const snippet = `${j.title || ''} ${this.normalizeText(j.description).slice(0, 200)}`;
      const { isRemote, arrangement } = this.mapWorkArrangement(j.location_type, j.state, snippet);

      const employmentType = this.mapEmploymentType(j.type, snippet);
      const experienceLevel = this.mapExperienceLevel(j.level, snippet);

      const publishedAt = j.date_published ? new Date(j.date_published) : null;
      const closingDate = j.date_expiry ? new Date(j.date_expiry) : null;

      // Preserve raw payload without sensitive internal tokens
      const safePayload = { ...j };

      return {
        externalId,
        originalUrl,
        applicationUrl,
        title: j.title ? j.title.trim() : 'Untitled Position',
        description: j.description || '',
        companyName,
        country,
        city,
        isRemote,
        workArrangement: arrangement,
        employmentType,
        experienceLevel,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        publishedAt,
        closingDate,
        rawPayload: safePayload as unknown as Record<string, unknown>,
      };
    });

    const lastPage = typeof meta.lastPage === 'number' ? meta.lastPage : 1;
    const hasMore = pageNumber < lastPage && mappedJobs.length > 0;
    const nextCheckpoint = hasMore ? pageNumber + 1 : undefined;

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

export const ethioJobsAdapter = new EthioJobsAdapter();

