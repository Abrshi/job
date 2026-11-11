import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { errors } from 'telegram';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class GramJsClientManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.sessionString = this.loadSession();
    this.onConnectCallbacks = [];
  }

  onConnected(callback) {
    if (typeof callback === 'function') {
      this.onConnectCallbacks.push(callback);
    }
  }

  /**
   * Load session from environment string or local session file
   */
  loadSession() {
    if (env.TELEGRAM_SESSION && env.TELEGRAM_SESSION.length > 10) {
      return env.TELEGRAM_SESSION;
    }

    if (fs.existsSync(env.SESSION_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(env.SESSION_FILE_PATH, 'utf8').trim();
        if (fileContent.length > 10) {
          logger.info('[TelegramClient] Loaded existing persistent Telegram session from file.');
          return fileContent;
        }
      } catch (err) {
        logger.warn(`[TelegramClient] Could not read session file: ${err.message}`);
      }
    }

    return '';
  }

  /**
   * Persist current session string to file
   */
  saveSession(sessionStr) {
    if (!sessionStr) return;
    try {
      const dir = path.dirname(env.SESSION_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(env.SESSION_FILE_PATH, sessionStr, { mode: 0o600 });
      logger.info('[TelegramClient] Saved persistent Telegram session to storage.');
    } catch (err) {
      logger.error(`[TelegramClient] Failed to save session to disk: ${err.message}`);
    }
  }

  /**
   * Initialize GramJS TelegramClient
   */
  async init() {
    if (!env.API_ID || !env.API_HASH) {
      logger.warn('[TelegramClient] API_ID or API_HASH is missing. Telegram listener will run in standby mode.');
      return null;
    }

    const session = new StringSession(this.sessionString || '');

    this.client = new TelegramClient(session, env.API_ID, env.API_HASH, {
      connectionRetries: 5,
      autoReconnect: true,
      retryDelay: 2000,
      useWSS: false,
    });

    return this.client;
  }

  /**
   * Connect and authorize client
   */
  async connect() {
    if (this.isConnecting || this.isConnected) return;
    if (!this.client) {
      await this.init();
      if (!this.client) return;
    }

    this.isConnecting = true;
    logger.info('[TelegramClient] Connecting to Telegram MTProto network...');

    try {
      await this.client.connect();

      // Check if authorized
      const isAuthorized = await this.client.checkAuthorization();
      if (isAuthorized) {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('[TelegramClient] Successfully authorized with persistent Telegram session!');

        // Save session if newly generated or updated
        const currentSession = this.client.session.save();
        if (currentSession && currentSession !== this.sessionString) {
          this.sessionString = currentSession;
          this.saveSession(currentSession);
        }

        // Notify connected hooks
        for (const cb of this.onConnectCallbacks) {
          try {
            await cb(this.client);
          } catch (cbErr) {
            logger.warn(`[TelegramClient] onConnected hook error: ${cbErr.message}`);
          }
        }
      } else {
        logger.warn('[TelegramClient] Session is not currently authorized. Manual login or valid TELEGRAM_SESSION is required.');
      }
    } catch (err) {
      this.isConnected = false;

      // Handle Telegram FloodWaitError
      if (err instanceof errors.FloodWaitError || (err.message && err.message.includes('FLOOD_WAIT'))) {
        const seconds = err.seconds || 30;
        logger.warn(`[TelegramClient] Telegram FloodWait encountered. Backing off for ${seconds} seconds.`);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      } else {
        logger.error(`[TelegramClient] Telegram connection error: ${err.message}`);
      }

      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts, 6)), 60000);

    logger.info(`[TelegramClient] Reconnection attempt #${this.reconnectAttempts} scheduled in ${Math.round(backoffMs / 1000)}s.`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, backoffMs);
  }

  /**
   * Graceful disconnect
   */
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client && this.isConnected) {
      try {
        logger.info('[TelegramClient] Disconnecting GramJS Telegram client...');
        await this.client.disconnect();
      } catch (err) {
        logger.warn(`[TelegramClient] Notice during client disconnect: ${err.message}`);
      }
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  getClient() {
    return this.client;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      hasSession: Boolean(this.sessionString && this.sessionString.length > 10),
      hasCredentials: Boolean(env.API_ID && env.API_HASH),
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const telegramClientManager = new GramJsClientManager();
