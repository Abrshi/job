import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { outbox } from '../storage/outbox.js';
import { logger } from '../utils/logger.js';
import { calculateBackoff, evaluateRetryable } from './retry.js';

export class WebhookDeliveryService {
  constructor() {
    this.isRunning = false;
    this.timer = null;
    this.isFlushing = false;
    this.client = axios.create({
      baseURL: env.BACKEND_URL,
      timeout: env.WEBHOOK_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate HMAC SHA-256 signature for outgoing payload
   */
  signPayload(payloadString, timestamp) {
    const dataToSign = `${timestamp}.${payloadString}`;
    return crypto.createHmac('sha256', env.INTERNAL_API_SECRET).update(dataToSign).digest('hex');
  }

  /**
   * Send a single message event to the backend endpoint
   */
  async deliverEvent(eventRecord) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadStr = JSON.stringify(eventRecord.payload);
    const signature = this.signPayload(payloadStr, timestamp);

    outbox.markProcessing(eventRecord.id);

    try {
      const response = await this.client.post(env.WEBHOOK_PATH, eventRecord.payload, {
        headers: {
          'X-Telegram-Worker-Signature': signature,
          'X-Telegram-Worker-Timestamp': timestamp,
          'Authorization': `Bearer ${env.INTERNAL_API_SECRET}`,
        },
      });

      outbox.markDelivered(eventRecord.id);
      logger.info(`[WebhookDelivery] Successfully delivered event ${eventRecord.id} (HTTP ${response.status})`);
      return { success: true };
    } catch (err) {
      const evaluation = evaluateRetryable(err);
      const nextAttempt = (eventRecord.attempts || 0) + 1;
      const isPermanent = !evaluation.isRetryable || nextAttempt >= env.MAX_RETRY_ATTEMPTS;

      const backoffMs = evaluation.retryAfterMs || calculateBackoff(nextAttempt);
      const nextAttemptAt = Date.now() + backoffMs;
      const errorMsg = err.response?.data?.message || err.message || evaluation.reason;

      outbox.markFailed(eventRecord.id, errorMsg, nextAttemptAt, isPermanent);

      if (isPermanent) {
        logger.error(`[WebhookDelivery] Permanent failure delivering event ${eventRecord.id} (${evaluation.reason}): ${errorMsg}`);
      } else {
        logger.warn(`[WebhookDelivery] Transient failure delivering event ${eventRecord.id} (${evaluation.reason}). Retry #${nextAttempt} in ${Math.round(backoffMs / 1000)}s: ${errorMsg}`);
      }

      return { success: false, error: errorMsg, isPermanent };
    }
  }

  /**
   * Flush pending outbox batch
   */
  async flushOutbox() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const batch = outbox.getPendingBatch(15);
      if (batch.length > 0) {
        logger.debug(`[WebhookDelivery] Flushing ${batch.length} pending outbox items...`);
        for (const item of batch) {
          if (!this.isRunning) break;
          await this.deliverEvent(item);
        }
      }
    } catch (err) {
      logger.error(`[WebhookDelivery] Error during outbox flush: ${err.message}`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Start recurring delivery worker
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`[WebhookDelivery] Started outbox delivery engine (flush interval: ${env.OUTBOX_FLUSH_INTERVAL_MS}ms)`);

    // Initial flush
    this.flushOutbox();

    this.timer = setInterval(() => {
      this.flushOutbox();
    }, env.OUTBOX_FLUSH_INTERVAL_MS);
  }

  /**
   * Stop delivery worker gracefully
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[WebhookDelivery] Outbox delivery engine stopped.');
  }
}

export const webhookDelivery = new WebhookDeliveryService();
