import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  updateJobStatusSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  updateSiteSettingsSchema,
  overrideClassificationSchema,
  jobQuerySchema,
  userQuerySchema,
} from './admin.validation';

const router = Router();

// Enforce authentication & ADMIN role across all admin routes
router.use(authenticate);
router.use(authorize('ADMIN'));

// 1. Dashboard
router.get('/dashboard/stats', adminController.getStats);
router.get('/dashboard/overview', adminController.getOverview);

// 2. Jobs Management
router.get('/jobs', validate(jobQuerySchema), adminController.getJobs);
router.get('/jobs/:id', adminController.getJobById);
router.patch('/jobs/:id/status', validate(updateJobStatusSchema), adminController.updateJobStatus);
router.post('/jobs/:id/classify', adminController.reclassifyJob);

// 3. User Management
router.get('/users', validate(userQuerySchema), adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.patch('/users/:id/role', validate(updateUserRoleSchema), adminController.updateUserRole);

// 4. Site Settings
router.get('/settings', adminController.getSettings);
router.patch('/settings', validate(updateSiteSettingsSchema), adminController.updateSettings);

// 5. Categories & Classification Review
router.get('/categories', adminController.getCategories);
router.get('/classifications/review', adminController.getPendingReviews);
router.post('/classifications/:id/accept', adminController.acceptClassification);
router.post('/classifications/:id/override', validate(overrideClassificationSchema), adminController.overrideClassification);

// 6. Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

export default router;
