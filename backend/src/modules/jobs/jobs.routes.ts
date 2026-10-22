import { Router } from 'express';
import {
  getJobs,
  getJobById,
  getCategories,
  saveJob,
  unsaveJob,
  getSavedJobs,
  applyForJob,
  getUserApplications,
} from './jobs.controller';
import { validate } from '../../middleware/validate';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import {
  JobQuerySchema,
  JobIdParamSchema,
  ApplyJobSchema,
  PaginationQuerySchema,
} from './jobs.validation';

const router = Router();

// Public taxonomy categories
router.get('/categories', getCategories);

// Authenticated Seeker Saved Jobs
router.get('/saved', authenticate, validate(PaginationQuerySchema), getSavedJobs);

// Authenticated Seeker Application History
router.get('/applications', authenticate, validate(PaginationQuerySchema), getUserApplications);

// Public Job Search & Discovery
router.get('/', optionalAuthenticate, validate(JobQuerySchema), getJobs);

// Public Job Details
router.get('/:id', optionalAuthenticate, validate(JobIdParamSchema), getJobById);

// Authenticated Save & Unsave Job
router.post('/:id/save', authenticate, validate(JobIdParamSchema), saveJob);
router.delete('/:id/save', authenticate, validate(JobIdParamSchema), unsaveJob);

// Authenticated Internal Application Submission
router.post('/:id/apply', authenticate, validate(ApplyJobSchema), applyForJob);

export default router;

