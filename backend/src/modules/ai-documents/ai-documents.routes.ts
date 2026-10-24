import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { aiDocumentsController } from './ai-documents.controller';

const router = Router();

// Anti-abuse rate limiter for generation requests (30 per 15 minutes per user/IP)
const generationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many document generation requests. Please try again after 15 minutes.',
  },
});

// All document routes require authenticated user
router.use(authenticate);

router.post('/generate', generationRateLimiter, (req, res, next) =>
  aiDocumentsController.generateDraft(req, res, next)
);

router.get('/', (req, res, next) =>
  aiDocumentsController.listDocuments(req, res, next)
);

router.get('/:id', (req, res, next) =>
  aiDocumentsController.getDocumentById(req, res, next)
);

router.post('/:id/versions', (req, res, next) =>
  aiDocumentsController.saveVersion(req, res, next)
);

router.get('/:id/versions/:versionNumber/export', (req, res, next) =>
  aiDocumentsController.exportDocument(req, res, next)
);

router.post('/:id/attach-application', (req, res, next) =>
  aiDocumentsController.attachToApplication(req, res, next)
);

router.delete('/:id', (req, res, next) =>
  aiDocumentsController.deleteDocument(req, res, next)
);

export default router;
