import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class OutboxStore {
  constructor(dbPath = env.OUTBOX_DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(channel_id, message_id)
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_pending 
        ON outbox_events(status, next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_created 
        ON outbox_events(created_at);
    `);

    // Reset any previously 'PROCESSING' records back to 'PENDING' on startup so they are not orphaned
    const reset = this.db.prepare(`
      UPDATE outbox_events 
      SET status = 'PENDING', updated_at = ? 
      WHERE status = 'PROCESSING'
    `).run(Date.now());

    if (reset.changes > 0) {
      logger.info(`[Outbox] Recovered ${reset.changes} in-flight outbox events on startup.`);
    }
  }

  /**
   * Enqueue a new event idempotently (ignores if identical channel_id + message_id is already in outbox)
   */
  enqueue(event) {
    const now = Date.now();
    const id = `${event.channelId}_${event.messageId}`;
    const payloadStr = JSON.stringify(event);

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO outbox_events 
        (id, channel_id, message_id, payload, status, attempts, next_attempt_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)
    `);

    const result = stmt.run(id, event.channelId, event.messageId, payloadStr, now, now, now);
    return {
      id,
      inserted: result.changes > 0,
    };
  }

  /**
   * Get a batch of events ready for delivery
   */
  getPendingBatch(limit = 20) {
    const now = Date.now();
    const rows = this.db.prepare(`
      SELECT id, channel_id as channelId, message_id as messageId, payload, attempts
      FROM outbox_events
      WHERE status = 'PENDING' AND next_attempt_at <= ?
      ORDER BY created_at ASC
      LIMIT ?
    `).all(now, limit);

    return rows.map((r) => ({
      ...r,
      payload: JSON.parse(r.payload),
    }));
  }

  /**
   * Mark record as actively being delivered
   */
  markProcessing(id) {
    this.db.prepare(`
      UPDATE outbox_events 
      SET status = 'PROCESSING', updated_at = ?
      WHERE id = ?
    `).run(Date.now(), id);
  }

  /**
   * Mark record as successfully delivered
   */
  markDelivered(id) {
    this.db.prepare(`
      UPDATE outbox_events 
      SET status = 'DELIVERED', updated_at = ?
      WHERE id = ?
    `).run(Date.now(), id);
  }

  /**
   * Mark record as failed with next retry timestamp or permanent failure
   */
  markFailed(id, errorMessage, nextAttemptAt, isPermanent = false) {
    const now = Date.now();
    const newStatus = isPermanent ? 'FAILED' : 'PENDING';

    this.db.prepare(`
      UPDATE outbox_events 
      SET status = ?, 
          attempts = attempts + 1, 
          last_error = ?, 
          next_attempt_at = ?, 
          updated_at = ?
      WHERE id = ?
    `).run(newStatus, errorMessage, nextAttemptAt, now, id);
  }

  /**
   * Get operational outbox statistics
   */
  getStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM outbox_events
    `).get();

    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      processing: stats.processing || 0,
      delivered: stats.delivered || 0,
      failed: stats.failed || 0,
    };
  }

  /**
   * Get recent outbox events for admin delivery monitoring
   */
  getRecentEvents(limit = 50, status = null) {
    let query = 'SELECT id, channel_id as channelId, message_id as messageId, status, attempts, last_error as lastError, next_attempt_at as nextAttemptAt, created_at as createdAt, updated_at as updatedAt, payload FROM outbox_events';
    const params = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    return this.db.prepare(query).all(...params).map((r) => {
      try {
        r.payload = JSON.parse(r.payload);
      } catch {}
      return r;
    });
  }

  /**
   * Reset a failed event to PENDING for immediate retry
   */
  retryEvent(id) {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE outbox_events 
      SET status = 'PENDING', attempts = 0, next_attempt_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, id);
    return result.changes > 0;
  }

  /**
   * Purge delivered messages older than N days to keep disk usage lean
   */
  cleanupOldDelivered(days = 7) {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      DELETE FROM outbox_events 
      WHERE status = 'DELIVERED' AND updated_at < ?
    `);
    const res = stmt.run(threshold);
    if (res.changes > 0) {
      logger.info(`[Outbox] Cleaned up ${res.changes} expired delivered records.`);
    }
  }

  close() {
    try {
      this.db.close();
    } catch {
      // Ignore on exit
    }
  }
}

export const outbox = new OutboxStore();
