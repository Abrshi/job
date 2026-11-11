import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import crypto from 'node:crypto';
import { AddressInfo } from 'net';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';

describe('Telegram Webhook & Ingestion Integration Tests', () => {
  let server: http.Server;
  let baseUrl = '';
  const secret = env.TELEGRAM_INTERNAL_API_SECRET || 'development_telegram_worker_internal_secret_key_12345';

  const testChannelId = '-1009876543210';
  const unauthorizedChannelId = '-1001112223334';
  const testMessageId = 12345;

  function generateHmacHeaders(payload: any, timestampSeconds?: number) {
    const ts = timestampSeconds !== undefined ? timestampSeconds.toString() : Math.floor(Date.now() / 1000).toString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(`${ts}.${payloadStr}`).digest('hex');

    return {
      'Content-Type': 'application/json',
      'X-Telegram-Worker-Timestamp': ts,
      'X-Telegram-Worker-Signature': signature,
      'Authorization': `Bearer ${secret}`,
    };
  }

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Cleanup any lingering test data
    const existingChannel = await prisma.telegramChannel.findUnique({
      where: { telegramChannelId: testChannelId },
    });
    if (existingChannel) {
      await prisma.telegramMessage.deleteMany({ where: { channelId: existingChannel.id } });
      await prisma.telegramChannel.delete({ where: { id: existingChannel.id } });
    }

    const unauthChannel = await prisma.telegramChannel.findUnique({
      where: { telegramChannelId: unauthorizedChannelId },
    });
    if (unauthChannel) {
      await prisma.telegramMessage.deleteMany({ where: { channelId: unauthChannel.id } });
      await prisma.telegramChannel.delete({ where: { id: unauthChannel.id } });
    }

    // Pre-create an inactive/unauthorized channel for negative tests
    await prisma.telegramChannel.create({
      data: {
        telegramChannelId: unauthorizedChannelId,
        title: 'Unauthorized Test Channel',
        username: 'unauth_test',
        isAuthorized: false,
        isActive: false,
        authorizationRecord: 'Revoked for testing',
      },
    });
  });

  after(async () => {
    // Clean up created jobs and messages
    const channel = await prisma.telegramChannel.findUnique({
      where: { telegramChannelId: testChannelId },
    });
    if (channel) {
      const messages = await prisma.telegramMessage.findMany({
        where: { channelId: channel.id },
        select: { jobId: true },
      });

      const jobIds = messages.map((m) => m.jobId).filter((id): id is string => Boolean(id));

      await prisma.telegramMessage.deleteMany({ where: { channelId: channel.id } });
      if (jobIds.length > 0) {
        await prisma.jobClassification.deleteMany({ where: { jobId: { in: jobIds } } });
        await prisma.savedJob.deleteMany({ where: { jobId: { in: jobIds } } });
        await prisma.jobNotification.deleteMany({ where: { jobId: { in: jobIds } } });
        await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
      }
      await prisma.telegramChannel.delete({ where: { id: channel.id } });
    }

    const unauthChannel = await prisma.telegramChannel.findUnique({
      where: { telegramChannelId: unauthorizedChannelId },
    });
    if (unauthChannel) {
      await prisma.telegramMessage.deleteMany({ where: { channelId: unauthChannel.id } });
      await prisma.telegramChannel.delete({ where: { id: unauthChannel.id } });
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  // 1. Authentication and Security
  describe('Authentication and Integrity Verification', () => {
    it('rejects request with 401 when no authorization headers are present', async () => {
      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: 1, channelId: testChannelId }),
      });

      assert.strictEqual(res.status, 401);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'MISSING_WORKER_CREDENTIALS');
    });

    it('rejects request with 401 when timestamp is outside 5-minute clock skew window', async () => {
      const payload = {
        channelId: testChannelId,
        messageId: 999,
        originalText: 'Test job text',
        publishedAt: new Date().toISOString(),
      };

      // 10 minutes ago
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;
      const signature = crypto.createHmac('sha256', secret).update(`${expiredTimestamp}.${JSON.stringify(payload)}`).digest('hex');

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Worker-Timestamp': expiredTimestamp.toString(),
          'X-Telegram-Worker-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 401);
      const data = (await res.json()) as any;
      assert.strictEqual(data.error.code, 'INVALID_TIMESTAMP');
    });

    it('rejects request with 401 when HMAC signature does not match secret', async () => {
      const payload = {
        channelId: testChannelId,
        messageId: 999,
        originalText: 'Test job text',
        publishedAt: new Date().toISOString(),
      };

      const now = Math.floor(Date.now() / 1000).toString();
      const forgedSignature = crypto.createHmac('sha256', 'wrong_secret_key').update(`${now}.${JSON.stringify(payload)}`).digest('hex');

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Worker-Timestamp': now,
          'X-Telegram-Worker-Signature': forgedSignature,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 401);
      const data = (await res.json()) as any;
      assert.strictEqual(data.error.code, 'INVALID_WORKER_SIGNATURE');
    });
  });

  // 2. Channel Management
  describe('Channel Management Endpoints', () => {
    it('registers a new authorized channel', async () => {
      const channelPayload = {
        telegramChannelId: testChannelId,
        username: 'test_tech_jobs',
        title: 'Test Tech Jobs Ethiopia',
        isActive: true,
        isAuthorized: true,
        authorizationRecord: 'Verified official test partner',
      };

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/channels`, {
        method: 'POST',
        headers: generateHmacHeaders(channelPayload),
        body: JSON.stringify(channelPayload),
      });

      assert.strictEqual(res.status, 201);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.channel.telegramChannelId, testChannelId);
      assert.strictEqual(data.data.channel.username, 'test_tech_jobs');
      assert.strictEqual(data.data.channel.isAuthorized, true);
    });

    it('retrieves active authorized channels list', async () => {
      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/channels`, {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.channels));
      const found = data.data.channels.find((c: any) => c.telegramChannelId === testChannelId);
      assert.ok(found, 'Newly registered test channel should be in authorized channels list');
    });
  });

  // 3. Message Ingestion & Deduplication
  describe('Message Ingestion Pipeline', () => {
    it('rejects message from unauthorized/inactive channel with 403', async () => {
      const payload = {
        channelId: unauthorizedChannelId,
        messageId: 1001,
        originalText: 'Finance Officer needed at Commercial Bank',
        publishedAt: new Date().toISOString(),
      };

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: generateHmacHeaders(payload),
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 403);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, false);
      assert.match(data.error.message, /inactive or unauthorized/);
    });

    it('successfully ingests a new job message and creates canonical Job record', async () => {
      const publishedAt = new Date('2026-11-10T08:30:00.000Z').toISOString();
      const detectedAt = new Date().toISOString();

      const payload = {
        channelId: testChannelId,
        channelUsername: 'test_tech_jobs',
        channelTitle: 'Test Tech Jobs Ethiopia',
        messageId: testMessageId,
        originalText: `
          💼 Position: Senior TypeScript Engineer
          🏢 Company: EthioFinTech Solutions
          📍 Location: Addis Ababa, Ethiopia (Bole)
          💰 Salary: 55,000 - 75,000 ETB / month
          ⏳ Deadline: November 30, 2026
          
          Requirements:
          - 4+ years of TypeScript/Node.js experience
          - Experience with PostgreSQL and Docker
          - Good communication skills
          
          Apply via: jobs@ethiofintech.et
        `.trim(),
        publishedAt,
        detectedAt,
        sourceUrl: `https://t.me/test_tech_jobs/${testMessageId}`,
        mediaMetadata: {
          className: 'MessageMediaPhoto',
          hasPhoto: true,
        },
      };

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: generateHmacHeaders(payload),
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 201);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.duplicate, false);
      assert.strictEqual(data.data.processingStatus, 'PROCESSED');
      assert.ok(data.data.jobId, 'Job ID should be returned');

      // Verify canonical Job record in database
      const job = await prisma.job.findUnique({
        where: { id: data.data.jobId },
        include: { source: true },
      });

      assert.ok(job);
      assert.strictEqual(job.source.slug, 'telegram');
      assert.strictEqual(job.fingerprint, `ext:tg-${testChannelId}-${testMessageId}`);
      assert.strictEqual(job.companyName, 'EthioFinTech Solutions');
      assert.strictEqual(job.normalizedTitle, 'Senior TypeScript Engineer');
      assert.strictEqual(Number(job.salaryMin), 55000);
      assert.strictEqual(Number(job.salaryMax), 75000);
      assert.strictEqual(job.salaryCurrency, 'ETB');

      // Verify TelegramMessage record in database
      const tgMsg = await prisma.telegramMessage.findUnique({
        where: { id: data.data.telegramMessageRecordId },
      });
      assert.ok(tgMsg);
      assert.strictEqual(tgMsg.telegramMessageId, testMessageId);
      assert.strictEqual(tgMsg.processingStatus, 'PROCESSED');
      assert.strictEqual(tgMsg.jobId, job.id);
    });

    it('handles duplicate messages idempotently without duplicate jobs', async () => {
      const payload = {
        channelId: testChannelId,
        channelUsername: 'test_tech_jobs',
        channelTitle: 'Test Tech Jobs Ethiopia',
        messageId: testMessageId,
        originalText: 'Duplicate submission of Senior TypeScript Engineer',
        publishedAt: new Date().toISOString(),
      };

      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/messages`, {
        method: 'POST',
        headers: generateHmacHeaders(payload),
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.duplicate, true);
      assert.ok(data.data.jobId);

      // Verify only ONE job exists with this fingerprint
      const jobCount = await prisma.job.count({
        where: { fingerprint: `ext:tg-${testChannelId}-${testMessageId}` },
      });
      assert.strictEqual(jobCount, 1, 'Duplicate messages must not create duplicate jobs');
    });

    it('returns operational status with metrics and active channels', async () => {
      const res = await fetch(`${baseUrl}/api/v1/internal/telegram/status`, {
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const data = (await res.json()) as any;
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'healthy');
      assert.ok(data.data.messages.total >= 1);
      assert.ok(data.data.channels.active >= 1);
    });
  });
});
