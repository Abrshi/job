import { JobSource } from '@prisma/client';
import https from 'https';
import dns from 'dns';
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

export interface GeezJobsCard {
  url: string;
  slug: string;
  title: string;
  company?: string | null;
  location?: string | null;
  deadline?: string | null;
  employmentType?: string | null;
  experience?: string | null;
  postedAt?: string | null;
  logo?: string | null;
}

export interface GeezJobsSchemaJobPosting {
  '@context'?: string;
  '@type'?: string;
  title?: string;
  description?: string;
  identifier?: {
    '@type'?: string;
    name?: string;
    value?: string;
  };
  url?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string[] | string;
  hiringOrganization?: {
    '@type'?: string;
    name?: string;
    logo?: string;
  };
  jobLocation?: {
    '@type'?: string;
    address?: {
      '@type'?: string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
  baseSalary?: {
    '@type'?: string;
    currency?: string;
    value?: {
      '@type'?: string;
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
  };
  workHours?: string;
  applicantLocationRequirements?: {
    '@type'?: string;
    name?: string;
  };
}

export class GeezJobsAdapter implements SourceAdapter {
  readonly name = 'GeezJobs';
  readonly slug = 'geezjobs';

  private readonly httpsAgent: https.Agent;

  constructor() {
    this.httpsAgent = new https.Agent({
      lookup: (hostname, opts, cb) => {
        dns.lookup(hostname, { ...opts, family: 4 }, cb);
      },
      keepAlive: true,
      maxSockets: 5,
    });
  }

  private normalizeText(str?: string | null): string {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, ' ') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanTitle(title?: string | null): string {
    if (!title) return 'Untitled Position';
    return this.normalizeText(title)
      .replace(/\s+via\s+geezjobs$/i, '')
      .replace(/^!+\s*urgent\s+/i, '')
      .trim();
  }

  private mapEmploymentType(type?: string | string[] | null, textSnippet?: string | null): EmploymentTypeEnum | null {
    const rawType = Array.isArray(type) ? type[0] : type;
    const lower = `${rawType || ''} ${textSnippet || ''}`.toLowerCase();

    if (lower.includes('full_time') || lower.includes('full-time') || lower.includes('permanent')) {
      return 'FULL_TIME';
    }
    if (lower.includes('part_time') || lower.includes('part-time')) {
      return 'PART_TIME';
    }
    if (lower.includes('contract') || lower.includes('fixed_term') || lower.includes('temporary')) {
      return 'CONTRACT';
    }
    if (lower.includes('intern') || lower.includes('internship') || lower.includes('trainee')) {
      return 'INTERNSHIP';
    }
    if (lower.includes('freelance') || lower.includes('consultant')) {
      return 'FREELANCE';
    }

    return null;
  }

  private mapExperienceLevel(expText?: string | null, textSnippet?: string | null): ExperienceLevelEnum | null {
    const text = `${expText || ''} ${textSnippet || ''}`.toLowerCase();

    if (/\b(fresh\s*graduate|0\s*years?|no\s*experience|entry\s*level|intern)\b/.test(text)) {
      return 'ENTRY';
    }
    if (/\b(1\s*[-–]\s*2\s*years?|1\s*\+?\s*years?|junior)\b/.test(text)) {
      return 'JUNIOR';
    }
    if (/\b(2\s*[-–]\s*(4|5|6)\s*years?|3\s*[-–]\s*5\s*years?|mid\s*level)\b/.test(text)) {
      return 'MID';
    }
    if (/\b(5\s*\+?\s*years?|6\s*\+?\s*years?|7\s*\+?\s*years?|8\s*\+?\s*years?|10\s*\+?\s*years?|senior)\b/.test(text)) {
      return 'SENIOR';
    }
    if (/\b(lead|principal|head\s*of|supervisor|manager)\b/.test(text)) {
      return 'LEAD';
    }
    if (/\b(director|chief|cfo|ceo|coo|executive)\b/.test(text)) {
      return 'EXECUTIVE';
    }

    return 'UNSPECIFIED';
  }

  private mapSalaryPeriod(unitText?: string | null): SalaryPeriodEnum | null {
    if (!unitText) return null;
    const lower = unitText.toLowerCase();
    if (lower.includes('month')) return 'MONTHLY';
    if (lower.includes('year') || lower.includes('annum')) return 'YEARLY';
    if (lower.includes('hour')) return 'HOURLY';
    return null;
  }

  private cleanLocation(location?: string | null): { city: string | null; country: string } {
    const country = 'Ethiopia';
    if (!location) return { city: null, country };

    let cleaned = this.normalizeText(location)
      .replace(/-\s*ethiopia$/i, '')
      .replace(/,\s*ethiopia$/i, '')
      .replace(/ethiopia$/i, '')
      .trim();

    // "Around Jackros, Addis Ababa" -> extract "Addis Ababa" if present, else primary city
    if (/addis\s*ababa/i.test(cleaned)) {
      return { city: 'Addis Ababa', country };
    }

    const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
    const city = parts[parts.length - 1] || parts[0] || cleaned;

    return { city: city || null, country };
  }

  private mapWorkArrangement(
    locationSnippet?: string | null,
    textSnippet?: string | null
  ): { isRemote: boolean; arrangement: WorkArrangementType } {
    const combined = `${locationSnippet || ''} ${textSnippet || ''}`.toLowerCase();

    if (/\b(fully remote|100% remote|remote work|remote)\b/.test(combined)) {
      return { isRemote: true, arrangement: 'REMOTE' };
    }

    if (/\b(hybrid work|hybrid arrangement|hybrid)\b/.test(combined)) {
      return { isRemote: false, arrangement: 'HYBRID' };
    }

    return { isRemote: false, arrangement: 'ON_SITE' };
  }

  /**
   * Safe HTTP GET with IPv4 lookup, custom cookie, timeout, and custom headers.
   */
  async requestHtml(url: string, timeoutMs = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = https.get(
        parsedUrl,
        {
          agent: this.httpsAgent,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Cookie: 'gj_ok=1',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} received from ${url}`));
            res.resume();
            return;
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve(data);
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timeout after ${timeoutMs}ms for ${url}`));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Parse the search jobs page to extract job items and pagination
   */
  parseSearchPage(html: string): { cards: GeezJobsCard[]; hasMore: boolean } {
    const cards: GeezJobsCard[] = [];
    const seenUrls = new Set<string>();

    // 1. Try to extract JSON-LD ItemList
    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    for (const match of ldMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
            for (const elem of item.itemListElement) {
              const jobItem = elem.item;
              if (jobItem && jobItem.url) {
                const url = jobItem.url.startsWith('http')
                  ? jobItem.url
                  : `https://geezjobs.com${jobItem.url}`;
                const slug = url.split('/').pop() || '';
                if (!seenUrls.has(url)) {
                  seenUrls.add(url);
                  cards.push({
                    url,
                    slug,
                    title: this.cleanTitle(jobItem.title),
                  });
                }
              }
            }
          }
        }
      } catch {
        // Continue to regex card parser if JSON-LD parsing fails
      }
    }

    // 2. Extract HTML card metadata
    const cardRegex = /<h3[^>]*class="[^"]*font-black[^"]*"[^>]*>\s*<a\s+href="(\/job-detail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)(?=<h3[^>]*class="[^"]*font-black[^"]*"|$)/gi;
    let cardMatch;
    while ((cardMatch = cardRegex.exec(html)) !== null) {
      const relUrl = cardMatch[1].trim();
      const fullUrl = `https://geezjobs.com${relUrl}`;
      const title = this.cleanTitle(cardMatch[2]);
      const rest = cardMatch[3];
      const slug = relUrl.split('/').pop() || '';

      const companyMatch = rest.match(/<a\s+href="\/company\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const company = companyMatch ? this.normalizeText(companyMatch[1]) : null;

      const locMatch = rest.match(/data-lucide="map-pin"[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      const location = locMatch ? this.normalizeText(locMatch[1]) : null;

      const deadlineMatch = rest.match(/Deadline:\s*([^<]+)/i);
      const deadline = deadlineMatch ? this.normalizeText(deadlineMatch[1]) : null;

      const typeMatch = rest.match(/data-lucide="briefcase"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
      const employmentType = typeMatch ? this.normalizeText(typeMatch[1]) : null;

      const expMatch = rest.match(/data-lucide="award"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
      const experience = expMatch ? this.normalizeText(expMatch[1]) : null;

      const postedMatch = rest.match(/Posted:\s*([^<]+)/i);
      const postedAt = postedMatch ? this.normalizeText(postedMatch[1]) : null;

      const logoMatch = rest.match(/<img\s+src="([^"]*\/logo\/[^"]*)"/i);
      const logo = logoMatch ? (logoMatch[1].startsWith('http') ? logoMatch[1] : `https://geezjobs.com${logoMatch[1]}`) : null;

      const existingIndex = cards.findIndex((c) => c.url === fullUrl);
      if (existingIndex !== -1) {
        cards[existingIndex] = {
          ...cards[existingIndex],
          company,
          location,
          deadline,
          employmentType,
          experience,
          postedAt,
          logo,
        };
      } else {
        seenUrls.add(fullUrl);
        cards.push({
          url: fullUrl,
          slug,
          title,
          company,
          location,
          deadline,
          employmentType,
          experience,
          postedAt,
          logo,
        });
      }
    }

    // Determine if more pages exist
    const hasMore = cards.length > 0;

    return { cards, hasMore };
  }

  /**
   * Parse the job detail page for JSON-LD and application elements
   */
  parseDetailPage(html: string, fallbackCard?: GeezJobsCard): RawJobPosting {
    let schemaPosting: GeezJobsSchemaJobPosting | null = null;

    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    for (const match of ldMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed['@type'] === 'JobPosting') {
          schemaPosting = parsed as GeezJobsSchemaJobPosting;
          break;
        }
      } catch {
        // ignore parse error
      }
    }

    const title = this.cleanTitle(schemaPosting?.title || fallbackCard?.title || 'Untitled Position');
    const description = schemaPosting?.description || fallbackCard?.title || '';
    const originalUrl = schemaPosting?.url || fallbackCard?.url || '';
    const externalId =
      schemaPosting?.identifier?.value ||
      fallbackCard?.slug ||
      originalUrl.split('/').pop() ||
      null;

    const companyName =
      schemaPosting?.hiringOrganization?.name ||
      fallbackCard?.company ||
      null;

    const address = schemaPosting?.jobLocation?.address;
    const rawLocation = address?.streetAddress || address?.addressLocality || fallbackCard?.location || null;
    const { city, country } = this.cleanLocation(rawLocation);

    const publishedAt = schemaPosting?.datePosted ? new Date(schemaPosting.datePosted) : null;
    const closingDate = schemaPosting?.validThrough ? new Date(schemaPosting.validThrough) : null;

    const employmentType = this.mapEmploymentType(
      schemaPosting?.employmentType || fallbackCard?.employmentType,
      description
    );

    const experienceLevel = this.mapExperienceLevel(
      fallbackCard?.experience,
      description
    );

    const { isRemote, arrangement } = this.mapWorkArrangement(
      rawLocation,
      `${title} ${this.normalizeText(description)}`
    );

    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryPeriod: SalaryPeriodEnum | null = null;

    if (schemaPosting?.baseSalary) {
      salaryCurrency = schemaPosting.baseSalary.currency || 'ETB';
      const val = schemaPosting.baseSalary.value;
      if (val) {
        if (typeof val.minValue === 'number') salaryMin = val.minValue;
        if (typeof val.maxValue === 'number') salaryMax = val.maxValue;
        if (val.unitText) salaryPeriod = this.mapSalaryPeriod(val.unitText);
      }
    }

    // Extract Application URL (email vs direct link)
    let applicationUrl: string | null = null;
    const emailMatch = html.match(/href="mailto:([^"]+)"/i);
    if (emailMatch) {
      applicationUrl = `mailto:${emailMatch[1].trim()}`;
    } else {
      const applyLinkMatch = html.match(/href="(\/job-application\/[^"]+)"/i);
      if (applyLinkMatch) {
        applicationUrl = `https://geezjobs.com${applyLinkMatch[1].trim()}`;
      }
    }

    const rawPayload = {
      ...(schemaPosting || {}),
      card: fallbackCard,
      applicationUrl,
    };

    return {
      externalId,
      originalUrl,
      applicationUrl,
      title,
      description,
      companyName,
      country,
      city,
      isRemote,
      workArrangement: arrangement,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      salaryCurrency,
      salaryPeriod,
      publishedAt,
      closingDate,
      rawPayload,
    };
  }

  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const checkpoint = (options?.checkpoint as { page?: number }) || {};
    const pageNumber = typeof checkpoint.page === 'number' && checkpoint.page > 0 ? checkpoint.page : 1;
    const limit = options?.limit || 100;

    const baseUrl = source.endpointUrl ? source.endpointUrl.replace(/\?.*$/, '') : 'https://geezjobs.com/search-jobs';
    const pageUrl = `${baseUrl}?page=${pageNumber}`;

    logger.info(`[GeezJobsAdapter] Fetching page ${pageNumber} from ${pageUrl}`);

    let searchHtml: string;
    try {
      searchHtml = await this.requestHtml(pageUrl);
    } catch (err: unknown) {
      throw AppError.badRequest(
        `Failed to reach GeezJobs endpoint at ${pageUrl}: ${(err as Error).message}`,
        'SOURCE_HTTP_ERROR'
      );
    }

    const { cards, hasMore: pageHasMore } = this.parseSearchPage(searchHtml);
    logger.info(`[GeezJobsAdapter] Page ${pageNumber} yielded ${cards.length} vacancies.`);

    if (cards.length === 0) {
      return {
        jobs: [],
        checkpoint: undefined,
        hasMore: false,
        recordsFetched: 0,
      };
    }

    const jobsToFetch = cards.slice(0, limit);
    const mappedJobs: RawJobPosting[] = [];

    // Fetch detail pages with bounded concurrency (3 concurrent requests)
    const concurrency = 3;
    for (let i = 0; i < jobsToFetch.length; i += concurrency) {
      const chunk = jobsToFetch.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        chunk.map(async (card) => {
          try {
            const detailHtml = await this.requestHtml(card.url, 12000);
            return this.parseDetailPage(detailHtml, card);
          } catch (detailErr) {
            logger.warn(
              `[GeezJobsAdapter] Failed to fetch detail for ${card.url}, using search card fallback: ${(detailErr as Error).message}`
            );
            return this.fallbackCardToRawPosting(card);
          }
        })
      );

      for (const res of results) {
        if (res.status === 'fulfilled') {
          mappedJobs.push(res.value);
        }
      }

      // Polite delay between batches
      if (i + concurrency < jobsToFetch.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const hasMore = pageHasMore && mappedJobs.length >= 10 && pageNumber < 8;
    const nextCheckpoint = hasMore ? { page: pageNumber + 1 } : undefined;

    return {
      jobs: mappedJobs,
      checkpoint: nextCheckpoint,
      hasMore,
      recordsFetched: mappedJobs.length,
    };
  }

  private fallbackCardToRawPosting(card: GeezJobsCard): RawJobPosting {
    const { city, country } = this.cleanLocation(card.location);
    const { isRemote, arrangement } = this.mapWorkArrangement(card.location, card.title);

    let closingDate: Date | null = null;
    if (card.deadline) {
      const parsed = Date.parse(card.deadline);
      if (!isNaN(parsed)) closingDate = new Date(parsed);
    }

    return {
      externalId: card.slug || null,
      originalUrl: card.url,
      applicationUrl: card.url,
      title: card.title,
      description: `${card.title} at ${card.company || 'Confidential Employer'}. Location: ${card.location || 'Ethiopia'}.`,
      companyName: card.company || null,
      country,
      city,
      isRemote,
      workArrangement: arrangement,
      employmentType: this.mapEmploymentType(card.employmentType, card.title),
      experienceLevel: this.mapExperienceLevel(card.experience, card.title),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      publishedAt: new Date(),
      closingDate,
      rawPayload: { card },
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

export const geezJobsAdapter = new GeezJobsAdapter();
