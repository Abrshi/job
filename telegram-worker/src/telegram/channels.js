import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Default authorized channels taxonomy in Ethiopia if no channels configured yet in backend
export const DEFAULT_AUTHORIZED_ETHIOPIAN_CHANNELS = [
  { telegramChannelId: '-1001140939513', username: 'ethiojobsofficial', title: 'Ethiojobs Official', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001140939513', username: 'ethiojobs_official', title: 'Ethiojobs Official', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001292151624', username: 'hahujobs', title: 'HaHuJobs', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001416972045', username: 'afriwork', title: 'Afriwork (Freelance & Jobs)', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001185521402', username: 'tikvahethiopiajobs', title: 'Tikvah Jobs Ethiopia', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001550992011', username: 'shegajobs', title: 'Shega Jobs', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001321445109', username: 'geezjobs_ethiopia', title: 'GeezJobs Community', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001321445109', username: 'geezjobs', title: 'GeezJobs Community', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001642231908', username: 'addisjobs', title: 'Addis Jobs Vacancy', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001712948122', username: 'elelanjobs', title: 'Elelan Jobs Ethiopia', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001802914101', username: 'qetero', title: 'Qetero Jobs', isAuthorized: true, isActive: true },
  { telegramChannelId: '-1001901234567', username: 'ngojobsethiopia', title: 'NGO Jobs in Ethiopia', isAuthorized: true, isActive: true },
];

export class ChannelRegistry {
  constructor() {
    this.channels = new Map(); // key: channelId or normalized username, value: channel metadata
  }

  /**
   * Initialize and sync authorized channels dynamically from backend database
   */
  async syncChannels() {
    logger.info('[ChannelRegistry] Synchronizing authorized channels list from backend database...');

    try {
      const response = await axios.get(`${env.BACKEND_URL}${env.CHANNELS_SYNC_PATH}`, {
        headers: {
          Authorization: `Bearer ${env.INTERNAL_API_SECRET}`,
        },
        timeout: 5000,
      });

      const serverChannels = response.data?.data?.channels;
      if (Array.isArray(serverChannels)) {
        // Clear in-memory map to stay strictly synchronized with backend additions/deletions
        this.channels.clear();
        for (const ch of serverChannels) {
          this.register(ch);
        }
        logger.info(`[ChannelRegistry] Synced ${serverChannels.length} channels from backend API.`);
      }
    } catch (err) {
      logger.warn(`[ChannelRegistry] Could not fetch channels from backend (${err.message}). Retaining ${this.channels.size} cached channels in memory.`);
    }

    if (this.channels.size === 0) {
      logger.warn('[ChannelRegistry] No active channels configured in database. Use the Admin Dashboard (http://localhost:3001/telegram) to register and activate channels.');
    } else {
      logger.info(`[ChannelRegistry] Channel registry active with ${this.getActiveChannels().length} active channels.`);
    }
  }

  /**
   * Register or update a channel in memory
   */
  register(channelData) {
    const rawId = String(channelData.telegramChannelId || channelData.id || '');
    const record = {
      telegramChannelId: rawId,
      username: channelData.username ? channelData.username.toLowerCase().replace(/^@/, '') : undefined,
      title: channelData.title || channelData.username || `Channel ${rawId}`,
      isActive: channelData.isActive !== false,
      isAuthorized: channelData.isAuthorized !== false,
      authorizationRecord: channelData.authorizationRecord || 'Authorized',
      dateAdded: channelData.createdAt ? new Date(channelData.createdAt).toISOString() : new Date().toISOString(),
      lastMessageId: channelData.lastMessageId || null,
      lastEventAt: channelData.lastEventAt || null,
    };

    // Index by ID
    if (record.telegramChannelId) {
      const idKey = record.telegramChannelId.toLowerCase();
      this.channels.set(idKey, record);

      if (idKey.startsWith('-100')) {
        this.channels.set(idKey.replace('-100', ''), record);
      } else if (/^\d+$/.test(idKey)) {
        this.channels.set(`-100${idKey}`, record);
      }
    }

    // Index by username
    if (record.username) {
      this.channels.set(`@${record.username}`, record);
      this.channels.set(record.username, record);
      this.channels.set(`user_${record.username}`, record);
    }

    return record;
  }

  /**
   * Dynamically alias an incoming Telegram channel ID (like -100...) to a known channel record
   */
  aliasChannelId(channelId, record) {
    if (!channelId || !record) return;
    const cleanId = String(channelId).trim().toLowerCase();
    this.channels.set(cleanId, record);

    if (cleanId.startsWith('-100')) {
      this.channels.set(cleanId.replace('-100', ''), record);
    } else if (/^\d+$/.test(cleanId)) {
      this.channels.set(`-100${cleanId}`, record);
    }

    if (!record.telegramChannelId || record.telegramChannelId.startsWith('user_')) {
      record.telegramChannelId = cleanId.startsWith('-100') ? cleanId : (cleanId.startsWith('-') ? cleanId : `-100${cleanId}`);
    }
  }

  /**
   * Fast lookup to determine if an incoming channel is authorized and active
   * @param {string|number} identifier Channel ID, numeric ID, or username
   */
  getChannel(identifier) {
    if (!identifier) return null;
    const key = String(identifier).toLowerCase().trim();
    return this.channels.get(key) || null;
  }

  isAuthorized(identifier) {
    const ch = this.getChannel(identifier);
    return Boolean(ch && ch.isAuthorized && ch.isActive);
  }

  getActiveChannels() {
    // Unique channel list (filter out secondary index keys)
    const unique = new Map();
    for (const ch of this.channels.values()) {
      unique.set(ch.telegramChannelId, ch);
    }
    return Array.from(unique.values()).filter((c) => c.isActive && c.isAuthorized);
  }

  getAllChannels() {
    const unique = new Map();
    for (const ch of this.channels.values()) {
      unique.set(ch.telegramChannelId, ch);
    }
    return Array.from(unique.values());
  }

  updateChannelActivity(channelId, messageId) {
    const ch = this.getChannel(channelId);
    if (ch) {
      ch.lastMessageId = messageId;
      ch.lastEventAt = new Date().toISOString();
    }
  }

  /**
   * Resolve channel entities with Telegram MTProto
   * Populates dialogs and matches exact numeric IDs (-100...)
   */
  async resolveChannelEntities(client) {
    if (!client) return;

    logger.info('[ChannelRegistry] Resolving channel entities and loading dialogs from Telegram MTProto...');

    // 1. Fetch user dialogs to populate GramJS entity cache and match joined channels
    try {
      const dialogs = await client.getDialogs({ limit: 100 });
      for (const dialog of dialogs) {
        const entity = dialog.entity;
        if (!entity) continue;

        const rawId = entity.id ? entity.id.toString() : '';
        if (!rawId) continue;

        const channelId = `-100${rawId}`;
        const username = entity.username ? entity.username.toLowerCase().replace(/^@/, '') : null;
        const title = entity.title || username || `Channel ${channelId}`;

        let existing = null;
        if (username) {
          existing = this.getChannel(`@${username}`) || this.getChannel(username);
        }
        if (!existing) {
          existing = this.getChannel(channelId) || this.getChannel(rawId);
        }

        if (existing) {
          existing.telegramChannelId = channelId;
          existing.title = title;
          if (username) existing.username = username;
          this.register(existing);
          this.aliasChannelId(channelId, existing);
          logger.info(`[ChannelRegistry] Matched dialog channel '${title}' -> ID: ${channelId} (@${username || 'private'})`);
        }
      }
    } catch (err) {
      logger.warn(`[ChannelRegistry] Dialog sync notice: ${err.message}`);
    }

    // 2. For all active channels with a username, resolve entity, update ID, and join channel
    const channels = this.getAllChannels();
    for (const ch of channels) {
      if (ch.username) {
        try {
          const entity = await client.getEntity(ch.username);
          if (entity && entity.id) {
            const rawId = entity.id.toString();
            const channelId = `-100${rawId}`;
            ch.telegramChannelId = channelId;
            ch.title = entity.title || ch.title || `@${ch.username}`;
            this.register(ch);
            this.aliasChannelId(channelId, ch);
            logger.info(`[ChannelRegistry] Successfully resolved @${ch.username} -> ID: ${channelId} ('${ch.title}')`);

            // Automatically join channel so Telegram pushes real-time MTProto updates
            try {
              const { Api } = await import('telegram');
              await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
              logger.info(`[ChannelRegistry] Joined Telegram channel: '${ch.title}' (@${ch.username})`);
            } catch (joinErr) {
              logger.debug(`[ChannelRegistry] Join notice for @${ch.username}: ${joinErr.message}`);
            }
          }
        } catch (err) {
          logger.warn(`[ChannelRegistry] Could not resolve entity for @${ch.username}: ${err.message}`);
        }
      }
    }

    const active = this.getActiveChannels();
    logger.info(`[ChannelRegistry] Entity resolution complete. ${active.length} active authorized channels ready.`);
  }
}

export const channelRegistry = new ChannelRegistry();
