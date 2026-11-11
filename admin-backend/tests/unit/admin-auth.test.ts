import { describe, it } from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { authenticate } from '../../src/middleware/authenticate';
import { authorize } from '../../src/middleware/authorize';
import { AppError } from '../../src/middleware/error-handler';
import { env } from '../../src/config/env';

describe('Admin Backend Authentication & Authorization (Scenarios B, C, D)', () => {
  // Scenario B: Admin token generation and verification
  it('Scenario B: allows access when user possesses valid ADMIN token', () => {
    const adminPayload = {
      userId: 'admin-uuid-123',
      email: 'admin@job.com',
      role: 'ADMIN',
    };
    const validToken = jwt.sign(adminPayload, env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    } as unknown as Request;

    const res = {} as unknown as Response;

    let authNextCalled = false;
    let authError: any = null;

    authenticate(req, res, (err) => {
      authNextCalled = true;
      authError = err;
    });

    assert.strictEqual(authNextCalled, true);
    assert.strictEqual(authError, undefined);
    assert.ok(req.user);
    assert.strictEqual(req.user.role, 'ADMIN');

    // Authorize check for 'ADMIN'
    let rbacNextCalled = false;
    let rbacError: any = null;

    authorize('ADMIN')(req, res, (err) => {
      rbacNextCalled = true;
      rbacError = err;
    });

    assert.strictEqual(rbacNextCalled, true);
    assert.strictEqual(rbacError, undefined);
  });

  // Scenario C & D: Ordinary user attempts admin access
  it('Scenario C & D: rejects ordinary authenticated user (SEEKER / USER) with 403 Forbidden', () => {
    const seekerPayload = {
      userId: 'user-uuid-456',
      email: 'seeker@job.com',
      role: 'SEEKER',
    };
    const seekerToken = jwt.sign(seekerPayload, env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    const req = {
      headers: {
        authorization: `Bearer ${seekerToken}`,
      },
    } as unknown as Request;

    const res = {} as unknown as Response;

    authenticate(req, res, () => {});
    assert.ok(req.user);
    assert.strictEqual(req.user.role, 'SEEKER');

    let rbacError: any = null;
    authorize('ADMIN')(req, res, (err) => {
      rbacError = err;
    });

    assert.ok(rbacError instanceof AppError);
    assert.strictEqual(rbacError.statusCode, 403);
    assert.strictEqual(rbacError.code, 'FORBIDDEN');
  });

  // Scenario D: Unauthenticated request to admin endpoint
  it('Scenario D: rejects unauthenticated request with 401 Unauthorized', () => {
    const req = {
      headers: {},
    } as unknown as Request;

    const res = {} as unknown as Response;

    let authError: any = null;
    authenticate(req, res, (err) => {
      authError = err;
    });

    assert.ok(authError instanceof AppError);
    assert.strictEqual(authError.statusCode, 401);
    assert.strictEqual(authError.code, 'AUTHENTICATION_REQUIRED');
  });

  // Scenario D: Forged token signature rejection
  it('Scenario D: rejects forged token signed with malicious key with 401 Invalid Token', () => {
    const fakeSecret = 'malicious_secret_attempting_forge_123456';
    const forgedToken = jwt.sign(
      { userId: 'hacker-1', email: 'hacker@malicious.com', role: 'ADMIN' },
      fakeSecret
    );

    const req = {
      headers: {
        authorization: `Bearer ${forgedToken}`,
      },
    } as unknown as Request;

    const res = {} as unknown as Response;

    let authError: any = null;
    authenticate(req, res, (err) => {
      authError = err;
    });

    assert.ok(authError instanceof AppError);
    assert.strictEqual(authError.statusCode, 401);
    assert.strictEqual(authError.code, 'INVALID_TOKEN');
  });

  // Scenario D: Expired token rejection
  it('Scenario D: rejects expired token with 401 Token Expired', () => {
    const expiredToken = jwt.sign(
      { userId: 'admin-1', email: 'admin@job.com', role: 'ADMIN' },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '-1s' }
    );

    const req = {
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    } as unknown as Request;

    const res = {} as unknown as Response;

    let authError: any = null;
    authenticate(req, res, (err) => {
      authError = err;
    });

    assert.ok(authError instanceof AppError);
    assert.strictEqual(authError.statusCode, 401);
    assert.strictEqual(authError.code, 'TOKEN_EXPIRED');
  });
});

