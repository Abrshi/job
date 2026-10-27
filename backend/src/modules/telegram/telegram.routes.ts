import { Router } from 'express';
import { telegramController } from './telegram.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

// Protect all admin Telegram management endpoints
router.use(authenticate, authorize('ADMIN'));

router.get('/stats', telegramController.getStats);
router.post('/test-connection', telegramController.testConnection);
router.post('/publish/:jobId', telegramController.publishJob);
router.post('/backfill', telegramController.triggerBackfill);
router.post('/batch', telegramController.triggerBatch);

export default router;
