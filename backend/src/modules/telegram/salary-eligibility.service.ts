import { JobSalaryInput, SalaryEligibilityResult } from './telegram.types';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export class SalaryEligibilityService {
  private readonly defaultThresholdEtb = 20000;

  // Default fallback exchange rates (ETB per 1 unit of foreign currency)
  // Can be augmented or overridden via the EXCHANGE_RATES_JSON environment variable
  private defaultExchangeRates: Record<string, number> = {
    USD: 125.0,
    EUR: 135.0,
    GBP: 160.0,
    CAD: 90.0,
    AED: 34.0,
    SAR: 33.0,
  };

  /**
   * Parse configurable exchange rates from environment if provided
   */
  private getExchangeRates(): Record<string, number> {
    const customJson = env.EXCHANGE_RATES_JSON;
    if (!customJson) {
      return this.defaultExchangeRates;
    }

    try {
      const parsed = JSON.parse(customJson);
      if (typeof parsed === 'object' && parsed !== null) {
        const normalized: Record<string, number> = { ...this.defaultExchangeRates };
        for (const [curr, rate] of Object.entries(parsed)) {
          const numRate = Number(rate);
          if (!isNaN(numRate) && numRate > 0) {
            normalized[curr.trim().toUpperCase()] = numRate;
          }
        }
        return normalized;
      }
    } catch (err) {
      logger.warn('[SalaryEligibility] Invalid EXCHANGE_RATES_JSON in environment, using defaults:', (err as Error).message);
    }

    return this.defaultExchangeRates;
  }

  /**
   * Convert Decimal, string, or number to JavaScript number safely
   */
  private toNumber(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      return isNaN(val) ? null : val;
    }
    if (typeof val === 'object' && val !== null && 'toNumber' in val && typeof (val as any).toNumber === 'function') {
      return (val as any).toNumber();
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  /**
   * Check whether a job posting satisfies the confirmed salary requirement:
   * Confirmed monthly salary strictly greater than 20,000 ETB.
   */
  checkEligibility(
    job: JobSalaryInput,
    options: {
      thresholdEtb?: number;
      customRates?: Record<string, number>;
    } = {}
  ): SalaryEligibilityResult {
    const threshold = options.thresholdEtb ?? env.TELEGRAM_MIN_SALARY_ETB ?? this.defaultThresholdEtb;
    const rates = options.customRates ?? this.getExchangeRates();

    const minRaw = this.toNumber(job.salaryMin);
    const maxRaw = this.toNumber(job.salaryMax);

    // 1. Minimum confirmed salary check
    // If salaryMin is missing or <= 0, minimum is not confirmed -> reject.
    if (minRaw === null || minRaw === undefined || minRaw <= 0) {
      return {
        isEligible: false,
        reason: 'Missing, unspecified, or non-positive minimum salary amount.',
        originalMin: minRaw,
        originalMax: maxRaw,
      };
    }

    // 2. Currency validation
    // Rule: Never assume an unknown currency is ETB.
    const rawCurrency = (job.salaryCurrency || '').trim().toUpperCase();
    if (!rawCurrency) {
      return {
        isEligible: false,
        reason: 'Missing or unspecified salary currency. Unknown currency is not assumed to be ETB.',
        originalMin: minRaw,
        originalMax: maxRaw,
      };
    }

    // 3. Pay period validation & conversion to monthly
    const rawPeriod = (job.salaryPeriod || '').toString().trim().toUpperCase();
    if (!rawPeriod) {
      return {
        isEligible: false,
        reason: 'Missing or unspecified salary period (e.g. monthly, yearly). Pay period cannot be reliably determined.',
        originalMin: minRaw,
        originalMax: maxRaw,
        originalCurrency: rawCurrency,
      };
    }

    let monthlyMinInOriginalCurrency: number;

    switch (rawPeriod) {
      case 'MONTHLY':
      case 'MONTH':
        monthlyMinInOriginalCurrency = minRaw;
        break;

      case 'YEARLY':
      case 'YEAR':
      case 'ANNUAL':
      case 'ANNUALLY':
        monthlyMinInOriginalCurrency = minRaw / 12;
        break;

      case 'WEEKLY':
      case 'WEEK':
        // Standard 52 weeks per year / 12 months
        monthlyMinInOriginalCurrency = (minRaw * 52) / 12;
        break;

      case 'DAILY':
      case 'DAY':
        // Standard full-time Ethiopian labor norm: 22 working days per month
        monthlyMinInOriginalCurrency = minRaw * 22;
        break;

      case 'HOURLY':
      case 'HOUR': {
        // Hourly rate is only convertable to monthly if explicitly confirmed FULL_TIME
        const empType = (job.employmentType || '').toString().trim().toUpperCase();
        if (empType === 'FULL_TIME') {
          // Standard 40 hours/week * 52 weeks / 12 months = 173.33 hours/month
          monthlyMinInOriginalCurrency = (minRaw * 40 * 52) / 12;
        } else {
          return {
            isEligible: false,
            reason: 'Hourly salary cannot be defensibly converted to monthly without confirmed full-time hours.',
            originalMin: minRaw,
            originalMax: maxRaw,
            originalCurrency: rawCurrency,
            originalPeriod: rawPeriod,
          };
        }
        break;
      }

      default:
        return {
          isEligible: false,
          reason: `Unrecognized or unconvertible salary period: '${rawPeriod}'.`,
          originalMin: minRaw,
          originalMax: maxRaw,
          originalCurrency: rawCurrency,
          originalPeriod: rawPeriod,
        };
    }

    // 4. Currency conversion to ETB
    let monthlyMinInEtb: number;
    let exchangeRateUsed: number = 1.0;

    const isEtb = rawCurrency === 'ETB' || rawCurrency === 'BIRR';

    if (isEtb) {
      monthlyMinInEtb = monthlyMinInOriginalCurrency;
    } else {
      // Foreign currency: Never compare numbers directly against ETB.
      const rate = rates[rawCurrency];
      if (!rate || rate <= 0) {
        return {
          isEligible: false,
          reason: `Foreign currency '${rawCurrency}' has no configured exchange rate. Foreign jobs without rates are safely skipped.`,
          originalMin: minRaw,
          originalMax: maxRaw,
          originalCurrency: rawCurrency,
          originalPeriod: rawPeriod,
        };
      }
      exchangeRateUsed = rate;
      monthlyMinInEtb = monthlyMinInOriginalCurrency * rate;
    }

    // 5. Threshold comparison: STRICTLY greater than threshold (20,000 ETB)
    // 25,000 -> eligible
    // 20,001 -> eligible
    // 20,000 -> INELIGIBLE (strictly greater than)
    // 18,000 -> INELIGIBLE
    const isStrictlyGreater = monthlyMinInEtb > threshold;

    if (!isStrictlyGreater) {
      return {
        isEligible: false,
        reason: `Monthly minimum confirmed salary (${Math.round(monthlyMinInEtb).toLocaleString()} ETB) is not strictly greater than threshold (${threshold.toLocaleString()} ETB).`,
        originalMin: minRaw,
        originalMax: maxRaw,
        originalCurrency: rawCurrency,
        originalPeriod: rawPeriod,
        monthlyMinInEtb,
        exchangeRateUsed,
      };
    }

    return {
      isEligible: true,
      reason: `Eligible: Minimum confirmed monthly salary (${Math.round(monthlyMinInEtb).toLocaleString()} ETB) is strictly greater than ${threshold.toLocaleString()} ETB.`,
      originalMin: minRaw,
      originalMax: maxRaw,
      originalCurrency: rawCurrency,
      originalPeriod: rawPeriod,
      monthlyMinInEtb,
      exchangeRateUsed,
    };
  }
}

export const salaryEligibilityService = new SalaryEligibilityService();
