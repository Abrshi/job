/**
 * Telegram Channel Backfill CLI Script
 *
 * Safely evaluates historical jobs against the 20,000 ETB/month eligibility threshold
 * and optionally publishes qualifying jobs to the configured Telegram channel.
 *
 * Usage:
 *   # Dry run (safe preview, no posts made):
 *   npm run telegram:backfill -- --dry-run --limit=20
 *
 *   # Live execution (posts eligible jobs to Telegram with rate limiting):
 *   npm run telegram:backfill -- --live --limit=10
 *
 *   # Filter by source:
 *   npm run telegram:backfill -- --dry-run --source=ethiojobs
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';
import { telegramPublisherService } from '../src/modules/telegram/telegram-publisher.service';
import { telegramApiClient } from '../src/modules/telegram/telegram-api.client';
import { env } from '../src/config/env';

async function main() {
  const args = process.argv.slice(2);

  let dryRun = true;
  let limit = 20;
  let minSalary: number | undefined;
  let sourceIdentifier: string | undefined;

  for (const arg of args) {
    if (arg === '--live' || arg === '--no-dry-run' || arg === '--dry-run=false') {
      dryRun = false;
    } else if (arg === '--dry-run' || arg === '--dry-run=true') {
      dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10) || 20;
    } else if (arg.startsWith('--min-salary=')) {
      minSalary = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--source=')) {
      sourceIdentifier = arg.split('=')[1];
    }
  }

  console.log('\n======================================================');
  console.log('   ETJobCollector — Telegram Channel Backfill Tool   ');
  console.log('======================================================');
  console.log(`Channel:      ${env.TELEGRAM_CHANNEL_ID || '@etjobcollector'}`);
  console.log(`Mode:         ${dryRun ? 'DRY-RUN (Safe preview, no posts)' : 'LIVE (Posting to Telegram)'}`);
  console.log(`Limit:        ${limit}`);
  console.log(`Min Salary:   ${minSalary ?? env.TELEGRAM_MIN_SALARY_ETB ?? 20000} ETB/month (strictly >)`);
  if (sourceIdentifier) {
    console.log(`Source:       ${sourceIdentifier}`);
  }
  console.log('------------------------------------------------------\n');

  // If live mode, test bot connection first
  if (!dryRun) {
    console.log('Checking Telegram bot connectivity...');
    const conn = await telegramApiClient.testConnection();
    if (!conn.connected) {
      console.error(`Telegram connection test failed: ${conn.error}`);
      console.error('Aborting live backfill to protect operational state.');
      process.exit(1);
    }
    console.log(`Bot connected as @${conn.botUsername}.\n`);
  }

  // Resolve sourceId if slug was provided
  let sourceId: string | undefined;
  if (sourceIdentifier) {
    const src = await prisma.jobSource.findFirst({
      where: {
        OR: [{ id: sourceIdentifier }, { slug: sourceIdentifier }],
      },
    });
    if (!src) {
      console.error(`Job source '${sourceIdentifier}' not found.`);
      process.exit(1);
    }
    sourceId = src.id;
  }

  console.log('Evaluating jobs...');
  const result = await telegramPublisherService.backfill({
    dryRun,
    limit,
    minSalary,
    sourceId,
  });

  console.log('\n=================== Summary Results ===================');
  console.log(`Total Evaluated: ${result.totalEvaluated}`);
  console.log(`Eligible:        ${result.eligibleCount}`);
  console.log(`Skipped:         ${result.skippedCount}`);
  if (!dryRun) {
    console.log(`Posted:          ${result.postedCount}`);
    console.log(`Failed:          ${result.failedCount}`);
  }
  console.log('------------------------------------------------------');

  if (result.details.length > 0) {
    console.log('\nJob Details:');
    for (const d of result.details) {
      const statusTag = d.isEligible ? (dryRun ? '[ELIGIBLE]' : d.posted ? '[POSTED]' : '[FAILED]') : '[SKIPPED]';
      console.log(` ${statusTag} ${d.title} | ${d.company} | ${d.salary}`);
      console.log(`           Reason: ${d.reason}`);
    }
  }

  console.log('\nDone.\n');
}

main()
  .catch((err) => {
    logger.error('Backfill script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
