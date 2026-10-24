import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';
import { notificationsService } from '../../src/modules/alerts/notifications.service';

describe('Saved Searches and Job Alerts Integration Tests', () => {
  let server: http.Server;
  let baseUrl = '';

  let user1Id = '';
  let user1Token = '';
  let user2Id = '';
  let user2Token = '';

  let testJobId = '';
  let testSourceId = '';
  let testSavedSearchId = '';
  let testNotificationId = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // Create User 1
    const user1 = await prisma.user.create({
      data: {
        email: `search-test-1-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    user1Id = user1.id;
    user1Token = jwt.sign(
      { userId: user1.id, email: user1.email, role: user1.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // Create User 2 (for authorization and boundary tests)
    const user2 = await prisma.user.create({
      data: {
        email: `search-test-2-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    user2Id = user2.id;
    user2Token = jwt.sign(
      { userId: user2.id, email: user2.email, role: user2.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // Ensure a test source exists
    let source = await prisma.jobSource.findFirst();
    if (!source) {
      source = await prisma.jobSource.create({
        data: {
          name: 'Test Source for Alerts',
          slug: `test-source-${Date.now()}`,
          endpointUrl: 'https://example.com/feed',
        },
      });
    }
    testSourceId = source.id;

    // Create a matching active test job
    const job = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        fingerprint: `fp-alerts-test-${Date.now()}`,
        originalUrl: 'https://example.com/jobs/react-senior',
        originalTitle: 'Senior React Engineer (Alert Test)',
        originalDescription: 'We are seeking a senior react developer for full-time work in Addis Ababa.',
        normalizedTitle: 'Senior React Engineer (Alert Test)',
        normalizedDescription: 'We are seeking a senior react developer for full-time work in Addis Ababa.',
        companyName: 'Fintech Addis Tech',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        workArrangement: 'HYBRID',
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        salaryMin: 45000,
        salaryMax: 65000,
        salaryCurrency: 'ETB',
        status: 'ACTIVE',
        classificationStatus: 'CLASSIFIED',
        publishedAt: new Date(),
        firstSeenAt: new Date(),
      },
    });
    testJobId = job.id;
  });

  after(async () => {
    // Cleanup test data
    if (testSavedSearchId) {
      await prisma.savedSearch.deleteMany({ where: { id: testSavedSearchId } });
    }
    if (testJobId) {
      await prisma.jobNotification.deleteMany({ where: { jobId: testJobId } });
      await prisma.job.deleteMany({ where: { id: testJobId } });
    }
    await prisma.jobNotification.deleteMany({ where: { userId: { in: [user1Id, user2Id] } } });
    await prisma.savedSearch.deleteMany({ where: { userId: { in: [user1Id, user2Id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user1Id, user2Id] } } });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated access to saved-searches and notifications with 401', async () => {
    const res1 = await fetch(`${baseUrl}/api/v1/saved-searches`);
    assert.strictEqual(res1.status, 401);

    const res2 = await fetch(`${baseUrl}/api/v1/notifications`);
    assert.strictEqual(res2.status, 401);
  });

  it('creates a saved search with structured filters', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saved-searches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: 'Senior React in Addis',
        search: 'Senior React',
        city: 'Addis Ababa',
        workArrangement: 'HYBRID',
        employmentType: 'FULL_TIME',
        experienceLevel: 'SENIOR',
        minSalary: 40000,
        isAlertEnabled: true,
      }),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(json.data.savedSearch.name, 'Senior React in Addis');
    assert.strictEqual(json.data.savedSearch.city, 'Addis Ababa');
    assert.strictEqual(json.data.savedSearch.isAlertEnabled, true);

    testSavedSearchId = json.data.savedSearch.id;
  });

  it('lists user saved searches including notificationsCount', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saved-searches`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    assert.ok(Array.isArray(json.data.savedSearches));
    assert.ok(json.data.savedSearches.length >= 1);
    const found = json.data.savedSearches.find((s: any) => s.id === testSavedSearchId);
    assert.ok(found);
    assert.strictEqual(found.name, 'Senior React in Addis');
  });

  it('updates a saved search name and parameters', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: 'Senior React Addis (Updated)',
        minSalary: 42000,
      }),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.savedSearch.name, 'Senior React Addis (Updated)');
  });

  it('toggles alert status on and off', async () => {
    // Disable alert
    const res1 = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}/toggle-alert`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res1.status, 200);
    const json1 = await res1.json();
    assert.strictEqual(json1.data.savedSearch.isAlertEnabled, false);

    // Re-enable alert
    const res2 = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}/toggle-alert`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res2.status, 200);
    const json2 = await res2.json();
    assert.strictEqual(json2.data.savedSearch.isAlertEnabled, true);
  });

  it('runs saved search live and returns matching jobs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}/run`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    assert.ok(Array.isArray(json.data.jobs));
    const matchingTestJob = json.data.jobs.find((j: any) => j.id === testJobId);
    assert.ok(matchingTestJob, 'Test job should match saved search criteria');
    assert.strictEqual(matchingTestJob.city, 'Addis Ababa');
  });

  it('enforces boundary: other user cannot view, edit, or delete another user saved search', async () => {
    const resGet = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.strictEqual(resGet.status, 403);

    const resPut = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({ name: 'Hacked Name' }),
    });
    assert.strictEqual(resPut.status, 403);

    const resDel = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.strictEqual(resDel.status, 403);
  });

  it('evaluates alerts and creates in-app notifications with deduplication', async () => {
    // Reset lastAlertAt to past so evaluation picks up our test job
    await prisma.savedSearch.update({
      where: { id: testSavedSearchId },
      data: { lastAlertAt: null, isAlertEnabled: true },
    });

    const resEval = await fetch(`${baseUrl}/api/v1/saved-searches/trigger-alerts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(resEval.status, 200);

    // Verify notification was created
    const resNotifs = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(resNotifs.status, 200);
    const jsonNotifs = await resNotifs.json();
    assert.ok(jsonNotifs.data.notifications.length >= 1);

    const alertNotification = jsonNotifs.data.notifications.find((n: any) => n.jobId === testJobId);
    assert.ok(alertNotification, 'Alert notification for test job should exist');
    assert.strictEqual(alertNotification.isRead, false);
    assert.strictEqual(alertNotification.status, 'DELIVERED');
    testNotificationId = alertNotification.id;

    // Check unread count
    const resCount = await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(resCount.status, 200);
    const jsonCount = await resCount.json();
    assert.ok(jsonCount.data.unreadCount >= 1);

    // Deduplication check: run trigger-alerts again, ensure count does not increase for the same job
    const notifsBefore = jsonNotifs.data.total;
    await fetch(`${baseUrl}/api/v1/saved-searches/trigger-alerts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const resNotifsAfter = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const jsonNotifsAfter = await resNotifsAfter.json();
    assert.strictEqual(jsonNotifsAfter.data.total, notifsBefore, 'No duplicate notification created');
  });

  it('marks a notification as read and unread count decreases', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/${testNotificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.notification.isRead, true);
    assert.ok(json.data.notification.readAt);
  });

  it('marks all notifications as read', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res.status, 200);

    const resCount = await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const jsonCount = await resCount.json();
    assert.strictEqual(jsonCount.data.unreadCount, 0);
  });

  it('deletes a notification', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/${testNotificationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res.status, 200);

    const resCheck = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const jsonCheck = await resCheck.json();
    const found = jsonCheck.data.notifications.find((n: any) => n.id === testNotificationId);
    assert.strictEqual(found, undefined, 'Notification should be deleted');
  });

  it('deletes saved search and cleans up', async () => {
    const res = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(res.status, 200);

    const resCheck = await fetch(`${baseUrl}/api/v1/saved-searches/${testSavedSearchId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.strictEqual(resCheck.status, 404);
  });
});

