import { JobSource } from '@prisma/client';

export type WorkArrangementType = 'ON_SITE' | 'HYBRID' | 'REMOTE';
export type EmploymentTypeEnum = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type ExperienceLevelEnum = 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE' | 'UNSPECIFIED';
export type SalaryPeriodEnum = 'HOURLY' | 'MONTHLY' | 'YEARLY';

export interface RawJobPosting {
  externalId?: string | null;
  originalUrl: string;
  applicationUrl?: string | null;
  title: string;
  description: string;
  companyName?: string | null;
  country?: string | null;
  city?: string | null;
  isRemote?: boolean;
  workArrangement?: WorkArrangementType;
  remoteEligibility?: string | null;
  employmentType?: EmploymentTypeEnum | null;
  experienceLevel?: ExperienceLevelEnum | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriodEnum | null;
  publishedAt?: Date | string | null;
  closingDate?: Date | string | null;
  rawPayload: Record<string, unknown> | unknown[];
}

export interface NormalizedJob {
  sourceId: string;
  externalId?: string | null;
  fingerprint: string;
  originalUrl: string;
  applicationUrl?: string | null;
  rawPayload: unknown;
  originalTitle: string;
  originalDescription: string;
  normalizedTitle: string;
  normalizedDescription: string;
  companyName?: string | null;
  country?: string | null;
  city?: string | null;
  isRemote: boolean;
  workArrangement: WorkArrangementType;
  remoteEligibility?: string | null;
  employmentType?: EmploymentTypeEnum | null;
  experienceLevel?: ExperienceLevelEnum | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriodEnum | null;
  publishedAt?: Date | null;
  closingDate?: Date | null;
}

export interface FetchOptions {
  checkpoint?: unknown;
  limit?: number;
}

export interface FetchResult {
  jobs: RawJobPosting[];
  checkpoint?: unknown;
  hasMore: boolean;
  recordsFetched: number;
}

export interface SourceAdapter {
  readonly name: string;
  readonly slug: string;

  fetchJobs(source: JobSource, options?: FetchOptions): Promise<FetchResult>;
  normalize(raw: RawJobPosting, source: JobSource): NormalizedJob;
}
