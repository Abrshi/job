import { telegramApiClient } from '../src/modules/telegram/telegram-api.client';
import { formatTelegramJobMessage } from '../src/modules/telegram/telegram-message.formatter';
import { env } from '../src/config/env';

async function main() {
  const channel = env.TELEGRAM_CHANNEL_ID || '@etjobcollector';
  console.log(`Checking connection for channel: ${channel}...`);

  const conn = await telegramApiClient.testConnection(channel);
  console.log(`Connection test: ${conn.ok ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Details: ${conn.message}`);

  if (!conn.ok) {
    process.exit(1);
  }

  console.log('\nFormatting sample job post to test publishing...');
  const testMessage = formatTelegramJobMessage({
    normalizedTitle: 'Full Stack Software Engineer',
    companyName: 'ETJobCollector Platform',
    salaryMin: 35000 as any,
    salaryMax: 45000 as any,
    salaryCurrency: 'ETB',
    salaryPeriod: 'MONTHLY',
    city: 'Addis Ababa',
    country: 'Ethiopia',
    workArrangement: 'HYBRID',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    normalizedDescription: 'Automated test posting from ETJobCollector to verify channel integration, formatting, and delivery. Confirmed monthly salary is 35,000 - 45,000 ETB (qualifies for > 20,000 ETB threshold).',
    originalUrl: 'https://t.me/etjobcollector',
  });

  console.log('Sending message to Telegram...');
  const result = await telegramApiClient.sendMessage(testMessage, { channelId: channel });

  if (result.ok && result.result?.message_id) {
    console.log(`SUCCESS! Message published to ${channel}. Message ID: ${result.result.message_id}`);
  } else {
    console.error(`FAILED to publish message: ${result.description} (Error code: ${result.error_code})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error executing test post:', err.message || err);
  process.exit(1);
});

