import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OutboxStore } from '../src/storage/outbox.js';

describe('OutboxStore', () => {
  let tempDir;
  let dbPath;
  let outbox;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-test-'));
    dbPath = path.join(tempDir, 'test-outbox.db');
    outbox = new OutboxStore(dbPath);
  });

  afterEach(() => {
    if (outbox) {
      outbox.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('enqueues a new message successfully', () => {
    const event = {
      channelId: '-1001234567890',
      messageId: 42,
      originalText: 'Urgent Senior Backend Developer vacancy at Addis Software',
      publishedAt: '2026-11-10T10:00:00.000Z',
      detectedAt: '2026-11-10T10:00:02.000Z',
    };

    const result = outbox.enqueue(event);
    assert.equal(result.id, '-1001234567890_42');
    assert.equal(result.inserted, true);

    const stats = outbox.getStats();
    assert.equal(stats.total, 1);
    assert.equal(stats.pending, 1);
    assert.equal(stats.processing, 0);
    assert.equal(stats.delivered, 0);
  });

  it('ignores duplicate enqueues for the same channelId and messageId', () => {
    const event = {
      channelId: '-1001234567890',
      messageId: 42,
      originalText: 'Initial text',
    };

    const first = outbox.enqueue(event);
    assert.equal(first.inserted, true);

    const second = outbox.enqueue({
      ...event,
      originalText: 'Updated/Duplicate text',
    });
    assert.equal(second.inserted, false);
    assert.equal(second.id, '-1001234567890_42');

    const stats = outbox.getStats();
    assert.equal(stats.total, 1);
    assert.equal(stats.pending, 1);
  });

  it('retrieves pending batch ordered by created_at', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 101, text: 'Job 1' });
    outbox.enqueue({ channelId: 'ch1', messageId: 102, text: 'Job 2' });
    outbox.enqueue({ channelId: 'ch1', messageId: 103, text: 'Job 3' });

    const batch = outbox.getPendingBatch(2);
    assert.equal(batch.length, 2);
    assert.equal(batch[0].id, 'ch1_101');
    assert.equal(batch[1].id, 'ch1_102');
    assert.equal(batch[0].payload.text, 'Job 1');
  });

  it('transitions state through processing and delivered', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 201, text: 'Job test' });
    const eventId = 'ch1_201';

    outbox.markProcessing(eventId);
    let stats = outbox.getStats();
    assert.equal(stats.processing, 1);
    assert.equal(stats.pending, 0);

    // Processing items are not returned in pending batch
    const pendingBatch = outbox.getPendingBatch(10);
    assert.equal(pendingBatch.length, 0);

    outbox.markDelivered(eventId);
    stats = outbox.getStats();
    assert.equal(stats.delivered, 1);
    assert.equal(stats.processing, 0);
    assert.equal(stats.pending, 0);
  });

  it('marks transient failure with future retry timestamp', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 301, text: 'Retry test' });
    const eventId = 'ch1_301';

    const futureRetry = Date.now() + 10000;
    outbox.markFailed(eventId, 'Network timeout', futureRetry, false);

    const stats = outbox.getStats();
    assert.equal(stats.pending, 1); // Status is still PENDING for retry
    assert.equal(stats.failed, 0);

    // Should not be in pending batch because next_attempt_at is in the future
    const pendingNow = outbox.getPendingBatch(10);
    assert.equal(pendingNow.length, 0);
  });

  it('marks permanent failure when isPermanent is true', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 401, text: 'Permanent error' });
    const eventId = 'ch1_401';

    outbox.markFailed(eventId, 'HTTP 400 Bad Request', Date.now(), true);

    const stats = outbox.getStats();
    assert.equal(stats.failed, 1);
    assert.equal(stats.pending, 0);

    const pendingNow = outbox.getPendingBatch(10);
    assert.equal(pendingNow.length, 0);
  });

  it('recovers in-flight PROCESSING items on restart/crash recovery', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 501, text: 'Crash job' });
    outbox.markProcessing('ch1_501');

    assert.equal(outbox.getStats().processing, 1);
    assert.equal(outbox.getStats().pending, 0);

    // Close and create a new OutboxStore instance pointing to the same SQLite file
    outbox.close();

    const recoveredOutbox = new OutboxStore(dbPath);
    const stats = recoveredOutbox.getStats();
    assert.equal(stats.processing, 0);
    assert.equal(stats.pending, 1, 'In-flight processing item should be reset to PENDING');

    const pending = recoveredOutbox.getPendingBatch(10);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].id, 'ch1_501');

    recoveredOutbox.close();
  });

  it('cleans up old delivered records', () => {
    outbox.enqueue({ channelId: 'ch1', messageId: 601, text: 'Old delivered' });
    outbox.markDelivered('ch1_601');

    // Simulate record being 10 days old by updating updated_at directly
    const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
    outbox.db.prepare('UPDATE outbox_events SET updated_at = ? WHERE id = ?').run(oldTimestamp, 'ch1_601');

    assert.equal(outbox.getStats().delivered, 1);

    outbox.cleanupOldDelivered(7); // Cleanup records older than 7 days
    assert.equal(outbox.getStats().delivered, 0);
  });
});
