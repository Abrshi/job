import { JobSource } from '@prisma/client';
import {
  SourceAdapter,
  RawJobPosting,
  NormalizedJob,
  FetchOptions,
  FetchResult,
  WorkArrangementType,
  EmploymentTypeEnum,
  ExperienceLevelEnum,
} from './source-adapter.interface';
import { generateJobFingerprint } from './fingerprint.util';
import { linkedinAdapter } from '../../discovery/adapters/linkedin.adapter';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

export class LinkedInSourceAdapter implements SourceAdapter {
  readonly name = 'LinkedIn';
  readonly slug = 'linkedin';

  /**
   * Fetch discovered LinkedIn job postings from the intake queue & registered references
   */
  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;

    // Strict 7-day cutoff (1 week ago) to ensure only fresh vacancies are collected
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    logger.info(
      `[LinkedInSourceAdapter] Fetching discovered LinkedIn jobs for source '${source.name}' ` +
      `(cutoff: >= ${oneWeekAgo.toISOString()})`
    );

    // Fetch accepted or pending intake references registered for LinkedIn within the last 7 days
    const references = await prisma.jobDiscoveryReference.findMany({
      where: {
        sourceSlug: 'linkedin',
        status: { in: ['ACCEPTED', 'PENDING_REVIEW'] },
        capturedAt: { gte: oneWeekAgo },
      },
      take: limit,
      orderBy: { capturedAt: 'desc' },
    });

    const jobs: RawJobPosting[] = references.map((ref) => {
      const canonical = linkedinAdapter.canonicalizeJobUrl(ref.originalUrl);
      const externalId = canonical.jobId || ref.id;
      const cleanUrl = canonical.canonicalUrl || ref.originalUrl;

      return {
        externalId,
        originalUrl: cleanUrl,
        applicationUrl: cleanUrl,
        title: ref.title || 'Career Opportunity via LinkedIn',
        description: `Discovered vacancy on LinkedIn: ${ref.title || 'Career Opportunity'} at ${ref.companyName || 'Employer'}. Full application details available at original LinkedIn posting.`,
        companyName: ref.companyName || 'Employer via LinkedIn',
        country: 'Ethiopia',
        city: ref.location || 'Addis Ababa',
        isRemote: ref.workArrangement === 'REMOTE',
        workArrangement: (ref.workArrangement as WorkArrangementType) || 'ON_SITE',
        employmentType: 'FULL_TIME' as EmploymentTypeEnum,
        experienceLevel: 'MID' as ExperienceLevelEnum,
        publishedAt: ref.capturedAt,
        rawPayload: {
          intakeReferenceId: ref.id,
          source: 'linkedin_intake',
          metadata: ref.rawMetadata,
        },
      };
    });

    return {
      jobs,
      checkpoint: null,
      hasMore: false,
      recordsFetched: jobs.length,
    };
  }

  /**
   * Normalize raw LinkedIn posting into standard NormalizedJob
   */
  normalize(raw: RawJobPosting, source: JobSource): NormalizedJob {
    const externalId = raw.externalId || null;
    const originalUrl = raw.originalUrl;
    const title = raw.title.trim();
    const company = (raw.companyName || 'Employer via LinkedIn').trim();

    const fingerprint = generateJobFingerprint({
      externalId,
      originalUrl,
      title,
      companyName: company,
    });

    const isRemote = raw.isRemote || raw.workArrangement === 'REMOTE';
    const workArrangement: WorkArrangementType = raw.workArrangement || (isRemote ? 'REMOTE' : 'ON_SITE');

    return {
      sourceId: source.id,
      externalId,
      fingerprint,
      originalUrl,
      applicationUrl: raw.applicationUrl || originalUrl,
      rawPayload: raw.rawPayload,
      originalTitle: title,
      originalDescription: raw.description,
      normalizedTitle: title,
      normalizedDescription: raw.description,
      companyName: company,
      country: raw.country || 'Ethiopia',
      city: raw.city || 'Addis Ababa',
      isRemote,
      workArrangement,
      remoteEligibility: isRemote ? 'Worldwide / Ethiopia Remote' : null,
      employmentType: raw.employmentType || ('FULL_TIME' as EmploymentTypeEnum),
      experienceLevel: raw.experienceLevel || ('MID' as ExperienceLevelEnum),
      publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : new Date(),
    };
  }
}

export const linkedInSourceAdapter = new LinkedInSourceAdapter();

