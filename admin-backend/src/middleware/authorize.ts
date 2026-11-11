import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('User is not authenticated', 'AUTHENTICATION_REQUIRED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action', 'FORBIDDEN'));
    }

    next();
  };
};
