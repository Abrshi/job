import { Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { authService, AuthService } from './auth.service';
import { verificationService } from '../verification/verification.service';

const COOKIE_NAME = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(req.body);
    res.cookie(COOKIE_NAME, result.tokens.refreshToken, COOKIE_OPTIONS);
    res.status(201).json({
      status: 'success',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  };

  login = async (req: Request, res: Response) => {
    const result = await this.service.login(req.body);
    res.cookie(COOKIE_NAME, result.tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      data: {
        user: result.user,
        accessToken: result.tokens.accessToken,
      },
    });
  };

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (!token) {
      throw AppError.badRequest('Refresh token required', 'REFRESH_TOKEN_REQUIRED');
    }

    const tokens = await this.service.refresh(token);
    res.cookie(COOKIE_NAME, tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      data: {
        accessToken: tokens.accessToken,
      },
    });
  };

  logout = async (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME] || req.body?.refreshToken;
    if (token) {
      await this.service.logout(token);
    }
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  };

  me = async (req: Request, res: Response) => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required', 'AUTHENTICATION_REQUIRED');
    }
    const user = await this.service.getCurrentUser(req.user.userId);
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  };

  verifyEmail = async (req: Request, res: Response) => {
    const token = (req.query.token as string) || req.body?.token;
    const code = (req.query.code as string) || req.body?.code;
    const email = (req.query.email as string) || req.body?.email;

    const result = await verificationService.verifyEmail({ token, code, email });
    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  };

  resendVerification = async (req: Request, res: Response) => {
    const email =
      req.body?.email ||
      (req.user ? (await this.service.getCurrentUser(req.user.userId)).email : undefined);

    if (!email) {
      throw AppError.badRequest('Email is required', 'EMAIL_REQUIRED');
    }

    const result = await verificationService.resendEmailVerificationByEmail(email);
    res.status(200).json({
      status: 'success',
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
    });
  };
}

export const authController = new AuthController();

