import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import {
  uploadDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
  retryExtraction,
} from './documents.controller';
import { env } from '../../config/env';

const router = Router();

// Configure in-memory upload handler
const maxSizeBytes = (env.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxSizeBytes,
    files: 1,
  },
});

// All document routes require authentication
router.use(authenticate);

// List user documents
router.get('/', listDocuments);

// Upload document (PDF / DOCX)
router.post('/upload', upload.single('file'), uploadDocument);

// Get single document metadata & extraction
router.get('/:id', getDocument);

// Download document
router.get('/:id/download', downloadDocument);

// Delete document
router.delete('/:id', deleteDocument);

// Retry extraction
router.post('/:id/retry', retryExtraction);

export default router;

