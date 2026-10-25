import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  CreateSavedSearchSchema,
  UpdateSavedSearchSchema,
  SavedSearchIdParamSchema,
  RunSavedSearchQuerySchema,
  NotificationQuerySchema,
  NotificationIdParamSchema,
} from './saved-searches.validation';
import {
  createSavedSearch,
  getSavedSearches,
  getSavedSearchById,
  updateSavedSearch,
  toggleSavedSearchAlert,
  deleteSavedSearch,
  runSavedSearch,
  triggerAlertEvaluation,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from './alerts.controller';

// ============================================================================
// Saved Searches Routes
// ============================================================================
export const savedSearchesRoutes = Router();

savedSearchesRoutes.use(authenticate);

savedSearchesRoutes.get('/', getSavedSearches);
savedSearchesRoutes.post('/', validate(CreateSavedSearchSchema), createSavedSearch);
savedSearchesRoutes.post('/trigger-alerts', triggerAlertEvaluation);
savedSearchesRoutes.get('/:id', validate(SavedSearchIdParamSchema), getSavedSearchById);
savedSearchesRoutes.put('/:id', validate(UpdateSavedSearchSchema), updateSavedSearch);
savedSearchesRoutes.patch('/:id/toggle-alert', validate(SavedSearchIdParamSchema), toggleSavedSearchAlert);
savedSearchesRoutes.delete('/:id', validate(SavedSearchIdParamSchema), deleteSavedSearch);
savedSearchesRoutes.get('/:id/run', validate(RunSavedSearchQuerySchema), runSavedSearch);

// ============================================================================
// Notifications Routes
// ============================================================================
export const notificationsRoutes = Router();

notificationsRoutes.use(authenticate);

notificationsRoutes.get('/', validate(NotificationQuerySchema), getNotifications);
notificationsRoutes.get('/unread-count', getUnreadCount);
notificationsRoutes.patch('/read-all', markAllNotificationsRead);
notificationsRoutes.delete('/', clearReadNotifications);
notificationsRoutes.patch('/:id/read', validate(NotificationIdParamSchema), markNotificationRead);
notificationsRoutes.delete('/:id', validate(NotificationIdParamSchema), deleteNotification);

