import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import app from '../../src/app';

import { prisma } from '../../src/lib/prisma';

describe('HTTP Error Handling Integration', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('handles 404 for unknown routes with standard error payload', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint-route`);
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'ROUTE_NOT_FOUND');
    assert.match(data.error.message, /Cannot GET \/api\/v1\/unknown-endpoint-route/);
    assert.ok(data.error.requestId);
    assert.strictEqual(res.headers.get('x-request-id'), data.error.requestId);
  });

  it('propagates client-provided X-Request-Id through headers and error body', async () => {
    const customTraceId = 'trace-client-abc-123';
    const res = await fetch(`${baseUrl}/api/v1/non-existent`, {
      headers: {
        'x-request-id': customTraceId,
      },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.headers.get('x-request-id'), customTraceId);
    assert.strictEqual(data.error.requestId, customTraceId);
  });

  it('handles validation failure with 400 VALIDATION_ERROR and details array', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'not-an-email',
      }),
    });

    const data = (await res.json()) as any;
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(data.error.details));
    assert.ok(data.error.details.length >= 1);

    const emailIssue = data.error.details.find((d: any) => d.field === 'email');
    assert.ok(emailIssue);
  });

  it('handles malformed JSON request body with 400 MALFORMED_JSON', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{ broken json: ',
    });

    const data = (await res.json()) as any;
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'MALFORMED_JSON');
    assert.ok(data.error.requestId);
  });

  it('handles protected route access without credentials with 401 AUTHENTICATION_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'AUTHENTICATION_REQUIRED');
  });
});
