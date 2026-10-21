import { Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error-handler';
import { authService, AuthService } from './auth.service';

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
}

export const authController = new AuthController();

