import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { outbox } from './storage/outbox.js';
import { webhookDelivery } from './delivery/webhook.js';
import { channelRegistry } from './telegram/channels.js';
import { telegramClientManager } from './telegram/client.js';
import { telegramListener } from './telegram/listener.js';
import { catchUpRecentMessages } from './telegram/backfill.js';
import { startHealthServer } from './health/server.js';

let isShuttingDown = false;
let healthServer = null;
let syncTimer = null;

async function bootstrap() {
  logger.info('========================================================');
  logger.info('Starting Telegram Job Ingestion Worker Server...');
  logger.info(`Mode: ${env.NODE_ENV} | Backend: ${env.BACKEND_URL}`);
  logger.info('========================================================');

  // 1. Initialize persistent outbox
  const outboxStats = outbox.getStats();
  logger.info(`[Bootstrap] Persistent Outbox initialized (${outboxStats.pending} pending, ${outboxStats.failed} failed).`);

  // 2. Synchronize authorized channels
  await channelRegistry.syncChannels();

  // 3. Start outbox webhook delivery worker
  webhookDelivery.start();

  // 4. Start Health & Status HTTP server
  healthServer = await startHealthServer(env.PORT);

  // 5. Connect GramJS Telegram Client
  if (env.API_ID && env.API_HASH) {
    logger.info('[Bootstrap] Initializing GramJS Telegram client with persistent session...');

    // Register post-connect handler to resolve entities, backfill, and listen
    telegramClientManager.onConnected(async (client) => {
      try {
        await channelRegistry.resolveChannelEntities(client);
        await catchUpRecentMessages(client, 15);
        await telegramListener.start();
      } catch (err) {
        logger.error(`[Bootstrap] Error during post-connection initialization: ${err.message}`, err);
      }
    });

    await telegramClientManager.connect();
  } else {
    logger.warn('[Bootstrap] Telegram credentials (API_ID, API_HASH) are not set. Running in Standby Webhook & Health mode.');
    logger.warn('[Bootstrap] Configure API_ID, API_HASH, and TELEGRAM_SESSION in telegram-worker/.env to activate live Telegram listener.');
  }

  logger.info('[Bootstrap] Telegram ingestion worker is up and running.');

  // Periodically re-sync channels and catch up recent messages every 30 seconds
  syncTimer = setInterval(async () => {
    try {
      await channelRegistry.syncChannels();
      const client = telegramClientManager.getClient();
      if (client && telegramClientManager.isConnected) {
        await channelRegistry.resolveChannelEntities(client);
        await catchUpRecentMessages(client, 10);
      }
    } catch (err) {
      logger.warn(`[Bootstrap] Periodic channel sync notice: ${err.message}`);
    }
  }, 30000);
}

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  logger.info(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop message listener
  try {
    telegramListener.stop();
  } catch (err) {
    logger.debug(`[Shutdown] Error stopping listener: ${err.message}`);
  }

  // 2. Disconnect GramJS client
  try {
    await telegramClientManager.disconnect();
  } catch (err) {
    logger.debug(`[Shutdown] Error disconnecting client: ${err.message}`);
  }

  // 3. Stop webhook delivery worker
  try {
    webhookDelivery.stop();
  } catch (err) {
    logger.debug(`[Shutdown] Error stopping webhook delivery: ${err.message}`);
  }

  // 4. Close Health Server
  if (healthServer) {
    await new Promise((resolve) => {
      healthServer.close(() => {
        logger.info('[Shutdown] Health server closed.');
        resolve();
      });
    });
  }

  // 5. Close outbox database
  try {
    outbox.close();
    logger.info('[Shutdown] Outbox database closed cleanly.');
  } catch (err) {
    logger.debug(`[Shutdown] Error closing outbox: ${err.message}`);
  }

  logger.info('[Shutdown] Graceful shutdown completed. Exiting process.');
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error(`[Fatal] Uncaught Exception: ${err.message}`, err);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`[Fatal] Unhandled Rejection: ${reason}`);
});

bootstrap().catch((err) => {
  logger.error(`[Fatal] Worker bootstrap failed: ${err.message}`, err);
  process.exit(1);
});
