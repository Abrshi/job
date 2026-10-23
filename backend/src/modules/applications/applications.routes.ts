import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  ListApplicationsSchema,
  ApplicationIdParamSchema,
  CreateApplicationSchema,
  UpdateApplicationSchema,
  UpdateStatusSchema,
  WithdrawApplicationSchema,
  CreateInterviewSchema,
  UpdateInterviewSchema,
  InterviewParamsSchema,
  CreateReminderSchema,
  UpdateReminderSchema,
  ReminderParamsSchema,
} from './applications.validation';
import {
  listApplications,
  getApplicationStats,
  getApplicationById,
  createApplication,
  updateApplication,
  updateStatus,
  withdrawApplication,
  deleteDraft,
  scheduleInterview,
  updateInterview,
  deleteInterview,
  createReminder,
  updateReminder,
  deleteReminder,
} from './applications.controller';

const router = Router();

// All application routes require authentication
router.use(authenticate);

// Aggregates & List
router.get('/stats', getApplicationStats);
router.get('/', validate(ListApplicationsSchema), listApplications);
router.post('/', validate(CreateApplicationSchema), createApplication);

// Single Application Details, Lifecycle, and Draft Delete
router.get('/:id', validate(ApplicationIdParamSchema), getApplicationById);
router.patch('/:id', validate(UpdateApplicationSchema), updateApplication);
router.post('/:id/status', validate(UpdateStatusSchema), updateStatus);
router.post('/:id/withdraw', validate(WithdrawApplicationSchema), withdrawApplication);
router.delete('/:id', validate(ApplicationIdParamSchema), deleteDraft);

// Multi-Round Interviews
router.post('/:id/interviews', validate(CreateInterviewSchema), scheduleInterview);
router.patch('/:id/interviews/:interviewId', validate(UpdateInterviewSchema), updateInterview);
router.delete('/:id/interviews/:interviewId', validate(InterviewParamsSchema), deleteInterview);

// Reminders
router.post('/:id/reminders', validate(CreateReminderSchema), createReminder);
router.patch('/:id/reminders/:reminderId', validate(UpdateReminderSchema), updateReminder);
router.delete('/:id/reminders/:reminderId', validate(ReminderParamsSchema), deleteReminder);

export default router;
