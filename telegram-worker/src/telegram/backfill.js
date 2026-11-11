import { channelRegistry } from './channels.js';
import { messageProcessor } from '../services/messageProcessor.js';
import { logger } from '../utils/logger.js';

/**
 * Fetch and process the last N messages from each active authorized channel.
 * Outbox and backend deduplication ensure already-ingested messages are ignored idempotently.
 *
 * @param {object} client GramJS TelegramClient
 * @param {number} limitPerChannel Maximum messages to scan per channel
 * @returns {Promise<number>} Number of newly enqueued messages
 */
export async function catchUpRecentMessages(client, limitPerChannel = 15) {
  if (!client) return 0;

  logger.info(`[Backfill] Catching up recent messages (up to ${limitPerChannel} per channel)...`);
  const activeChannels = channelRegistry.getActiveChannels();
  let totalEnqueued = 0;

  for (const ch of activeChannels) {
    try {
      let targetEntity = null;

      // 1. Resolve entity by username if available
      if (ch.username) {
        try {
          targetEntity = await client.getEntity(ch.username);
        } catch (err) {
          logger.debug(`[Backfill] getEntity for @${ch.username} notice: ${err.message}`);
        }
      }

      // 2. Fallback to numeric channel ID
      if (!targetEntity && ch.telegramChannelId && !ch.telegramChannelId.startsWith('user_')) {
        try {
          targetEntity = await client.getEntity(ch.telegramChannelId);
        } catch (err) {
          logger.debug(`[Backfill] getEntity for ${ch.telegramChannelId} notice: ${err.message}`);
        }
      }

      if (!targetEntity) {
        logger.debug(`[Backfill] Skipping '${ch.title}': entity not yet resolvable.`);
        continue;
      }

      const messages = await client.getMessages(targetEntity, { limit: limitPerChannel });

      if (Array.isArray(messages) && messages.length > 0) {
        let channelCount = 0;
        // Process in chronological order (oldest to newest)
        const chronological = [...messages].reverse();

        for (const msg of chronological) {
          const text = (msg.message || msg.text || '').trim();
          if (text) {
            try {
              const res = await messageProcessor.processEvent(msg);
              if (res) {
                channelCount += 1;
              }
            } catch (procErr) {
              logger.debug(`[Backfill] Message process notice: ${procErr.message}`);
            }
          }
        }

        if (channelCount > 0) {
          totalEnqueued += channelCount;
          logger.info(`[Backfill] Successfully enqueued ${channelCount} messages from '${ch.title}' (@${ch.username || 'channel'})`);
        }
      }
    } catch (err) {
      logger.warn(`[Backfill] Notice during catch-up for '${ch.title}': ${err.message}`);
    }
  }

  logger.info(`[Backfill] Catch-up scan complete. Total messages enqueued: ${totalEnqueued}.`);
  return totalEnqueued;
}
