import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error-handler';
import { AuthUserPayload } from '../modules/auth/auth.types';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token is required', 401, 'AUTHENTICATION_REQUIRED'));
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next(new AppError('Authentication token is missing', 401, 'AUTHENTICATION_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError('Access token has expired', 401, 'TOKEN_EXPIRED', undefined, err));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Authentication token is invalid', 401, 'INVALID_TOKEN', undefined, err));
    }
    return next(new AppError('Authentication failed', 401, 'AUTHENTICATION_FAILED', undefined, err));
  }
};
