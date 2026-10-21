import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Prisma } from '@prisma/client';
import {
  AppError,
  mapPrismaError,
  normalizeError,
  errorHandler,
} from '../../src/middleware/error-handler';
import { Request, Response } from 'express';

describe('AppError Class and Factories', () => {
  it('instantiates with custom properties', () => {
    const error = new AppError('Custom error', 422, 'CUSTOM_UNPROCESSABLE', [
      { field: 'test', message: 'test invalid' },
    ]);
    assert.strictEqual(error.message, 'Custom error');
    assert.strictEqual(error.statusCode, 422);
    assert.strictEqual(error.code, 'CUSTOM_UNPROCESSABLE');
    assert.strictEqual(error.isOperational, true);
    assert.strictEqual(error.details?.length, 1);
    assert.strictEqual(error.details[0].field, 'test');
  });

  it('uses default error code for status code when code not provided', () => {
    const notFound = new AppError('Not found item', 404);
    assert.strictEqual(notFound.code, 'NOT_FOUND');

    const badReq = new AppError('Bad req', 400);
    assert.strictEqual(badReq.code, 'BAD_REQUEST');

    const unauth = new AppError('Unauthorized', 401);
    assert.strictEqual(unauth.code, 'UNAUTHORIZED');

    const forbidden = new AppError('Forbidden', 403);
    assert.strictEqual(forbidden.code, 'FORBIDDEN');

    const conflict = new AppError('Conflict', 409);
    assert.strictEqual(conflict.code, 'CONFLICT');

    const internal = new AppError('Internal', 500);
    assert.strictEqual(internal.code, 'INTERNAL_SERVER_ERROR');
  });

  it('provides static factory methods', () => {
    const bad = AppError.badRequest('Invalid parameter', 'INVALID_PARAM');
    assert.strictEqual(bad.statusCode, 400);
    assert.strictEqual(bad.code, 'INVALID_PARAM');

    const unauth = AppError.unauthorized('Please log in');
    assert.strictEqual(unauth.statusCode, 401);
    assert.strictEqual(unauth.code, 'UNAUTHORIZED');

    const forb = AppError.forbidden('Access denied');
    assert.strictEqual(forb.statusCode, 403);
    assert.strictEqual(forb.code, 'FORBIDDEN');

    const notFound = AppError.notFound('Resource missing');
    assert.strictEqual(notFound.statusCode, 404);
    assert.strictEqual(notFound.code, 'NOT_FOUND');

    const conf = AppError.conflict('Already exists', 'DUPLICATE');
    assert.strictEqual(conf.statusCode, 409);
    assert.strictEqual(conf.code, 'DUPLICATE');

    const val = AppError.validation('Validation failed', [{ field: 'email', message: 'Required' }]);
    assert.strictEqual(val.statusCode, 400);
    assert.strictEqual(val.code, 'VALIDATION_ERROR');
    assert.strictEqual(val.details?.[0].field, 'email');

    const inter = AppError.internal('Database crash');
    assert.strictEqual(inter.statusCode, 500);
    assert.strictEqual(inter.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(inter.isOperational, false);
  });
});

describe('mapPrismaError', () => {
  it('maps P2002 unique constraint violation to 409 CONFLICT', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.0.0',
      meta: { target: ['email'] },
    });

    const mapped = mapPrismaError(prismaError);
    assert.notStrictEqual(mapped, null);
    assert.strictEqual(mapped?.statusCode, 409);
    assert.strictEqual(mapped?.code, 'CONFLICT');
    assert.strictEqual(mapped?.details?.[0].field, 'email');
    assert.match(mapped?.message || '', /email/i);
    // Ensure raw query or database internals are not leaked
    assert.doesNotMatch(mapped?.message || '', /SELECT|INSERT|UPDATE|PRISMA/i);
  });

  it('maps P2025 record not found to 404 RECORD_NOT_FOUND', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    });

    const mapped = mapPrismaError(prismaError);
    assert.notStrictEqual(mapped, null);
    assert.strictEqual(mapped?.statusCode, 404);
    assert.strictEqual(mapped?.code, 'RECORD_NOT_FOUND');
  });

  it('maps P2003 foreign key constraint to 400 FOREIGN_KEY_VIOLATION', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
      code: 'P2003',
      clientVersion: '7.0.0',
    });

    const mapped = mapPrismaError(prismaError);
    assert.notStrictEqual(mapped, null);
    assert.strictEqual(mapped?.statusCode, 400);
    assert.strictEqual(mapped?.code, 'FOREIGN_KEY_VIOLATION');
  });

  it('maps P2024 connection timeout to 503 DATABASE_TIMEOUT', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Timed out', {
      code: 'P2024',
      clientVersion: '7.0.0',
    });

    const mapped = mapPrismaError(prismaError);
    assert.notStrictEqual(mapped, null);
    assert.strictEqual(mapped?.statusCode, 503);
    assert.strictEqual(mapped?.code, 'DATABASE_TIMEOUT');
  });

  it('maps P1001 database unreachable to 503 DATABASE_UNAVAILABLE', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('Cannot reach server', {
      code: 'P1001',
      clientVersion: '7.0.0',
    });

    const mapped = mapPrismaError(prismaError);
    assert.notStrictEqual(mapped, null);
    assert.strictEqual(mapped?.statusCode, 503);
    assert.strictEqual(mapped?.code, 'DATABASE_UNAVAILABLE');
  });

  it('returns null for non-Prisma errors', () => {
    const genericErr = new Error('Generic failure');
    assert.strictEqual(mapPrismaError(genericErr), null);
  });
});

describe('normalizeError', () => {
  it('returns AppError directly without modification', () => {
    const appErr = AppError.badRequest('Custom', 'BAD_PARAM');
    assert.strictEqual(normalizeError(appErr), appErr);
  });

  it('normalizes SyntaxError for bad JSON request bodies to 400 MALFORMED_JSON', () => {
    const syntaxErr = new SyntaxError('Unexpected token in JSON');
    (syntaxErr as unknown as { status: number }).status = 400;

    const normalized = normalizeError(syntaxErr);
    assert.strictEqual(normalized.statusCode, 400);
    assert.strictEqual(normalized.code, 'MALFORMED_JSON');
  });

  it('normalizes generic unexpected errors to 500 INTERNAL_SERVER_ERROR', () => {
    const standardError = new Error('Unexpected filesystem crash');
    const normalized = normalizeError(standardError);
    assert.strictEqual(normalized.statusCode, 500);
    assert.strictEqual(normalized.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(normalized.isOperational, false);
  });
});

describe('errorHandler Middleware Output Serialization', () => {
  it('serializes standard AppError response with requestId and details', () => {
    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      id: 'test-req-123',
      headers: {},
      method: 'POST',
      originalUrl: '/api/v1/auth/register',
    } as unknown as Request;

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
    } as unknown as Response;

    const appError = AppError.validation('Validation failed', [
      { field: 'email', message: 'Email already exists' },
    ]);

    errorHandler(appError, mockReq, mockRes, () => {});

    assert.strictEqual(responseStatus, 400);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'VALIDATION_ERROR');
    assert.strictEqual(responseBody.error.message, 'Validation failed');
    assert.strictEqual(responseBody.error.requestId, 'test-req-123');
    assert.strictEqual(responseBody.error.details.length, 1);
    assert.strictEqual(responseBody.error.details[0].field, 'email');
  });

  it('hides message in production for internal 500 non-operational errors', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      let responseStatus = 0;
      let responseBody: any = null;

      const mockReq = {
        id: 'prod-req-999',
        headers: {},
        method: 'GET',
        originalUrl: '/api/v1/jobs',
      } as unknown as Request;

      const mockRes = {
        status(code: number) {
          responseStatus = code;
          return this;
        },
        json(body: any) {
          responseBody = body;
          return this;
        },
      } as unknown as Response;

      const secretInternalError = new Error('Secret DB password was wrong: admin123');
      errorHandler(secretInternalError, mockReq, mockRes, () => {});

      assert.strictEqual(responseStatus, 500);
      assert.strictEqual(responseBody.success, false);
      assert.strictEqual(responseBody.error.code, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(
        responseBody.error.message,
        'An unexpected error occurred. Please try again later.'
      );
      assert.strictEqual(responseBody.error.requestId, 'prod-req-999');
      assert.strictEqual(responseBody.error.details, undefined);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
