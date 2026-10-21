import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '../lib/logger';

export interface ErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetail[];
  public readonly cause?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code?: string,
    details?: ErrorDetail[],
    cause?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || defaultCodeForStatus(statusCode);
    this.details = details;
    this.cause = cause;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: ErrorDetail[], cause?: unknown): AppError {
    return new AppError(message, 400, code, details, cause);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', cause?: unknown): AppError {
    return new AppError(message, 401, code, undefined, cause);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN', cause?: unknown): AppError {
    return new AppError(message, 403, code, undefined, cause);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', cause?: unknown): AppError {
    return new AppError(message, 404, code, undefined, cause);
  }

  static conflict(message: string, code = 'CONFLICT', details?: ErrorDetail[], cause?: unknown): AppError {
    return new AppError(message, 409, code, details, cause);
  }

  static validation(message = 'Validation failed', details?: ErrorDetail[], cause?: unknown): AppError {
    return new AppError(message, 400, 'VALIDATION_ERROR', details, cause);
  }

  static internal(message = 'Internal server error', cause?: unknown): AppError {
    return new AppError(message, 500, 'INTERNAL_SERVER_ERROR', undefined, cause, false);
  }
}

function defaultCodeForStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 504:
      return 'GATEWAY_TIMEOUT';
    default:
      return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR';
  }
}

export function mapPrismaError(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const metaTarget = err.meta?.target;
        let targetFields: string[] = [];
        if (Array.isArray(metaTarget)) {
          targetFields = metaTarget.map(String);
        } else if (typeof metaTarget === 'string') {
          targetFields = [metaTarget];
        }
        const details: ErrorDetail[] = targetFields.map((field) => ({
          field,
          message: `${field} is already taken`,
        }));
        return AppError.conflict(
          targetFields.length > 0
            ? `A record with this ${targetFields.join(', ')} already exists.`
            : 'A record with these details already exists.',
          'CONFLICT',
          details.length > 0 ? details : undefined,
          err
        );
      }
      case 'P2025':
        return AppError.notFound('The requested record was not found.', 'RECORD_NOT_FOUND', err);
      case 'P2003':
        return AppError.badRequest('Referenced record does not exist or relation constraint violated.', 'FOREIGN_KEY_VIOLATION', undefined, err);
      case 'P2014':
        return AppError.badRequest('Operation violates a required database relation.', 'RELATION_VIOLATION', undefined, err);
      case 'P2024':
        return new AppError('Database connection timed out. Please try again later.', 503, 'DATABASE_TIMEOUT', undefined, err);
      case 'P1008':
        return new AppError('Database operation timed out. Please try again later.', 504, 'DATABASE_TIMEOUT', undefined, err);
      case 'P1000':
      case 'P1001':
      case 'P1002':
      case 'P1003':
        return new AppError('Database service temporarily unavailable.', 503, 'DATABASE_UNAVAILABLE', undefined, err);
      default:
        return new AppError('A database error occurred.', 500, 'DATABASE_ERROR', undefined, err, false);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return AppError.badRequest('Invalid database query parameters.', 'DATABASE_VALIDATION_ERROR', undefined, err);
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new AppError('Database service temporarily unavailable.', 503, 'DATABASE_UNAVAILABLE', undefined, err);
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return AppError.internal('Internal database engine error.', err);
  }

  return null;
}

export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  // Check Prisma errors
  const prismaError = mapPrismaError(err);
  if (prismaError) {
    return prismaError;
  }

  // JSON parse / syntax error from body parser
  if (err instanceof SyntaxError && 'status' in err && (err as { status: unknown }).status === 400) {
    return AppError.badRequest('Malformed JSON in request body.', 'MALFORMED_JSON', undefined, err);
  }

  // Generic unhandled error
  const message = err instanceof Error ? err.message : 'Internal server error';
  return AppError.internal(message, err);
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  const appError = normalizeError(err);
  const requestId = req.id || (req.headers['x-request-id'] as string) || crypto.randomUUID();

  // Log error with sanitized context
  logger.error(appError.message, {
    requestId,
    method: req.method,
    path: req.originalUrl || req.path,
    statusCode: appError.statusCode,
    code: appError.code,
    details: appError.details,
    stack: appError.stack,
    cause:
      appError.cause instanceof Error
        ? { name: appError.cause.name, message: appError.cause.message, stack: appError.cause.stack }
        : appError.cause,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const isInternal = appError.statusCode >= 500 && !appError.isOperational;

  const safeMessage = isProduction && isInternal
    ? 'An unexpected error occurred. Please try again later.'
    : appError.message;

  interface StandardErrorResponse {
    success: false;
    error: {
      code: string;
      message: string;
      details?: ErrorDetail[];
      requestId: string;
    };
  }

  const responseBody: StandardErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: safeMessage,
      requestId,
    },
  };

  if (appError.details && appError.details.length > 0) {
    responseBody.error.details = appError.details;
  }

  return res.status(appError.statusCode).json(responseBody);
};
