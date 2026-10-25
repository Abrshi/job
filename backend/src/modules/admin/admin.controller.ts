import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { adminDashboardService } from './admin.dashboard.service';
import { adminJobsService } from './admin.jobs.service';
import { adminUsersService } from './admin.users.service';
import { adminSettingsService } from './admin.settings.service';
import { adminReviewService } from './admin.review.service';
import { authService } from '../auth/auth.service';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { prisma } from '../../lib/prisma';

const ADMIN_COOKIE_NAME = 'adminRefreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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
  // Dedicated Admin Authentication & Session Handlers
  login = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw AppError.badRequest('Email and password are required', 'CREDENTIALS_REQUIRED');
    }

    const result = await authService.login({ email, password });

    if (result.user.role !== 'ADMIN') {
      throw AppError.forbidden(
        'Access denied. Administrative privileges are required to access this console.',
        'ADMIN_ACCESS_DENIED'
      );
    }

    res.cookie(ADMIN_COOKIE_NAME, result.tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  };

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.[ADMIN_COOKIE_NAME] || req.body?.refreshToken;
    if (!token) {
      throw AppError.badRequest('Admin refresh token required', 'REFRESH_TOKEN_REQUIRED');
    }

    const tokens = await authService.refresh(token);
    const decoded = jwt.decode(tokens.accessToken) as any;
    if (decoded?.role !== 'ADMIN') {
      throw AppError.forbidden('Administrative privileges required', 'ADMIN_ACCESS_DENIED');
    }

    res.cookie(ADMIN_COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      data: {
        accessToken: tokens.accessToken,
      },
    });
  };

  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.[ADMIN_COOKIE_NAME] || req.body?.refreshToken;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie(ADMIN_COOKIE_NAME, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      message: 'Admin session terminated successfully',
    });
  };

  verify = async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      data: {
        user: req.user,
      },
    });
  };

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
