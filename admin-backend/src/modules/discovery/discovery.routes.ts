import { Router } from 'express';
import { discoveryController } from './discovery.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const router = Router();

// Protect all admin Discovery endpoints
router.use(authenticate, authorize('ADMIN'));

// Telemetry & Gaps
router.get('/stats', discoveryController.getStats);
router.get('/gaps', discoveryController.getCoverageGaps);
router.get('/compliance', discoveryController.getComplianceReport);

// Search Plan & Registry
router.post('/plan', discoveryController.generatePlan);
router.get('/searches', discoveryController.getSearches);
router.patch('/searches/:id/status', discoveryController.updateStatus);
router.post('/searches/:id/run', discoveryController.runSearch);
router.delete('/searches/:id', discoveryController.deleteSearch);
router.post('/adaptive-optimize', discoveryController.runAdaptiveOptimization);

// Discovery References (LinkedIn & URL Intake)
router.get('/references', discoveryController.getReferences);
router.post('/references', discoveryController.captureReference);
router.post('/references/:id/review', discoveryController.reviewReference);

// LinkedIn Companies Directory (Admin Only)
router.get('/companies', discoveryController.getCompanies);
router.post('/companies', discoveryController.upsertCompany);
router.patch('/companies/:id/status', discoveryController.updateCompanyStatus);
router.delete('/companies/:id', discoveryController.deleteCompany);

export default router;

