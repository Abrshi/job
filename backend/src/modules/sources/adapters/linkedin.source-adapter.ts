import crypto from 'node:crypto';
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
import { linkedInCompaniesService } from '../../discovery/linkedin-companies.service';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

export class LinkedInSourceAdapter implements SourceAdapter {
  readonly name = 'LinkedIn';
  readonly slug = 'linkedin';

  /**
   * Fetch real vacancies from LinkedIn public guest job search & registered intake references
   */
  async fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    logger.info(
      `[LinkedInSourceAdapter] Fetching discovered LinkedIn jobs for source '${source.name}' ` +
      `(cutoff: >= ${oneWeekAgo.toISOString()})`
    );

    const jobsMap = new Map<string, RawJobPosting>();

    // 1. Fetch live public vacancies from LinkedIn's guest search for Ethiopia
    try {
      const searchQueries = ['Ethiopia', 'Addis Ababa'];
      for (const query of searchQueries) {
        if (jobsMap.size >= limit) break;

        const liveCards = await linkedinAdapter.fetchPublicJobCards(query, {
          location: 'Ethiopia',
          timeRange: 'past_week',
          limit: Math.min(25, limit - jobsMap.size),
        });

        logger.info(`[LinkedInSourceAdapter] Live guest search for '${query}' returned ${liveCards.length} job cards.`);

        for (const card of liveCards) {
          if (jobsMap.has(card.jobId)) continue;

          // Auto-track the employer in LinkedInCompany
          if (card.company) {
            linkedInCompaniesService.recordCompanyJobDiscovered(card.company).catch((err: any) => {
              logger.warn(`Failed to auto-track company '${card.company}':`, err.message);
            });
          }

          // Generate canonical URL and hash
          const canonical = linkedinAdapter.canonicalizeJobUrl(card.url);
          const cleanUrl = canonical.canonicalUrl || card.url;
          const urlHash = canonical.urlHash || crypto.createHash('sha256').update(cleanUrl).digest('hex');

          // Auto-record reference in jobDiscoveryReference so it appears in the Discovery tab
          prisma.jobDiscoveryReference.upsert({
            where: { urlHash },
            create: {
              sourceSlug: 'linkedin',
              originalUrl: cleanUrl,
              urlHash,
              title: card.title,
              companyName: card.company,
              location: card.location,
              workArrangement: card.workArrangement || 'ON_SITE',
              status: 'INGESTED',
              rawMetadata: {
                jobId: card.jobId,
                liveCaptured: true,
                capturedQuery: query,
              },
            },
            update: {
              title: card.title,
              companyName: card.company,
              location: card.location,
            },
          }).catch((err: any) => {
            logger.warn(`[LinkedInSourceAdapter] Error syncing reference for ${card.jobId}:`, err.message);
          });

          jobsMap.set(card.jobId, {
            externalId: card.jobId,
            originalUrl: cleanUrl,
            applicationUrl: cleanUrl,
            title: card.title,
            description: `Discovered vacancy on LinkedIn: ${card.title} at ${card.company}. Location: ${card.location}. Full application details available at original LinkedIn posting: ${cleanUrl}`,
            companyName: card.company,
            country: 'Ethiopia',
            city: card.location || 'Addis Ababa',
            isRemote: card.workArrangement === 'REMOTE',
            workArrangement: card.workArrangement || 'ON_SITE',
            employmentType: 'FULL_TIME' as EmploymentTypeEnum,
            experienceLevel: 'MID' as ExperienceLevelEnum,
            publishedAt: card.publishedAt,
            rawPayload: {
              jobId: card.jobId,
              source: 'linkedin_live_guest',
              query,
            },
          });
        }
      }
    } catch (liveErr: any) {
      logger.warn(`[LinkedInSourceAdapter] Live guest search failed: ${liveErr.message}. Falling back to intake references.`);
    }

    // 2. Also check any accepted/pending intake references registered in the database queue
    try {
      const references = await prisma.jobDiscoveryReference.findMany({
        where: {
          sourceSlug: 'linkedin',
          status: { in: ['ACCEPTED', 'PENDING_REVIEW'] },
          capturedAt: { gte: oneWeekAgo },
        },
        take: limit,
        orderBy: { capturedAt: 'desc' },
      });

      for (const ref of references) {
        const canonical = linkedinAdapter.canonicalizeJobUrl(ref.originalUrl);
        const externalId = canonical.jobId || ref.id;
        const cleanUrl = canonical.canonicalUrl || ref.originalUrl;

        if (!jobsMap.has(externalId)) {
          jobsMap.set(externalId, {
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
          });
        }
      }
    } catch (refErr: any) {
      logger.warn(`[LinkedInSourceAdapter] Failed to query intake references: ${refErr.message}`);
    }

    const jobs = Array.from(jobsMap.values()).slice(0, limit);
    logger.info(`[LinkedInSourceAdapter] Returning ${jobs.length} total LinkedIn jobs.`);

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

