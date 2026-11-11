import express from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { telegramClientManager } from '../telegram/client.js';
import { channelRegistry } from '../telegram/channels.js';
import { telegramListener } from '../telegram/listener.js';
import { outbox } from '../storage/outbox.js';
import { webhookDelivery } from '../delivery/webhook.js';
import { catchUpRecentMessages } from '../telegram/backfill.js';
import { logger } from '../utils/logger.js';

function authenticateInternal(req, res, next) {
  const auth = req.headers.authorization;
  const secret = env.INTERNAL_API_SECRET;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return next();
    }
  }
  return res.status(401).json({ status: 'error', message: 'Unauthorized internal request' });
}

export function createHealthServer() {
  const app = express();
  app.use(express.json());

  const startTime = Date.now();

  /**
   * Basic liveness probe
   * GET /health
   */
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'telegram-worker',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Comprehensive operational status
   * GET /status
   */
  app.get('/status', (req, res) => {
    const clientStatus = telegramClientManager.getStatus();
    const listenerStatus = telegramListener.getStatus();
    const outboxStats = outbox.getStats();
    const activeChannels = channelRegistry.getActiveChannels();
    const allChannels = channelRegistry.getAllChannels();

    // Find the channel with the most recent event
    let latestEventTime = null;
    for (const ch of allChannels) {
      if (ch.lastEventAt) {
        if (!latestEventTime || new Date(ch.lastEventAt) > new Date(latestEventTime)) {
          latestEventTime = ch.lastEventAt;
        }
      }
    }

    res.status(200).json({
      service: 'telegram-worker',
      status: clientStatus.connected ? 'running' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      telegram: {
        connected: clientStatus.connected,
        listening: listenerStatus.listening,
        hasSession: clientStatus.hasSession,
        hasCredentials: clientStatus.hasCredentials,
        reconnectAttempts: clientStatus.reconnectAttempts,
      },
      channels: {
        totalConfigured: allChannels.length,
        activeAuthorized: activeChannels.length,
        lastEventReceivedAt: latestEventTime,
        list: activeChannels.map((c) => ({
          telegramChannelId: c.telegramChannelId,
          username: c.username,
          title: c.title,
          lastMessageId: c.lastMessageId,
          lastEventAt: c.lastEventAt,
        })),
      },
      outbox: {
        total: outboxStats.total,
        pending: outboxStats.pending,
        processing: outboxStats.processing,
        delivered: outboxStats.delivered,
        failed: outboxStats.failed,
      },
      backendTarget: env.BACKEND_URL,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Internal Admin Management Endpoints
   */
  // Force channel synchronization from backend
  app.post('/api/v1/worker/sync', authenticateInternal, async (req, res) => {
    try {
      await channelRegistry.syncChannels();
      const client = telegramClientManager.getClient();
      if (client && telegramClientManager.isConnected) {
        await channelRegistry.resolveChannelEntities(client);
        await catchUpRecentMessages(client, 15);
      }
      const active = channelRegistry.getActiveChannels();
      logger.info(`[WorkerServer] Admin triggered dynamic channel sync: ${active.length} active channels.`);
      res.status(200).json({
        success: true,
        message: 'Channel configuration synchronized',
        activeChannelsCount: active.length,
      });
    } catch (err) {
      logger.error(`[WorkerServer] Dynamic channel sync failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Trigger on-demand message catch-up / backfill across active channels
  app.post('/api/v1/worker/backfill', authenticateInternal, async (req, res) => {
    try {
      const limit = Number(req.body.limit) || 15;
      const client = telegramClientManager.getClient();
      if (!client || !telegramClientManager.isConnected) {
        return res.status(503).json({ success: false, message: 'Telegram client is not currently connected to Telegram network.' });
      }

      const enqueued = await catchUpRecentMessages(client, limit);
      res.status(200).json({
        success: true,
        message: `Backfill scan completed. Enqueued ${enqueued} messages.`,
        enqueuedCount: enqueued,
      });
    } catch (err) {
      logger.error(`[WorkerServer] Backfill failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Toggle listener pause/resume without restarting process
  app.post('/api/v1/worker/toggle', authenticateInternal, async (req, res) => {
    try {
      const shouldListen = req.body.active !== false;
      if (shouldListen) {
        await telegramListener.start();
      } else {
        telegramListener.stop();
      }
      logger.info(`[WorkerServer] Admin toggled listener state. Now listening: ${telegramListener.isListening}`);
      res.status(200).json({
        success: true,
        listening: telegramListener.isListening,
      });
    } catch (err) {
      logger.error(`[WorkerServer] Failed to toggle listener: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Query outbox events for admin monitoring
  app.get('/api/v1/worker/outbox', authenticateInternal, (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const status = req.query.status || null;
      const events = outbox.getRecentEvents(limit, status);
      const stats = outbox.getStats();

      res.status(200).json({
        success: true,
        stats,
        events,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Retry a failed outbox event
  app.post('/api/v1/worker/outbox/:id/retry', authenticateInternal, async (req, res) => {
    try {
      const eventId = req.params.id;
      const updated = outbox.retryEvent(eventId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Event not found in outbox' });
      }

      // Trigger immediate background delivery flush
      setImmediate(() => webhookDelivery.flushOutbox());

      res.status(200).json({
        success: true,
        message: `Event ${eventId} queued for retry`,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify Telegram channel accessibility
  app.post('/api/v1/worker/verify-channel', authenticateInternal, async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ success: false, message: 'identifier is required' });
      }

      const client = telegramClientManager.getClient();
      if (!client || !telegramClientManager.isConnected) {
        return res.status(503).json({
          success: false,
          accessible: false,
          message: 'Telegram client is not currently connected to Telegram network.',
        });
      }

      try {
        const entity = await client.getEntity(identifier);
        res.status(200).json({
          success: true,
          accessible: true,
          channel: {
            id: entity.id ? entity.id.toString() : null,
            title: entity.title || entity.username || identifier,
            username: entity.username || null,
            isBroadcast: Boolean(entity.broadcast),
            isMegagroup: Boolean(entity.megagroup),
          },
        });
      } catch (entityErr) {
        res.status(200).json({
          success: false,
          accessible: false,
          message: entityErr.message || 'Channel could not be resolved or is private.',
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return app;
}

export function startHealthServer(port = env.PORT) {
  const app = createHealthServer();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`[HealthServer] Health & operational server listening on port ${port}`);
      logger.info(`[HealthServer] Liveness check: http://localhost:${port}/health`);
      logger.info(`[HealthServer] Operational status: http://localhost:${port}/status`);
      resolve(server);
    });
  });
}
