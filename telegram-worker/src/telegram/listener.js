import { NewMessage } from 'telegram/events/index.js';
import { telegramClientManager } from './client.js';
import { channelRegistry } from './channels.js';
import { messageProcessor } from '../services/messageProcessor.js';
import { logger } from '../utils/logger.js';

export class TelegramListenerService {
  constructor() {
    this.isListening = false;
    this.handler = null;
  }

  /**
   * Register GramJS event handler for new channel messages
   */
  async start() {
    const client = telegramClientManager.getClient();
    if (!client || !telegramClientManager.isConnected) {
      logger.info('[TelegramListener] Waiting for active Telegram connection before registering event handler...');
      return;
    }

    if (this.isListening) return;

    try {
      this.handler = async (event) => {
        try {
          await messageProcessor.processEvent(event);
        } catch (err) {
          logger.error(`[TelegramListener] Error processing message event: ${err.message}`, err);
        }
      };

      // GramJS NewMessage event listener
      client.addEventHandler(this.handler, new NewMessage({}));
      this.isListening = true;

      const activeChannels = channelRegistry.getActiveChannels();
      logger.info(`[TelegramListener] Real-time Telegram listener registered across ${activeChannels.length} authorized channels.`);
    } catch (err) {
      logger.error(`[TelegramListener] Failed to start Telegram listener: ${err.message}`);
    }
  }

  stop() {
    const client = telegramClientManager.getClient();
    if (client && this.handler) {
      try {
        client.removeEventHandler(this.handler, new NewMessage({}));
      } catch (err) {
        logger.debug(`[TelegramListener] Notice during handler removal: ${err.message}`);
      }
    }
    this.isListening = false;
    this.handler = null;
    logger.info('[TelegramListener] Telegram message listener stopped.');
  }

  getStatus() {
    return {
      listening: this.isListening,
    };
  }
}

export const telegramListener = new TelegramListenerService();
