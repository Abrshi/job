import { channelRegistry } from '../telegram/channels.js';
import { outbox } from '../storage/outbox.js';
import { logger } from '../utils/logger.js';

export class MessageProcessor {
  constructor(registry = channelRegistry, outboxStore = outbox) {
    this.channelRegistry = registry;
    this.outbox = outboxStore;
  }

  /**
   * Process an incoming message from GramJS listener
   * @param {object} event GramJS NewMessage event or raw message object
   */
  async processEvent(event) {
    const message = event.message || event;
    if (!message) return null;

    const peerId = message.peerId;
    let channelId = '';
    if (peerId) {
      if (peerId.channelId) {
        channelId = `-100${peerId.channelId.toString()}`;
      } else if (peerId.chatId) {
        channelId = `-${peerId.chatId.toString()}`;
      } else if (peerId.userId) {
        channelId = peerId.userId.toString();
      }
    } else if (message.chatId) {
      channelId = String(message.chatId);
    } else if (event.chatId) {
      const cid = event.chatId.toString();
      channelId = cid.startsWith('-') ? cid : `-100${cid}`;
    }

    const messageId = Number(message.id);
    const originalText = (message.message || message.text || '').trim();

    // 1. Authorization check
    let channelRecord = this.channelRegistry.getChannel(channelId);

    // If not matched immediately by channelId, resolve chat entity asynchronously
    if (!channelRecord) {
      let chat = null;
      if (typeof event.getChat === 'function') {
        try {
          chat = await event.getChat();
        } catch (err) {
          logger.debug(`[MessageProcessor] event.getChat() notice: ${err.message}`);
        }
      }
      if (!chat && message && typeof message.getChat === 'function') {
        try {
          chat = await message.getChat();
        } catch (err) {
          logger.debug(`[MessageProcessor] message.getChat() notice: ${err.message}`);
        }
      }
      if (!chat && event.chat) {
        chat = event.chat;
      }

      if (chat) {
        const username = chat.username ? chat.username.toLowerCase().replace(/^@/, '') : null;
        if (username) {
          channelRecord = this.channelRegistry.getChannel(`@${username}`) || this.channelRegistry.getChannel(username);
        }
        if (!channelRecord && chat.id) {
          const rawId = chat.id.toString();
          channelRecord = this.channelRegistry.getChannel(rawId) || this.channelRegistry.getChannel(`-100${rawId}`);
        }
        if (!channelRecord && chat.title) {
          const titleLower = chat.title.toLowerCase();
          channelRecord = this.channelRegistry.getAllChannels().find(
            (c) => c.title && c.title.toLowerCase() === titleLower
          );
        }

        // If found by username/chat, alias channelId to this record!
        if (channelRecord) {
          if (channelId) {
            this.channelRegistry.aliasChannelId(channelId, channelRecord);
          }
          if (chat.title && (!channelRecord.title || channelRecord.title.startsWith('@') || channelRecord.title.startsWith('Channel '))) {
            channelRecord.title = chat.title;
          }
          logger.info(`[MessageProcessor] Dynamically resolved channel '${channelRecord.title}' (@${channelRecord.username || ''}) to ID ${channelId}`);
        }
      }
    }

    if (!channelRecord || !channelRecord.isAuthorized || !channelRecord.isActive) {
      const channelLabel = channelRecord ? channelRecord.title : (channelId || 'unknown');
      logger.debug(`[MessageProcessor] Ignored message #${messageId} from unauthorized or inactive channel: ${channelLabel}`);
      return null;
    }

    // Must have text to be a processable job posting
    if (!originalText) {
      logger.debug(`[MessageProcessor] Message #${messageId} in ${channelRecord.title} has no text body. Skipping.`);
      return null;
    }

    // Prefer canonical -100... channelId over dummy user_ IDs
    const resolvedChannelId = (channelRecord.telegramChannelId && !channelRecord.telegramChannelId.startsWith('user_'))
      ? channelRecord.telegramChannelId
      : (channelId || channelRecord.telegramChannelId);

    if (channelRecord.telegramChannelId.startsWith('user_') && resolvedChannelId !== channelRecord.telegramChannelId) {
      channelRecord.telegramChannelId = resolvedChannelId;
      this.channelRegistry.register(channelRecord);
    }

    // 2. Extract Original Publication Timestamp vs Detection Timestamp
    // Telegram `message.date` is UNIX epoch timestamp in seconds
    const publishedAt = message.date
      ? new Date(message.date * 1000).toISOString()
      : new Date().toISOString();
    const detectedAt = new Date().toISOString();

    // 3. Extract Source URL
    let sourceUrl = '';
    if (channelRecord.username) {
      sourceUrl = `https://t.me/${channelRecord.username}/${messageId}`;
    } else if (resolvedChannelId.startsWith('-100')) {
      const shortId = resolvedChannelId.replace('-100', '');
      sourceUrl = `https://t.me/c/${shortId}/${messageId}`;
    }

    // 4. Extract Media Metadata (do NOT download binary files)
    let mediaMetadata = null;
    if (message.media) {
      mediaMetadata = {
        className: message.media.className || message.media.constructor?.name,
        hasDocument: Boolean(message.media.document),
        hasPhoto: Boolean(message.media.photo),
      };

      if (message.media.document) {
        const doc = message.media.document;
        mediaMetadata.mimeType = doc.mimeType;
        mediaMetadata.sizeBytes = Number(doc.size || 0);
      }
    }

    // 5. Build DTO
    const payload = {
      channelId: resolvedChannelId,
      channelUsername: channelRecord.username,
      channelTitle: channelRecord.title,
      messageId,
      originalText,
      publishedAt,
      detectedAt,
      sourceUrl,
      mediaMetadata,
      rawPayload: {
        fwdFrom: message.fwdFrom ? true : false,
        views: message.views || 0,
        forwards: message.forwards || 0,
        editDate: message.editDate ? new Date(message.editDate * 1000).toISOString() : null,
      },
    };

    // 6. Enqueue into persistent Outbox
    const enqueueResult = this.outbox.enqueue(payload);

    if (enqueueResult.inserted) {
      logger.info(`[MessageProcessor] Enqueued new message #${messageId} from '${channelRecord.title}' to outbox.`);
      this.channelRegistry.updateChannelActivity(channelRecord.telegramChannelId, messageId);
    } else {
      logger.debug(`[MessageProcessor] Message #${messageId} already exists in outbox.`);
    }

    return payload;
  }
}

export const messageProcessor = new MessageProcessor();
