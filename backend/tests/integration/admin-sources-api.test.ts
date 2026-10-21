import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';
import { seedAdmin, DEFAULT_ADMIN_EMAIL, DEFAULT_DEV_ADMIN_PASSWORD } from '../../src/seeds/seed-admin';
import { sourceScheduler } from '../../src/modules/scheduler/scheduler.service';

describe('Admin Sources Management API Integration', () => {
  let server: http.Server;
  let baseUrl = '';
  let adminToken = '';
  let userToken = '';
  let testRegularUserId = '';
  let createdSourceId = '';

  before(async () => {
    // 1. Start HTTP Server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 2. Ensure Admin user exists and retrieve login token
    await seedAdmin();
    const adminUser = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
    });
    assert.ok(adminUser);

    adminToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        isEmailVerified: adminUser.isEmailVerified,
      },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Create a test regular user (Role: CANDIDATE)
    const testUserEmail = 'regular-user-test@example.com';
    let regularUser = await prisma.user.findUnique({ where: { email: testUserEmail } });
    if (!regularUser) {
      regularUser = await prisma.user.create({
        data: {
          email: testUserEmail,
          passwordHash: await argon2.hash('regularpassword123'),
          role: 'CANDIDATE',
          isEmailVerified: true,
        },
      });
    }
    testRegularUserId = regularUser.id;

    userToken = jwt.sign(
      {
        userId: regularUser.id,
        email: regularUser.email,
        role: regularUser.role,
        isEmailVerified: regularUser.isEmailVerified,
      },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    // Clean up created sources and users
    if (createdSourceId) {
      await prisma.collectionRun.deleteMany({ where: { sourceId: createdSourceId } });
      await prisma.jobClassification.deleteMany({ where: { job: { sourceId: createdSourceId } } });
      await prisma.job.deleteMany({ where: { sourceId: createdSourceId } });
      await prisma.jobSource.deleteMany({ where: { id: createdSourceId } });
    }
    if (testRegularUserId) {
      await prisma.user.deleteMany({ where: { id: testRegularUserId } });
    }

    sourceScheduler.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests with 401 AUTHENTICATION_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/sources`);
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('rejects non-admin (USER) requests with 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/sources`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'FORBIDDEN');
  });

  it('allows admin to list job sources with pagination', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/sources?page=1&limit=10`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.status, 'success');
    assert.ok(Array.isArray(json.data.sources));
    assert.strictEqual(json.data.page, 1);
    assert.ok(typeof json.data.total === 'number');
  });

  it('rejects source creation targeting loopback or metadata IP (SSRF protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Metadata Source',
        slug: 'ssrf-target-source',
        sourceType: 'API',
        endpointUrl: 'http://169.254.169.254/latest/meta-data',
        pollingInterval: 60,
      }),
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'VALIDATION_ERROR');
    const ssrfError = data.error.details.find((d: any) => d.field === 'endpointUrl');
    assert.ok(ssrfError);
    assert.match(ssrfError.message, /cannot reference localhost|private ip|metadata/i);
  });

  it('allows admin to create a new valid source', async () => {
    const payload = {
      name: 'Integration Test Source',
      slug: `integ-source-${Date.now()}`,
      sourceType: 'API',
      endpointUrl: 'https://httpbin.org/get',
      pollingInterval: 45,
      isActive: false,
      headers: {
        'X-Custom-Secret': 'super-secret-token',
      },
    };

    const res = await fetch(`${baseUrl}/api/v1/admin/sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as any;

    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.status, 'success');
    assert.ok(json.data.source);
    assert.strictEqual(json.data.source.slug, payload.slug);
    assert.strictEqual(json.data.source.pollingInterval, 45);

    // Verify sensitive header is stripped completely from sanitized API response
    assert.strictEqual(json.data.source.headers, undefined);

    createdSourceId = json.data.source.id;
  });

  it('allows admin to retrieve an existing source by ID', async () => {
    assert.ok(createdSourceId);
    const res = await fetch(`${baseUrl}/api/v1/admin/sources/${createdSourceId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(json.data.source.id, createdSourceId);
  });

  it('returns 404 for non-existent source ID', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/sources/non-existent-source-uuid`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'SOURCE_NOT_FOUND');
  });

  it('allows admin to update source configuration (PATCH)', async () => {
    assert.ok(createdSourceId);
    const res = await fetch(`${baseUrl}/api/v1/admin/sources/${createdSourceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        pollingInterval: 120,
        isActive: true,
      }),
    });
    const json = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(json.data.source.pollingInterval, 120);
    assert.strictEqual(json.data.source.isActive, true);
  });

  it('retrieves runs history and stats for a source', async () => {
    assert.ok(createdSourceId);

    // Retrieve stats
    const statsRes = await fetch(`${baseUrl}/api/v1/admin/sources/${createdSourceId}/stats`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const statsJson = (await statsRes.json()) as any;

    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsJson.status, 'success');
    assert.ok(statsJson.data.stats);
    assert.strictEqual(typeof statsJson.data.stats.totalRuns, 'number');

    // Retrieve runs
    const runsRes = await fetch(`${baseUrl}/api/v1/admin/sources/${createdSourceId}/runs`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const runsJson = (await runsRes.json()) as any;

    assert.strictEqual(runsRes.status, 200);
    assert.strictEqual(runsJson.status, 'success');
    assert.ok(Array.isArray(runsJson.data.runs));
  });

  it('triggers a manual collection run via POST /:id/run', async () => {
    // Use the seeded afriwork source to verify the execution flow
    const afriwork = await prisma.jobSource.findUnique({ where: { slug: 'afriwork' } });
    assert.ok(afriwork);

    const res = await fetch(`${baseUrl}/api/v1/admin/sources/${afriwork.id}/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.status, 'success');
    assert.ok(json.data.run);
    assert.strictEqual(json.data.run.sourceId, afriwork.id);
    // Because Afriwork anonymously rejects GraphQL with SOURCE_AUTH_REQUIRED, run status is FAILED
    assert.strictEqual(json.data.run.status, 'FAILED');
    assert.ok(json.data.run.errorSummary);

    // Clean up collection run created for afriwork
    await prisma.collectionRun.deleteMany({ where: { id: json.data.run.id } });
  });
});
