import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';
import { seedAdmin, DEFAULT_ADMIN_EMAIL } from '../../src/seeds/seed-admin';
import { sourceScheduler } from '../../src/modules/scheduler/scheduler.service';

describe('Admin Dashboard and Operations Integration', () => {
  let server: http.Server;
  let baseUrl = '';
  let adminToken = '';
  let candidateToken = '';
  let adminUserId = '';
  let candidateUserId = '';
  let testJobId = '';
  let testSourceId = '';

  before(async () => {
    // 1. Start HTTP test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 2. Ensure admin exists
    await seedAdmin();
    const adminUser = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL },
    });
    assert.ok(adminUser);
    adminUserId = adminUser.id;

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

    // 3. Create candidate user
    const candEmail = 'candidate-test@job.com';
    let candUser = await prisma.user.findUnique({ where: { email: candEmail } });
    if (!candUser) {
      candUser = await prisma.user.create({
        data: {
          email: candEmail,
          passwordHash: await argon2.hash('candidatepass123'),
          role: 'CANDIDATE',
          isEmailVerified: true,
        },
      });
    }
    candidateUserId = candUser.id;

    candidateToken = jwt.sign(
      {
        userId: candUser.id,
        email: candUser.email,
        role: candUser.role,
        isEmailVerified: candUser.isEmailVerified,
      },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Create test source & job for admin operations
    let source = await prisma.jobSource.findUnique({ where: { slug: 'admin-test-source' } });
    if (!source) {
      source = await prisma.jobSource.create({
        data: {
          name: 'Admin Test Source',
          slug: 'admin-test-source',
          endpointUrl: 'https://example.com/api',
          pollingInterval: 60,
          isActive: true,
        },
      });
    }
    testSourceId = source.id;

    const testJob = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        externalId: 'ext-admin-test-1',
        fingerprint: 'ext:ext-admin-test-1',
        originalUrl: 'https://example.com/job/1',
        originalTitle: 'Senior Full Stack Engineer',
        originalDescription: 'Build React and Node web applications. 5+ years experience required.',
        normalizedTitle: 'Senior Full Stack Engineer',
        normalizedDescription: 'Build React and Node web applications. 5+ years experience required.',
        status: 'ACTIVE',
        classificationStatus: 'PENDING',
      },
    });
    testJobId = testJob.id;
  });

  after(async () => {
    sourceScheduler.stop();

    if (testJobId) {
      await prisma.jobClassification.deleteMany({ where: { jobId: testJobId } });
      await prisma.job.deleteMany({ where: { id: testJobId } });
    }
    if (testSourceId) {
      await prisma.collectionRun.deleteMany({ where: { sourceId: testSourceId } });
      await prisma.jobSource.deleteMany({ where: { id: testSourceId } });
    }
    if (candidateUserId) {
      await prisma.refreshSession.deleteMany({ where: { userId: candidateUserId } });
      await prisma.user.deleteMany({ where: { id: candidateUserId } });
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests to /api/v1/admin/dashboard/stats with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/dashboard/stats`);
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'AUTHENTICATION_REQUIRED');
  });

  it('rejects non-admin requests to /api/v1/admin/dashboard/stats with 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'FORBIDDEN');
  });

  it('returns valid dashboard stats and 7-day overview for administrators', async () => {
    const statsRes = await fetch(`${baseUrl}/api/v1/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsData = (await statsRes.json()) as any;

    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsData.status, 'success');
    assert.ok(typeof statsData.data.totalJobs === 'number');
    assert.ok(typeof statsData.data.activeUsers === 'number');
    assert.ok(statsData.data.totalUsers >= 1);

    const overviewRes = await fetch(`${baseUrl}/api/v1/admin/dashboard/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const overviewData = (await overviewRes.json()) as any;

    assert.strictEqual(overviewRes.status, 200);
    assert.strictEqual(overviewData.status, 'success');
    assert.ok(Array.isArray(overviewData.data.jobsTrend));
    assert.strictEqual(overviewData.data.jobsTrend.length, 7);
  });

  it('lists catalog jobs with search, filtering, and pagination', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/jobs?page=1&limit=10&search=Senior`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'success');
    assert.ok(Array.isArray(data.data.jobs));
    assert.strictEqual(data.data.page, 1);
    assert.ok(data.data.total >= 1);
  });

  it('allows admin to update job status (e.g. EXPIRED) and logs audit entry', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/jobs/${testJobId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'EXPIRED' }),
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'success');
    assert.strictEqual(data.data.job.status, 'EXPIRED');

    // Verify audit log entry exists
    const audit = await prisma.adminAuditLog.findFirst({
      where: { targetId: testJobId, action: 'JOB_STATUS_CHANGE' },
    });
    assert.ok(audit);
  });

  it('lists users and excludes passwordHash from responses', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'success');
    assert.ok(Array.isArray(data.data.users));

    // Ensure passwordHash is not exposed
    data.data.users.forEach((u: any) => {
      assert.strictEqual(u.passwordHash, undefined);
    });
  });

  it('prevents administrator from deactivating their own account (safeguard)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${adminUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'SELF_DEACTIVATION_PREVENTED');
  });

  it('prevents administrator from demoting their own admin role (safeguard)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/users/${adminUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'CANDIDATE' }),
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'SELF_DEMOTION_PREVENTED');
  });

  it('allows public retrieval of site settings and admin updates', async () => {
    // 1. Public retrieval
    const publicRes = await fetch(`${baseUrl}/api/v1/settings`);
    const publicData = (await publicRes.json()) as any;

    assert.strictEqual(publicRes.status, 200);
    assert.strictEqual(publicData.status, 'success');
    assert.ok(publicData.data.settings.siteName);

    // 2. Admin update
    const updateRes = await fetch(`${baseUrl}/api/v1/admin/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        siteName: 'JobSphere Updated',
        tagline: 'Premier East Africa Portal',
      }),
    });
    const updateData = (await updateRes.json()) as any;

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.status, 'success');
    assert.strictEqual(updateData.data.settings.siteName, 'JobSphere Updated');
  });

  it('returns predefined taxonomy categories and lists pending reviews', async () => {
    const catRes = await fetch(`${baseUrl}/api/v1/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const catData = (await catRes.json()) as any;

    assert.strictEqual(catRes.status, 200);
    assert.strictEqual(catData.status, 'success');
    assert.strictEqual(catData.data.categories.length, 20);

    const reviewRes = await fetch(`${baseUrl}/api/v1/admin/classifications/review`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reviewData = (await reviewRes.json()) as any;

    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewData.status, 'success');
    assert.ok(Array.isArray(reviewData.data.jobs));
  });

  it('allows administrator to manually override a job classification', async () => {
    const swCategory = await prisma.jobCategory.findUnique({ where: { slug: 'software-it' } });
    assert.ok(swCategory);

    const overrideRes = await fetch(`${baseUrl}/api/v1/admin/classifications/${testJobId}/override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        categoryId: swCategory.id,
        experienceLevel: 'SENIOR',
        explanation: 'Audited senior developer requirement.',
      }),
    });
    const overrideData = (await overrideRes.json()) as any;

    assert.strictEqual(overrideRes.status, 200);
    assert.strictEqual(overrideData.status, 'success');

    const updatedJob = await prisma.job.findUnique({
      where: { id: testJobId },
      include: { classifications: true },
    });
    assert.strictEqual(updatedJob?.categoryId, swCategory.id);
    assert.strictEqual(updatedJob?.experienceLevel, 'SENIOR');
    assert.strictEqual(updatedJob?.classificationStatus, 'CLASSIFIED');
  });

  it('retrieves recorded audit logs for administrative operations', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/audit-logs?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = (await res.json()) as any;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'success');
    assert.ok(Array.isArray(data.data.logs));
    assert.ok(data.data.total >= 1);
  });
});
