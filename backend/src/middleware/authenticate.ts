import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error-handler';
import { AuthUserPayload } from '../modules/auth/auth.types';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token missing or invalid', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    return next(new AppError('Invalid or expired authentication token', 401));
  }
};

