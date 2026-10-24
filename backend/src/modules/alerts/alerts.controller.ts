import { Request, Response, NextFunction } from 'express';
import { savedSearchesService } from './saved-searches.service';
import { notificationsService } from './notifications.service';

// ============================================================================
// Saved Searches Handlers
// ============================================================================

export async function createSavedSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await savedSearchesService.create(userId, req.body);
    res.status(201).json({
      status: 'success',
      data: { savedSearch: result },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSavedSearches(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const savedSearches = await savedSearchesService.findAll(userId);
    res.status(200).json({
      status: 'success',
      data: { savedSearches },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSavedSearchById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const savedSearch = await savedSearchesService.findById(userId, id);
    res.status(200).json({
      status: 'success',
      data: { savedSearch },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSavedSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const updated = await savedSearchesService.update(userId, id, req.body);
    res.status(200).json({
      status: 'success',
      data: { savedSearch: updated },
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleSavedSearchAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const updated = await savedSearchesService.toggleAlert(userId, id);
    res.status(200).json({
      status: 'success',
      data: { savedSearch: updated },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteSavedSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const result = await savedSearchesService.delete(userId, id);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function runSavedSearch(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const result = await savedSearchesService.runSavedSearch(userId, id, { page, limit });
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function triggerAlertEvaluation(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await notificationsService.processPendingJobAlerts();
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// Notifications Handlers
// ============================================================================

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationsService.getUserNotifications(userId, { page, limit, unreadOnly });
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const unreadCount = await notificationsService.getUnreadCount(userId);
    res.status(200).json({
      status: 'success',
      data: { unreadCount },
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const updated = await notificationsService.markAsRead(userId, id);
    res.status(200).json({
      status: 'success',
      data: { notification: updated },
    });
  } catch (err) {
    next(err);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await notificationsService.markAllAsRead(userId);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const result = await notificationsService.deleteNotification(userId, id);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function clearReadNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const result = await notificationsService.clearReadNotifications(userId);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
