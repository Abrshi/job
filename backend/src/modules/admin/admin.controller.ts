import { Request, Response } from 'express';
import { adminDashboardService } from './admin.dashboard.service';
import { adminJobsService } from './admin.jobs.service';
import { adminUsersService } from './admin.users.service';
import { adminSettingsService } from './admin.settings.service';
import { adminReviewService } from './admin.review.service';
import { prisma } from '../../lib/prisma';

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : (id as string);
}

function getAdminUser(req: Request): { id: string; email: string } {
  return {
    id: req.user!.userId,
    email: req.user!.email,
  };
}

export class AdminController {
  // Dashboard
  getStats = async (req: Request, res: Response) => {
    const stats = await adminDashboardService.getStats();
    res.status(200).json({ status: 'success', data: stats });
  };

  getOverview = async (req: Request, res: Response) => {
    const overview = await adminDashboardService.getOverview();
    res.status(200).json({ status: 'success', data: overview });
  };

  // Jobs
  getJobs = async (req: Request, res: Response) => {
    const result = await adminJobsService.getJobs(req.query as any);
    res.status(200).json({ status: 'success', data: result });
  };

  getJobById = async (req: Request, res: Response) => {
    const job = await adminJobsService.getJobById(getParamId(req));
    res.status(200).json({ status: 'success', data: { job } });
  };

  updateJobStatus = async (req: Request, res: Response) => {
    const job = await adminJobsService.updateJobStatus(
      getParamId(req),
      req.body.status,
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: { job } });
  };

  reclassifyJob = async (req: Request, res: Response) => {
    const job = await adminJobsService.triggerReclassification(
      getParamId(req),
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: { job } });
  };

  // Users
  getUsers = async (req: Request, res: Response) => {
    const result = await adminUsersService.getUsers(req.query as any);
    res.status(200).json({ status: 'success', data: result });
  };

  getUserById = async (req: Request, res: Response) => {
    const user = await adminUsersService.getUserById(getParamId(req));
    res.status(200).json({ status: 'success', data: { user } });
  };

  updateUserStatus = async (req: Request, res: Response) => {
    const user = await adminUsersService.updateUserStatus(
      getParamId(req),
      req.body.isActive,
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: { user } });
  };

  updateUserRole = async (req: Request, res: Response) => {
    const user = await adminUsersService.updateUserRole(
      getParamId(req),
      req.body.role,
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: { user } });
  };

  // Settings
  getSettings = async (req: Request, res: Response) => {
    const settings = await adminSettingsService.getSettings();
    res.status(200).json({ status: 'success', data: { settings } });
  };

  updateSettings = async (req: Request, res: Response) => {
    const settings = await adminSettingsService.updateSettings(
      req.body,
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: { settings } });
  };

  // Review & Categories
  getCategories = async (req: Request, res: Response) => {
    const categories = await adminReviewService.getCategories();
    res.status(200).json({ status: 'success', data: { categories } });
  };

  getPendingReviews = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await adminReviewService.getPendingReviews(page, limit);
    res.status(200).json({ status: 'success', data: result });
  };

  acceptClassification = async (req: Request, res: Response) => {
    const result = await adminReviewService.acceptClassification(
      getParamId(req),
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: result });
  };

  overrideClassification = async (req: Request, res: Response) => {
    const result = await adminReviewService.overrideClassification(
      getParamId(req),
      req.body,
      getAdminUser(req),
      req.ip
    );
    res.status(200).json({ status: 'success', data: result });
  };

  // Audit Logs
  getAuditLogs = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminAuditLog.count(),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  };
}

export const adminController = new AdminController();
