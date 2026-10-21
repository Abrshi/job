import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Request, Response } from 'express';
import { requestIdMiddleware } from '../../src/middleware/request-id';
import { validate } from '../../src/middleware/validate';
import { authenticate } from '../../src/middleware/authenticate';
import { authorize } from '../../src/middleware/authorize';
import { AppError } from '../../src/middleware/error-handler';
import { env } from '../../src/config/env';

describe('requestIdMiddleware', () => {
  it('generates a new UUID when X-Request-Id header is missing', () => {
    let setHeaderKey = '';
    let setHeaderVal = '';

    const req = {
      headers: {},
    } as unknown as Request;

    const res = {
      setHeader(key: string, val: string) {
        setHeaderKey = key;
        setHeaderVal = val;
      },
    } as unknown as Response;

    let nextCalled = false;
    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(setHeaderKey, 'X-Request-Id');
    assert.ok(req.id && req.id.length > 10);
    assert.strictEqual(setHeaderVal, req.id);
  });

  it('preserves and passes through existing X-Request-Id header', () => {
    let setHeaderVal = '';

    const req = {
      headers: {
        'x-request-id': 'client-provided-trace-456',
      },
    } as unknown as Request;

    const res = {
      setHeader(key: string, val: string) {
        setHeaderVal = val;
      },
    } as unknown as Response;

    requestIdMiddleware(req, res, () => {});

    assert.strictEqual(req.id, 'client-provided-trace-456');
    assert.strictEqual(setHeaderVal, 'client-provided-trace-456');
  });
});

describe('validate Middleware', () => {
  const schema = z.object({
    body: z.object({
      email: z.string().email('Invalid email address'),
      age: z.number().min(18, 'Must be at least 18'),
    }),
  });

  it('calls next() without error when validation succeeds', async () => {
    const req = {
      body: { email: 'valid@example.com', age: 25 },
      query: {},
      params: {},
      cookies: {},
    } as unknown as Request;

    const res = {} as unknown as Response;

    let receivedError: unknown = null;
    await validate(schema)(req, res, (err?: unknown) => {
      receivedError = err;
    });

    assert.strictEqual(receivedError, undefined);
  });

  it('calls next with formatted AppError containing field details on validation failure', async () => {
    const req = {
      body: { email: 'invalid-email', age: 16 },
      query: {},
      params: {},
      cookies: {},
    } as unknown as Request;

    const res = {} as unknown as Response;

    let receivedError: unknown = null;
    await validate(schema)(req, res, (err?: unknown) => {
      receivedError = err;
    });

    assert.ok(receivedError instanceof AppError);
    const appErr = receivedError as AppError;
    assert.strictEqual(appErr.statusCode, 400);
    assert.strictEqual(appErr.code, 'VALIDATION_ERROR');
    assert.strictEqual(appErr.details?.length, 2);

    const emailErr = appErr.details?.find((d) => d.field === 'email');
    assert.ok(emailErr);
    assert.strictEqual(emailErr?.message, 'Invalid email address');

    const ageErr = appErr.details?.find((d) => d.field === 'age');
    assert.ok(ageErr);
    assert.strictEqual(ageErr?.message, 'Must be at least 18');
  });
});

describe('authenticate Middleware', () => {
  it('fails with 401 AUTHENTICATION_REQUIRED when Authorization header is missing', () => {
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {} as unknown as Response;

    let capturedError: unknown = null;
    authenticate(req, res, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof AppError);
    const err = capturedError as AppError;
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.code, 'AUTHENTICATION_REQUIRED');
  });

  it('fails with 401 TOKEN_EXPIRED when access token has expired', () => {
    // Generate an expired token
    const expiredToken = jwt.sign(
      { userId: 'u1', email: 'test@example.com', role: 'CANDIDATE' },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '-10s' }
    );

    const req = {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    } as unknown as Request;
    const res = {} as unknown as Response;

    let capturedError: unknown = null;
    authenticate(req, res, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof AppError);
    const err = capturedError as AppError;
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.code, 'TOKEN_EXPIRED');
  });

  it('fails with 401 INVALID_TOKEN when token signature is wrong', () => {
    const invalidToken = jwt.sign(
      { userId: 'u1', email: 'test@example.com', role: 'CANDIDATE' },
      'wrong-secret-key-12345678901234567890'
    );

    const req = {
      headers: {
        authorization: `Bearer ${invalidToken}`,
      },
    } as unknown as Request;
    const res = {} as unknown as Response;

    let capturedError: unknown = null;
    authenticate(req, res, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof AppError);
    const err = capturedError as AppError;
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.code, 'INVALID_TOKEN');
  });

  it('attaches user to req and calls next() on valid token', () => {
    const validToken = jwt.sign(
      { userId: 'u-valid-1', email: 'valid@example.com', role: 'CANDIDATE' },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    } as unknown as Request;
    const res = {} as unknown as Response;

    let nextCalled = false;
    authenticate(req, res, (err?: unknown) => {
      assert.strictEqual(err, undefined);
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user?.userId, 'u-valid-1');
    assert.strictEqual(req.user?.role, 'CANDIDATE');
  });
});

describe('authorize Middleware', () => {
  it('fails with 401 AUTHENTICATION_REQUIRED if req.user is absent', () => {
    const req = {} as unknown as Request;
    const res = {} as unknown as Response;

    let capturedError: unknown = null;
    authorize('ADMIN')(req, res, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof AppError);
    const err = capturedError as AppError;
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.code, 'AUTHENTICATION_REQUIRED');
  });

  it('fails with 403 FORBIDDEN if user role is not allowed', () => {
    const req = {
      user: { userId: 'u1', email: 'test@example.com', role: 'CANDIDATE' },
    } as unknown as Request;
    const res = {} as unknown as Response;

    let capturedError: unknown = null;
    authorize('ADMIN', 'EMPLOYER')(req, res, (err?: unknown) => {
      capturedError = err;
    });

    assert.ok(capturedError instanceof AppError);
    const err = capturedError as AppError;
    assert.strictEqual(err.statusCode, 403);
    assert.strictEqual(err.code, 'FORBIDDEN');
  });

  it('succeeds and calls next() if user role is permitted', () => {
    const req = {
      user: { userId: 'u1', email: 'admin@example.com', role: 'ADMIN' },
    } as unknown as Request;
    const res = {} as unknown as Response;

    let nextCalled = false;
    authorize('ADMIN')(req, res, (err?: unknown) => {
      assert.strictEqual(err, undefined);
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });
});
