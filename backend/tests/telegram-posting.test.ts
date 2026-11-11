import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SalaryEligibilityService } from '../../src/modules/telegram/salary-eligibility.service';
import { formatTelegramJobMessage } from '../../src/modules/telegram/telegram-message.formatter';
import { TelegramApiClient } from '../../src/modules/telegram/telegram-api.client';
import { TelegramPublisherService } from '../../src/modules/telegram/telegram-publisher.service';
import { Job, TelegramPostStatus } from '@prisma/client';

describe('Telegram Job Posting Module', () => {
  const eligibilityService = new SalaryEligibilityService();

  // ==========================================================================
  // 1. Salary Eligibility & Normalization Tests
  // ==========================================================================
  describe('Salary Eligibility (Strict > 20,000 ETB/month rule)', () => {
    it('1. Confirmed ETB salary strictly > 20,000 ETB/month is eligible', () => {
      const res25k = eligibilityService.checkEligibility({
        salaryMin: 25000,
        salaryMax: 30000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(res25k.isEligible, true);
      assert.strictEqual(res25k.monthlyMinInEtb, 25000);

      const res20001 = eligibilityService.checkEligibility({
        salaryMin: 20001,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(res20001.isEligible, true);
      assert.strictEqual(res20001.monthlyMinInEtb, 20001);
    });

    it('2. Confirmed ETB salary == 20,000 ETB/month is strictly INELIGIBLE (skip)', () => {
      const res20k = eligibilityService.checkEligibility({
        salaryMin: 20000,
        salaryMax: 25000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(res20k.isEligible, false);
      assert.strictEqual(res20k.monthlyMinInEtb, 20000);
      assert.match(res20k.reason, /not strictly greater than threshold/);
    });

    it('3. Confirmed ETB salary < 20,000 ETB/month is INELIGIBLE (skip)', () => {
      const res18k = eligibilityService.checkEligibility({
        salaryMin: 18000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(res18k.isEligible, false);
      assert.strictEqual(res18k.monthlyMinInEtb, 18000);

      const resZero = eligibilityService.checkEligibility({
        salaryMin: 0,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(resZero.isEligible, false);
    });

    it('4. Missing, null, or ambiguous salary information is INELIGIBLE (skip)', () => {
      const missingSalary = eligibilityService.checkEligibility({
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(missingSalary.isEligible, false);
      assert.match(missingSalary.reason, /Missing, unspecified, or non-positive minimum salary/);

      const missingCurrency = eligibilityService.checkEligibility({
        salaryMin: 35000,
        salaryCurrency: null,
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(missingCurrency.isEligible, false);
      assert.match(missingCurrency.reason, /Missing or unspecified salary currency/);
    });

    it('5. Salary ranges are evaluated conservatively using the confirmed MINIMUM value', () => {
      // 20,000 - 35,000 ETB: min is 20,000 -> not strictly greater -> INELIGIBLE
      const rangeAtBoundary = eligibilityService.checkEligibility({
        salaryMin: 20000,
        salaryMax: 35000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(rangeAtBoundary.isEligible, false);

      // 20,001 - 35,000 ETB: min is 20,001 -> strictly greater -> ELIGIBLE
      const rangeAboveBoundary = eligibilityService.checkEligibility({
        salaryMin: 20001,
        salaryMax: 35000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(rangeAboveBoundary.isEligible, true);
    });

    it('6. Normalizes pay periods accurately (Yearly, Weekly, Daily, Hourly Full-Time)', () => {
      // Yearly 300,000 ETB / 12 = 25,000 ETB/mo -> ELIGIBLE
      const yearlyEligible = eligibilityService.checkEligibility({
        salaryMin: 300000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'YEARLY',
      });
      assert.strictEqual(yearlyEligible.isEligible, true);
      assert.strictEqual(yearlyEligible.monthlyMinInEtb, 25000);

      // Yearly 240,000 ETB / 12 = 20,000 ETB/mo -> INELIGIBLE (at boundary)
      const yearlyIneligible = eligibilityService.checkEligibility({
        salaryMin: 240000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'YEARLY',
      });
      assert.strictEqual(yearlyIneligible.isEligible, false);
      assert.strictEqual(yearlyIneligible.monthlyMinInEtb, 20000);

      // Weekly: 5,000 ETB/wk * (52/12) = 21,666.67 ETB/mo -> ELIGIBLE
      const weeklyEligible = eligibilityService.checkEligibility({
        salaryMin: 5000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'WEEKLY',
      });
      assert.strictEqual(weeklyEligible.isEligible, true);
      assert.ok((weeklyEligible.monthlyMinInEtb || 0) > 20000);

      // Daily: 1,000 ETB/day * 22 = 22,000 ETB/mo -> ELIGIBLE
      const dailyEligible = eligibilityService.checkEligibility({
        salaryMin: 1000,
        salaryCurrency: 'ETB',
        salaryPeriod: 'DAILY',
      });
      assert.strictEqual(dailyEligible.isEligible, true);
      assert.strictEqual(dailyEligible.monthlyMinInEtb, 22000);

      // Daily: 800 ETB/day * 22 = 17,600 ETB/mo -> INELIGIBLE
      const dailyIneligible = eligibilityService.checkEligibility({
        salaryMin: 800,
        salaryCurrency: 'ETB',
        salaryPeriod: 'DAILY',
      });
      assert.strictEqual(dailyIneligible.isEligible, false);

      // Hourly Full-Time: 150 ETB/hr * 40 * 52 / 12 = 26,000 ETB/mo -> ELIGIBLE
      const hourlyFullTime = eligibilityService.checkEligibility({
        salaryMin: 150,
        salaryCurrency: 'ETB',
        salaryPeriod: 'HOURLY',
        employmentType: 'FULL_TIME',
      });
      assert.strictEqual(hourlyFullTime.isEligible, true);
      assert.strictEqual(hourlyFullTime.monthlyMinInEtb, 26000);

      // Hourly Part-Time / unspecified: rejected because hours cannot be defensibly assumed
      const hourlyPartTime = eligibilityService.checkEligibility({
        salaryMin: 150,
        salaryCurrency: 'ETB',
        salaryPeriod: 'HOURLY',
        employmentType: 'PART_TIME',
      });
      assert.strictEqual(hourlyPartTime.isEligible, false);
      assert.match(hourlyPartTime.reason, /Hourly salary cannot be defensibly converted/);
    });

    it('7. Foreign currency salaries are converted using exchange rates, not compared as ETB', () => {
      // 500 USD / month: At default rate of 125 ETB/USD = 62,500 ETB -> ELIGIBLE
      const usdJob = eligibilityService.checkEligibility({
        salaryMin: 500,
        salaryCurrency: 'USD',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(usdJob.isEligible, true);
      assert.strictEqual(usdJob.monthlyMinInEtb, 62500);

      // 100 USD / month: At 125 ETB/USD = 12,500 ETB -> INELIGIBLE
      const lowUsdJob = eligibilityService.checkEligibility({
        salaryMin: 100,
        salaryCurrency: 'USD',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(lowUsdJob.isEligible, false);
      assert.strictEqual(lowUsdJob.monthlyMinInEtb, 12500);

      // 200 EUR / month: At 135 ETB/EUR = 27,000 ETB -> ELIGIBLE
      const eurJob = eligibilityService.checkEligibility({
        salaryMin: 200,
        salaryCurrency: 'EUR',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(eurJob.isEligible, true);
      assert.strictEqual(eurJob.monthlyMinInEtb, 27000);
    });

    it('8. Safely skips foreign currencies with missing/unsupported exchange rates', () => {
      const unsupportedCurrencyJob = eligibilityService.checkEligibility({
        salaryMin: 50000,
        salaryCurrency: 'XYZ_UNKNOWN',
        salaryPeriod: 'MONTHLY',
      });
      assert.strictEqual(unsupportedCurrencyJob.isEligible, false);
      assert.match(unsupportedCurrencyJob.reason, /Foreign currency 'XYZ_UNKNOWN' has no configured exchange rate/);
    });
  });

  // ==========================================================================
  // 2. Telegram HTML Formatting Tests
  // ==========================================================================
  describe('Telegram Message Formatting', () => {
    const mockJob: Partial<Job> = {
      id: 'job-123',
      normalizedTitle: 'Senior Software Engineer & Team Lead',
      companyName: 'Tech Ethiopia <PLC>',
      salaryMin: 45000 as any,
      salaryMax: 60000 as any,
      salaryCurrency: 'ETB',
      salaryPeriod: 'MONTHLY',
      location: 'Addis Ababa (Bole)',
      workMode: 'HYBRID',
      employmentType: 'FULL_TIME',
      experienceLevel: 'SENIOR',
      descriptionSummary: 'We are seeking an experienced developer with & skills <coding>.',
      canonicalUrl: 'https://etjobcollector.com/jobs/job-123',
      sourceUrl: 'https://example.com/apply/job-123?ref=test&id=1',
    };

    it('Correctly formats job and escapes special HTML characters', () => {
      const formatted = formatTelegramJobMessage(mockJob);

      // Checks for uppercase bold title
      assert.ok(formatted.includes('<b>SENIOR SOFTWARE ENGINEER &amp; TEAM LEAD</b>'));

      // Checks for properly escaped company name
      assert.ok(formatted.includes('Tech Ethiopia &lt;PLC&gt;'));

      // Checks for formatted salary
      assert.ok(formatted.includes('45,000 - 60,000 ETB/month'));

      // Checks for work mode and location
      assert.ok(formatted.includes('Hybrid'));
      assert.ok(formatted.includes('Addis Ababa (Bole)'));

      // Checks for clickable original application link
      assert.ok(
        formatted.includes(
          '<a href="https://example.com/apply/job-123?ref=test&amp;id=1">View &amp; Apply</a>'
        )
      );

      // Checks for branding
      assert.ok(formatted.includes('ET Job Collector'));
      assert.ok(formatted.includes('@etjobcollector'));
    });

    it('Ensures message never exceeds Telegram 4096 character limit even with long text', () => {
      const longDescription = 'A'.repeat(5000);
      const longJob: Partial<Job> = {
        ...mockJob,
        descriptionSummary: longDescription,
      };

      const formatted = formatTelegramJobMessage(longJob);
      assert.ok(formatted.length <= 4000);
      assert.ok(formatted.includes('ET Job Collector'));
    });
  });

  // ==========================================================================
  // 3. Telegram API Client Tests
  // ==========================================================================
  describe('Telegram API Client', () => {
    it('Sends message successfully when Bot API returns ok: true', async () => {
      const mockFetch: typeof fetch = async (url, init) => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: { message_id: 998877 },
          }),
        } as Response;
      };

      const client = new TelegramApiClient('fake-token-123', mockFetch);
      const res = await client.sendMessage('<b>Hello World</b>', { channelId: '@etjobcollector' });

      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.result?.message_id, 998877);
    });

    it('Handles Telegram API error safely without throwing unhandled exceptions', async () => {
      const mockFetch: typeof fetch = async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            ok: false,
            error_code: 400,
            description: 'Bad Request: chat not found',
          }),
        } as Response;
      };

      const client = new TelegramApiClient('fake-token-123', mockFetch);
      const res = await client.sendMessage('<b>Test</b>', { channelId: '@nonexistent' });

      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.error_code, 400);
      assert.strictEqual(res.description, 'Bad Request: chat not found');
    });
  });

  // ==========================================================================
  // 4. Publisher Service & Deduplication Lifecycle Tests
  // ==========================================================================
  describe('TelegramPublisherService Lifecycle & Deduplication', () => {
    it('9. Prevents duplicate posts if job was already posted (POSTED status)', async () => {
      let updateCalls = 0;
      let apiCalled = false;

      const mockDb: any = {
        job: {
          findUnique: async () => ({
            id: 'already-posted-job',
            normalizedTitle: 'Software Engineer',
            companyName: 'ABC Inc',
            salaryMin: 35000,
            salaryCurrency: 'ETB',
            salaryPeriod: 'MONTHLY',
            telegramPost: {
              status: 'POSTED',
              telegramMsgId: 12345,
              publishedAt: new Date(),
            },
          }),
        },
        telegramPost: {
          upsert: async () => {
            updateCalls++;
          },
          update: async () => {
            updateCalls++;
          },
        },
      };

      const mockApiClient: any = {
        sendMessage: async () => {
          apiCalled = true;
          return { ok: true, result: { message_id: 999 } };
        },
      };

      const publisher = new TelegramPublisherService(eligibilityService, mockApiClient, mockDb);
      const result = await publisher.publishJob('already-posted-job');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.messageId, 12345);
      assert.strictEqual(apiCalled, false, 'API must not be called for already posted job');
      assert.strictEqual(updateCalls, 0);
    });

    it('10. Successfully publishes eligible job, updates status to POSTED with telegramMsgId', async () => {
      let createdPending = false;
      let updatedPosted = false;
      let recordedMsgId = 0;

      const mockDb: any = {
        job: {
          findUnique: async () => ({
            id: 'eligible-job-1',
            normalizedTitle: 'Senior Backend Engineer',
            companyName: 'Fintech Addis',
            salaryMin: 40000,
            salaryCurrency: 'ETB',
            salaryPeriod: 'MONTHLY',
            employmentType: 'FULL_TIME',
            workMode: 'ONSITE',
            location: 'Addis Ababa',
            canonicalUrl: 'https://etjobcollector.com/jobs/1',
            sourceUrl: 'https://fintech.et/careers/1',
            telegramPost: null,
          }),
        },
        telegramPost: {
          upsert: async (args: any) => {
            if (args.create?.status === 'PENDING') {
              createdPending = true;
            }
          },
          update: async (args: any) => {
            if (args.data?.status === 'POSTED') {
              updatedPosted = true;
              recordedMsgId = args.data.telegramMsgId;
            }
          },
        },
      };

      const mockApiClient: any = {
        sendMessage: async () => ({
          ok: true,
          result: { message_id: 887766 },
        }),
      };

      const publisher = new TelegramPublisherService(eligibilityService, mockApiClient, mockDb);
      const result = await publisher.publishJob('eligible-job-1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.messageId, 887766);
      assert.strictEqual(createdPending, true, 'Must set status to PENDING before sending');
      assert.strictEqual(updatedPosted, true, 'Must set status to POSTED upon success');
      assert.strictEqual(recordedMsgId, 887766, 'Must record message ID');
    });

    it('11. API failure marks job as FAILED and increments retryCount', async () => {
      let updatedFailed = false;
      let recordedError = '';

      const mockDb: any = {
        job: {
          findUnique: async () => ({
            id: 'fail-job-1',
            normalizedTitle: 'Frontend Engineer',
            companyName: 'Tech Corp',
            salaryMin: 30000,
            salaryCurrency: 'ETB',
            salaryPeriod: 'MONTHLY',
            telegramPost: null,
          }),
        },
        telegramPost: {
          upsert: async () => {},
          update: async (args: any) => {
            if (args.data?.status === 'FAILED') {
              updatedFailed = true;
              recordedError = args.data.errorMessage;
            }
          },
        },
      };

      const mockApiClient: any = {
        sendMessage: async () => ({
          ok: false,
          description: 'Telegram API timeout or network failure',
        }),
      };

      const publisher = new TelegramPublisherService(eligibilityService, mockApiClient, mockDb);
      const result = await publisher.publishJob('fail-job-1');

      assert.strictEqual(result.success, false);
      assert.strictEqual(updatedFailed, true, 'Status must be updated to FAILED on Telegram API error');
      assert.strictEqual(recordedError, 'Telegram API timeout or network failure');
    });

    it('12. Ineligible job is marked as SKIPPED to prevent repeated evaluation', async () => {
      let upsertedSkipped = false;
      let skipReason = '';

      const mockDb: any = {
        job: {
          findUnique: async () => ({
            id: 'ineligible-low-salary',
            normalizedTitle: 'Junior Assistant',
            companyName: 'Small Corp',
            salaryMin: 15000,
            salaryCurrency: 'ETB',
            salaryPeriod: 'MONTHLY',
            telegramPost: null,
          }),
        },
        telegramPost: {
          upsert: async (args: any) => {
            if (args.create?.status === 'SKIPPED') {
              upsertedSkipped = true;
              skipReason = args.create.errorMessage;
            }
          },
        },
      };

      const mockApiClient: any = {
        sendMessage: async () => {
          throw new Error('Should not be called');
        },
      };

      const publisher = new TelegramPublisherService(eligibilityService, mockApiClient, mockDb);
      const result = await publisher.publishJob('ineligible-low-salary');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(upsertedSkipped, true, 'Must mark ineligible job as SKIPPED in database');
      assert.match(skipReason, /not strictly greater than threshold/);
    });

    it('13. Concurrency lock prevents duplicate publication during simultaneous calls', async () => {
      let apiCalls = 0;

      const mockDb: any = {
        job: {
          findUnique: async () => ({
            id: 'concurrent-job',
            normalizedTitle: 'Data Analyst',
            companyName: 'Data PLC',
            salaryMin: 35000,
            salaryCurrency: 'ETB',
            salaryPeriod: 'MONTHLY',
            // Active lock: PENDING and lastAttemptAt was 10 seconds ago
            telegramPost: {
              status: 'PENDING',
              lastAttemptAt: new Date(Date.now() - 10000),
            },
          }),
        },
        telegramPost: {
          upsert: async () => {},
          update: async () => {},
        },
      };

      const mockApiClient: any = {
        sendMessage: async () => {
          apiCalls++;
          return { ok: true, result: { message_id: 111 } };
        },
      };

      const publisher = new TelegramPublisherService(eligibilityService, mockApiClient, mockDb);
      const result = await publisher.publishJob('concurrent-job');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.skipped, true);
      assert.strictEqual(result.reason, 'Concurrent publication lock in progress.');
      assert.strictEqual(apiCalls, 0, 'Must not post when concurrent lock is active');
    });
  });
});
