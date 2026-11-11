import { Router } from 'express';
import { telegramController } from './telegram.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  RegisterTelegramChannelSchema,
  UpdateTelegramChannelSchema,
  ListTelegramChannelsQuerySchema,
  ListTelegramMessagesQuerySchema,
  ToggleWorkerSchema,
} from './telegram-channels.validation';

const router = Router();

// Protect all admin Telegram management endpoints
router.use(authenticate, authorize('ADMIN'));

// =========================================================================
// Channel Governance & Registration
// =========================================================================
router.get('/channels', validate(ListTelegramChannelsQuerySchema), telegramController.listChannels);
router.post('/channels/sync', telegramController.syncChannels);
router.post('/channels', validate(RegisterTelegramChannelSchema), telegramController.registerChannel);
router.get('/channels/:id', telegramController.getChannel);
router.patch('/channels/:id', validate(UpdateTelegramChannelSchema), telegramController.updateChannel);
router.post('/channels/:id/verify', telegramController.verifyChannel);
router.post('/channels/:id/activate', telegramController.activateChannel);
router.post('/channels/:id/pause', telegramController.pauseChannel);
router.post('/channels/:id/deactivate', telegramController.deactivateChannel);
router.delete('/channels/:id', telegramController.deleteChannel);

// =========================================================================
// Ingested Messages Monitoring
// =========================================================================
router.get('/messages', validate(ListTelegramMessagesQuerySchema), telegramController.listMessages);

// =========================================================================
// Global Worker Controls & Telemetry
// =========================================================================
router.get('/status', telegramController.getGlobalStatus);
router.post('/worker/toggle', validate(ToggleWorkerSchema), telegramController.toggleWorker);

// =========================================================================
// Delivery Failure Monitoring & Retry
// =========================================================================
router.get('/deliveries', telegramController.listDeliveries);
router.post('/deliveries/:id/retry', telegramController.retryDelivery);

// =========================================================================
// Outbound Publishing Bot Endpoints
// =========================================================================
router.get('/stats', telegramController.getStats);
router.post('/test-connection', telegramController.testConnection);
router.post('/publish/:jobId', telegramController.publishJob);
router.post('/backfill', telegramController.triggerBackfill);
router.post('/batch', telegramController.triggerBatch);

export default router;
