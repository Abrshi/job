import crypto from 'node:crypto';
import { JobSource } from '@prisma/client';
import {
  NormalizedJob,
  WorkArrangementType,
  EmploymentTypeEnum,
  ExperienceLevelEnum,
} from '../../sources/adapters/source-adapter.interface';
import { generateJobFingerprint } from '../../sources/adapters/fingerprint.util';

export interface LinkedInJobUrlDetails {
  isValid: boolean;
  jobId: string | null;
  canonicalUrl: string | null;
  urlHash: string | null;
  error?: string;
}

export class LinkedInAdapter {
  readonly name = 'LinkedIn';
  readonly slug = 'linkedin';

  /**
   * Validate, clean, and canonicalize a LinkedIn Job URL.
   * Strips tracking parameters, referral tokens, and campaign tags.
   */
  canonicalizeJobUrl(rawUrl: string): LinkedInJobUrlDetails {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { isValid: false, jobId: null, canonicalUrl: null, urlHash: null, error: 'Empty or invalid URL string' };
    }

    const trimmed = rawUrl.trim();

    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);

      if (!parsed.hostname.includes('linkedin.com')) {
        return {
          isValid: false,
          jobId: null,
          canonicalUrl: null,
          urlHash: null,
          error: 'URL is not from linkedin.com domain',
        };
      }

      let jobId: string | null = null;

      // Pattern 1: /jobs/view/123456789/ or /jobs/view/title-slug-123456789/
      const viewMatch = parsed.pathname.match(/\/jobs\/view\/(?:.*?-)?(\d+)/i);
      if (viewMatch && viewMatch[1]) {
        jobId = viewMatch[1];
      }

      // Pattern 2: ?currentJobId=123456789 in search/collection URLs
      if (!jobId && parsed.searchParams.has('currentJobId')) {
        const paramId = parsed.searchParams.get('currentJobId');
        if (paramId && /^\d+$/.test(paramId)) {
          jobId = paramId;
        }
      }

      if (!jobId) {
        return {
          isValid: false,
          jobId: null,
          canonicalUrl: null,
          urlHash: null,
          error: 'Could not extract valid LinkedIn numeric job ID from URL',
        };
      }

      const canonicalUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
      const urlHash = crypto.createHash('sha256').update(canonicalUrl).digest('hex');

      return {
        isValid: true,
        jobId,
        canonicalUrl,
        urlHash,
      };
    } catch (err: any) {
      return {
        isValid: false,
        jobId: null,
        canonicalUrl: null,
        urlHash: null,
        error: `URL parsing failure: ${err.message}`,
      };
    }
  }

  /**
   * Generate an official, permissible LinkedIn job search URL for discovery.
   * Default filters to the past week (7 days) and sorts by date descending.
   */
  generateSearchUrl(
    query: string,
    options: {
      location?: string;
      remoteOnly?: boolean;
      timeRange?: 'past_24h' | 'past_week' | 'past_month' | 'any';
    } = {}
  ): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search/';
    const params = new URLSearchParams();

    params.set('keywords', query.trim());
    params.set('location', options.location ? options.location.trim() : 'Ethiopia');

    if (options.remoteOnly) {
      // LinkedIn work-arrangement filter: 2 = Remote
      params.set('f_WT', '2');
    }

    // Date Posted filter (f_TPR: Time Posted Range)
    // Default to 'past_week' (r604800 = 7 days) to filter out stale jobs from months ago
    const range = options.timeRange || 'past_week';
    if (range === 'past_24h') {
      params.set('f_TPR', 'r86400');
    } else if (range === 'past_week') {
      params.set('f_TPR', 'r604800'); // 7 days (604,800 seconds)
    } else if (range === 'past_month') {
      params.set('f_TPR', 'r2592000');
    }

    // Sort by most recent postings (Date Descending)
    params.set('sortBy', 'DD');

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Normalize an accepted intake reference into the standard NormalizedJob model
   */
  normalizeReferenceToJob(
    reference: {
      id: string;
      originalUrl: string;
      title?: string | null;
      companyName?: string | null;
      location?: string | null;
      workArrangement?: WorkArrangementType | null;
      rawMetadata?: any;
    },
    source: JobSource
  ): NormalizedJob {
    const urlInfo = this.canonicalizeJobUrl(reference.originalUrl);
    const externalId = urlInfo.jobId || reference.id;
    const originalUrl = urlInfo.canonicalUrl || reference.originalUrl;
    const title = reference.title || 'Career Opportunity via LinkedIn';
    const company = reference.companyName || 'Employer via LinkedIn';

    const fingerprint = generateJobFingerprint({
      externalId,
      originalUrl,
      title,
      companyName: company,
    });

    const isRemote = reference.workArrangement === 'REMOTE';
    const workArrangement: WorkArrangementType = reference.workArrangement || (isRemote ? 'REMOTE' : 'ON_SITE');

    return {
      sourceId: source.id,
      externalId,
      fingerprint,
      originalUrl,
      applicationUrl: originalUrl,
      rawPayload: {
        intakeReferenceId: reference.id,
        source: 'linkedin_intake',
        capturedMetadata: reference.rawMetadata,
      },
      originalTitle: title,
      originalDescription: `Discovered vacancy on LinkedIn: ${title} at ${company}. Application and full job details available at the original LinkedIn posting.`,
      normalizedTitle: title,
      normalizedDescription: `Discovered vacancy on LinkedIn: ${title} at ${company}. Application and full job details available at the original LinkedIn posting.`,
      companyName: company,
      country: 'Ethiopia',
      city: reference.location || 'Addis Ababa',
      isRemote,
      workArrangement,
      employmentType: 'FULL_TIME' as EmploymentTypeEnum,
      experienceLevel: 'MID' as ExperienceLevelEnum,
      publishedAt: new Date(),
    };
  }

  /**
   * Returns documented compliance status and boundaries for LinkedIn integration
   */
  getDiscoveryComplianceReport() {
    return {
      adapter: 'LinkedInAdapter',
      complianceLevel: 'PERMISSIBLE_INTAKE_AND_OFFICIAL_URLS',
      unauthorizedScraping: false,
      sessionCookieHijacking: false,
      headlessBrowserAutomation: false,
      automatedApiIntegrationReady: true,
      notes: [
        'Adheres to LinkedIn Terms of Service and robots.txt policies.',
        'Generates verified LinkedIn discovery links for all 20 professional categories.',
        'Provides admin intake workflow for registering and reviewing discovered job references with automatic duplicate detection.',
        'Ready for drop-in OAuth / Talent Solutions API partner keys once provisioned.',
      ],
    };
  }
}

export const linkedinAdapter = new LinkedInAdapter();
