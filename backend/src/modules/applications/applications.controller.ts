import { Request, Response, NextFunction } from 'express';
import { applicationsService } from './applications.service';

export const listApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationsService.listApplications(
      req.user!.userId,
      req.query as any
    );
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getApplicationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await applicationsService.getApplicationStats(req.user!.userId);
    res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getApplicationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const application = await applicationsService.getApplicationById(
      req.user!.userId,
      applicationId
    );
    res.status(200).json({
      status: 'success',
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

export const createApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await applicationsService.createApplication(
      req.user!.userId,
      req.body
    );
    res.status(201).json({
      status: 'success',
      message: application.status === 'DRAFT' ? 'Application draft saved' : 'Application submitted successfully',
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

export const updateApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await applicationsService.updateApplication(
      req.user!.userId,
      applicationId,
      req.body
    );
    res.status(200).json({
      status: 'success',
      message: 'Application updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await applicationsService.updateStatus(
      req.user!.userId,
      applicationId,
      req.body.status,
      req.body.reason
    );
    res.status(200).json({
      status: 'success',
      message: `Application status updated to ${updated.status}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const withdrawApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await applicationsService.withdrawApplication(
      req.user!.userId,
      applicationId,
      req.body?.reason
    );
    res.status(200).json({
      status: 'success',
      message: 'Application withdrawn successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteDraft = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await applicationsService.deleteDraft(req.user!.userId, applicationId);
    res.status(200).json({
      status: 'success',
      message: 'Draft application deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const scheduleInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const interview = await applicationsService.scheduleInterview(
      req.user!.userId,
      applicationId,
      req.body
    );
    res.status(201).json({
      status: 'success',
      message: 'Interview round scheduled successfully',
      data: interview,
    });
  } catch (err) {
    next(err);
  }
};

export const updateInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const interviewId = Array.isArray(req.params.interviewId) ? req.params.interviewId[0] : req.params.interviewId;
    const interview = await applicationsService.updateInterview(
      req.user!.userId,
      applicationId,
      interviewId,
      req.body
    );
    res.status(200).json({
      status: 'success',
      message: 'Interview details updated successfully',
      data: interview,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const interviewId = Array.isArray(req.params.interviewId) ? req.params.interviewId[0] : req.params.interviewId;
    await applicationsService.deleteInterview(
      req.user!.userId,
      applicationId,
      interviewId
    );
    res.status(200).json({
      status: 'success',
      message: 'Interview round deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const createReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reminder = await applicationsService.createReminder(
      req.user!.userId,
      applicationId,
      req.body
    );
    res.status(201).json({
      status: 'success',
      message: 'Reminder created successfully',
      data: reminder,
    });
  } catch (err) {
    next(err);
  }
};

export const updateReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reminderId = Array.isArray(req.params.reminderId) ? req.params.reminderId[0] : req.params.reminderId;
    const reminder = await applicationsService.updateReminder(
      req.user!.userId,
      applicationId,
      reminderId,
      req.body
    );
    res.status(200).json({
      status: 'success',
      message: 'Reminder updated successfully',
      data: reminder,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteReminder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reminderId = Array.isArray(req.params.reminderId) ? req.params.reminderId[0] : req.params.reminderId;
    await applicationsService.deleteReminder(
      req.user!.userId,
      applicationId,
      reminderId
    );
    res.status(200).json({
      status: 'success',
      message: 'Reminder deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

