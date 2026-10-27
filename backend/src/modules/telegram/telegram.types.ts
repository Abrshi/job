import { Job, Prisma, SalaryPeriod, EmploymentType } from '@prisma/client';

export interface JobSalaryInput {
  salaryMin?: number | Prisma.Decimal | null;
  salaryMax?: number | Prisma.Decimal | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | string | null;
  employmentType?: EmploymentType | string | null;
  rawPayload?: unknown;
}

export interface SalaryEligibilityResult {
  isEligible: boolean;
  reason: string;
  originalMin?: number | null;
  originalMax?: number | null;
  originalCurrency?: string | null;
  originalPeriod?: string | null;
  monthlyMinInEtb?: number | null;
  exchangeRateUsed?: number | null;
}

export interface TelegramSendMessagePayload {
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
  disable_web_page_preview?: boolean;
}

export interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat?: {
      id: number | string;
      title?: string;
      username?: string;
      type?: string;
    };
    date?: number;
    text?: string;
  };
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

export interface TelegramPublishResult {
  success: boolean;
  jobId: string;
  messageId?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export interface BackfillOptions {
  dryRun?: boolean;
  limit?: number;
  minSalary?: number;
  sourceId?: string;
}

export interface BackfillResult {
  dryRun: boolean;
  totalEvaluated: number;
  eligibleCount: number;
  postedCount: number;
  skippedCount: number;
  failedCount: number;
  details: Array<{
    jobId: string;
    title: string;
    company?: string | null;
    salary: string;
    isEligible: boolean;
    reason: string;
    posted: boolean;
  }>;
}
