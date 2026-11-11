import { Router } from 'express';
import { telegramIngestionController } from './telegram-ingestion.controller';
import { authenticateTelegramWorker } from './telegram-auth.middleware';
import { validate } from '../../middleware/validate';
import {
  IngestTelegramMessageSchema,
  RegisterTelegramChannelSchema,
} from './telegram-ingestion.validation';

const router = Router();

// Protect all internal Telegram worker endpoints
router.use(authenticateTelegramWorker);

router.post(
  '/messages',
  validate(IngestTelegramMessageSchema),
  telegramIngestionController.ingestMessage
);

router.get('/channels', telegramIngestionController.getAuthorizedChannels);

router.post(
  '/channels',
  validate(RegisterTelegramChannelSchema),
  telegramIngestionController.registerChannel
);

router.delete('/channels/:id', telegramIngestionController.deleteChannel);

router.get('/status', telegramIngestionController.getStatus);

export default router;
