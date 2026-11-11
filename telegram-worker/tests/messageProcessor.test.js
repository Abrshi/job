import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ChannelRegistry } from '../src/telegram/channels.js';
import { OutboxStore } from '../src/storage/outbox.js';
import { MessageProcessor } from '../src/services/messageProcessor.js';

describe('MessageProcessor', () => {
  let tempDir;
  let dbPath;
  let outbox;
  let registry;
  let processor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'processor-test-'));
    dbPath = path.join(tempDir, 'test-proc-outbox.db');
    outbox = new OutboxStore(dbPath);
    registry = new ChannelRegistry();
    processor = new MessageProcessor(registry, outbox);

    // Register a test authorized channel
    registry.register({
      telegramChannelId: '-1001140939513',
      username: 'ethiojobs_official',
      title: 'Ethiojobs Official',
      isAuthorized: true,
      isActive: true,
    });

    // Register an unauthorized channel for testing
    registry.register({
      telegramChannelId: '-1009999999999',
      username: 'unauthorized_channel',
      title: 'Unauthorized Scrape Channel',
      isAuthorized: false,
      isActive: false,
    });
  });

  afterEach(() => {
    if (outbox) {
      outbox.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects events from unconfigured or unauthorized channels', async () => {
    // 1. Channel not in registry
    const unknownEvent = {
      message: {
        id: 101,
        text: 'Software Engineer vacancy',
        peerId: { channelId: 88888888 },
      },
    };
    const res1 = await processor.processEvent(unknownEvent);
    assert.equal(res1, null);

    // 2. Channel in registry but unauthorized
    const unauthorizedEvent = {
      message: {
        id: 102,
        text: 'Accountant vacancy',
        peerId: { channelId: 9999999999 },
      },
    };
    const res2 = await processor.processEvent(unauthorizedEvent);
    assert.equal(res2, null);

    const stats = outbox.getStats();
    assert.equal(stats.total, 0, 'Unauthorized events must not be enqueued');
  });

  it('rejects messages with empty text content', async () => {
    const emptyMsgEvent = {
      message: {
        id: 201,
        text: '   ',
        peerId: { channelId: 1140939513 },
      },
    };
    const result = await processor.processEvent(emptyMsgEvent);
    assert.equal(result, null);

    const stats = outbox.getStats();
    assert.equal(stats.total, 0);
  });

  it('processes authorized messages, separates publishedAt from detectedAt, and extracts media metadata', async () => {
    const telegramTimestampSeconds = 1731234567; // Known UNIX timestamp
    const expectedPublishedIso = new Date(telegramTimestampSeconds * 1000).toISOString();

    const event = {
      message: {
        id: 555,
        text: 'Senior Full Stack Developer needed at Ethio Telecom. Apply via email: hr@ethiotelecom.et',
        date: telegramTimestampSeconds,
        peerId: { channelId: 1140939513 },
        media: {
          className: 'MessageMediaDocument',
          document: {
            mimeType: 'application/pdf',
            size: 1048576,
          },
        },
        views: 1200,
        forwards: 45,
      },
    };

    const beforeProcess = Date.now();
    const result = await processor.processEvent(event);
    const afterProcess = Date.now();

    assert.ok(result);
    assert.equal(result.channelId, '-1001140939513');
    assert.equal(result.channelUsername, 'ethiojobs_official');
    assert.equal(result.messageId, 555);
    assert.equal(result.publishedAt, expectedPublishedIso);

    // detectedAt must be an ISO string generated right now
    const detectedTimestamp = new Date(result.detectedAt).getTime();
    assert.ok(detectedTimestamp >= beforeProcess && detectedTimestamp <= afterProcess);
    assert.notEqual(result.publishedAt, result.detectedAt);

    // Media metadata captured without downloading files
    assert.equal(result.mediaMetadata.mimeType, 'application/pdf');
    assert.equal(result.mediaMetadata.sizeBytes, 1048576);

    // Source URL generated properly
    assert.equal(result.sourceUrl, 'https://t.me/ethiojobs_official/555');

    // Enqueued into outbox
    const stats = outbox.getStats();
    assert.equal(stats.total, 1);
    assert.equal(stats.pending, 1);

    // Channel activity updated
    const channel = registry.getChannel('-1001140939513');
    assert.equal(channel.lastMessageId, 555);
    assert.ok(channel.lastEventAt);
  });

  it('handles duplicate messages idempotently', async () => {
    const event = {
      message: {
        id: 777,
        text: 'Data Analyst needed at Dashen Bank',
        date: 1731235000,
        peerId: { channelId: 1140939513 },
      },
    };

    // First process
    const res1 = await processor.processEvent(event);
    assert.ok(res1);
    assert.equal(outbox.getStats().total, 1);

    // Second process of identical message
    const res2 = await processor.processEvent(event);
    assert.ok(res2);
    assert.equal(outbox.getStats().total, 1, 'Duplicate message should not create second outbox entry');
  });

  it('supports channel lookup via @username from chat object', async () => {
    const event = {
      chat: {
        username: 'ethiojobs_official',
      },
      message: {
        id: 888,
        text: 'Product Designer job posting',
        date: 1731236000,
      },
    };

    const result = await processor.processEvent(event);
    assert.ok(result);
    assert.equal(result.channelId, '-1001140939513');
    assert.equal(result.channelUsername, 'ethiojobs_official');
  });

  it('dynamically resolves channel via async event.getChat() and aliases numeric channelId', async () => {
    // Register channel by username only initially (e.g. from environment variable)
    registry.register({
      telegramChannelId: 'user_afriwork',
      username: 'afriwork',
      title: 'Afriwork (Freelance & Jobs)',
      isAuthorized: true,
      isActive: true,
    });

    const realChannelNumeric = 1416972045;
    const event = {
      message: {
        id: 1001,
        text: 'Frontend Developer needed urgently in Addis Ababa',
        date: 1731237000,
        peerId: { channelId: realChannelNumeric },
      },
      getChat: async () => ({
        id: realChannelNumeric,
        username: 'afriwork',
        title: 'Afriwork (Freelance & Jobs)',
      }),
    };

    const result = await processor.processEvent(event);
    assert.ok(result);
    assert.equal(result.channelId, '-1001416972045');
    assert.equal(result.channelUsername, 'afriwork');
    assert.equal(result.sourceUrl, 'https://t.me/afriwork/1001');

    // Subsequent message with same peerId should match without calling getChat
    const secondEvent = {
      message: {
        id: 1002,
        text: 'Backend Developer vacancy',
        date: 1731237100,
        peerId: { channelId: realChannelNumeric },
      },
    };
    const res2 = await processor.processEvent(secondEvent);
    assert.ok(res2);
    assert.equal(res2.channelId, '-1001416972045');
  });

  it('supports message.getChat() fallback and matches by title if username missing', async () => {
    registry.register({
      telegramChannelId: '-1001802914101',
      username: 'qetero',
      title: 'Qetero Jobs',
      isAuthorized: true,
      isActive: true,
    });

    const event = {
      message: {
        id: 2001,
        text: 'Marketing Officer position available',
        date: 1731238000,
        peerId: { channelId: 1802914101 },
        getChat: async () => ({
          id: 1802914101,
          title: 'Qetero Jobs',
        }),
      },
    };

    const result = await processor.processEvent(event);
    assert.ok(result);
    assert.equal(result.channelId, '-1001802914101');
    assert.equal(result.channelTitle, 'Qetero Jobs');
  });
});
