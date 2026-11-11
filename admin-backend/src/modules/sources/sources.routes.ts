import { Router } from 'express';
import { sourcesController } from './sources.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createSourceSchema,
  updateSourceSchema,
  listSourcesSchema,
} from './sources.validation';

const router = Router();

// Protect all admin source endpoints with authentication & ADMIN role authorization
router.use(authenticate, authorize('ADMIN'));

router.get('/', validate(listSourcesSchema), sourcesController.listSources);
router.post('/', validate(createSourceSchema), sourcesController.createSource);

// Global runs history endpoint
router.get('/runs', sourcesController.getAllRuns);

// Individual source endpoints
router.get('/:id', sourcesController.getSource);
router.patch('/:id', validate(updateSourceSchema), sourcesController.updateSource);
router.delete('/:id', sourcesController.deleteSource);
router.post('/:id/run', sourcesController.triggerRun);
router.get('/:id/runs', sourcesController.getSourceRuns);
router.get('/:id/stats', sourcesController.getSourceStats);

export default router;
