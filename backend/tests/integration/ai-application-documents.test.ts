import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';

describe('AI-Powered Application Documents Integration Tests', () => {
  let server: http.Server;
  let baseUrl = '';

  let user1Id = '';
  let user1Token = '';
  let user2Id = '';
  let user2Token = '';

  let testJobId = '';
  let testSourceId = '';
  let testDocumentId = '';
  let testApplicationId = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });

    // Create User 1 with profile data
    const user1 = await prisma.user.create({
      data: {
        email: `doc-test-1-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        role: 'CANDIDATE',
        firstName: 'Dawit',
        lastName: 'Alemu',
        isEmailVerified: true,
        profile: {
          create: {
            displayName: 'Dawit Alemu',
            headline: 'Senior Full Stack Engineer',
            experiences: {
              create: [
                {
                  companyName: 'TechHub Ethiopia',
                  jobTitle: 'Senior Software Engineer',
                  isCurrent: true,
                },
              ],
            },
            skills: {
              create: [
                { name: 'TypeScript' },
                { name: 'Node.js' },
                { name: 'React' },
              ],
            },
            educations: {
              create: [
                {
                  institution: 'Addis Ababa University',
                  degree: 'B.Sc. in Computer Science',
                },
              ],
            },
          },
        },
      },
    });
    user1Id = user1.id;
    user1Token = jwt.sign(
      { userId: user1.id, email: user1.email, role: user1.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // Create User 2 (for authorization tests)
    const user2 = await prisma.user.create({
      data: {
        email: `doc-test-2-${Date.now()}@test.com`,
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

    // Create a Source and Catalog Job
    const source = await prisma.jobSource.create({
      data: {
        name: `Test Source ${Date.now()}`,
        slug: `test-source-${Date.now()}`,
        endpointUrl: 'https://example.com/feed',
      },
    });
    testSourceId = source.id;

    const job = await prisma.job.create({
      data: {
        sourceId: source.id,
        fingerprint: `fp-doc-test-${Date.now()}`,
        originalUrl: 'https://example.com/job/1',
        originalTitle: 'Lead Backend Developer',
        originalDescription: 'Seeking an experienced backend developer proficient in Node.js and TypeScript.',
        normalizedTitle: 'Lead Backend Developer',
        normalizedDescription: 'Seeking an experienced backend developer proficient in Node.js and TypeScript.',
        companyName: 'FinTech Africa',
        city: 'Addis Ababa',
        country: 'Ethiopia',
      },
    });
    testJobId = job.id;

    // Create a test JobApplication for User 1
    const appRecord = await prisma.jobApplication.create({
      data: {
        userId: user1Id,
        jobId: testJobId,
        jobTitle: 'Lead Backend Developer',
        companyName: 'FinTech Africa',
        status: 'APPLIED',
      },
    });
    testApplicationId = appRecord.id;
  });

  after(async () => {
    // Clean up
    if (user1Id) {
      await prisma.user.delete({ where: { id: user1Id } }).catch(() => {});
    }
    if (user2Id) {
      await prisma.user.delete({ where: { id: user2Id } }).catch(() => {});
    }
    if (testJobId) {
      await prisma.job.delete({ where: { id: testJobId } }).catch(() => {});
    }
    if (testSourceId) {
      await prisma.jobSource.delete({ where: { id: testSourceId } }).catch(() => {});
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated document requests with 401', async () => {
    const res = await fetch(`${baseUrl}/ai-documents`);
    assert.strictEqual(res.status, 401);
  });

  it('generates a TAILORED_CV draft for an external job', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        documentType: 'TAILORED_CV',
        externalJob: {
          title: 'Senior Frontend Engineer',
          companyName: 'Acme Global',
          description: 'Looking for a Senior React and TypeScript expert.',
          location: 'Remote',
        },
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.ok(body.data.document.id);
    assert.strictEqual(body.data.document.documentType, 'TAILORED_CV');
    assert.strictEqual(body.data.document.currentVersionNumber, 1);
    assert.ok(body.data.document.versions.length > 0);
    assert.ok(body.data.document.versions[0].content.length > 50);
    assert.ok(body.data.verificationReport);

    testDocumentId = body.data.document.id;
  });

  it('generates a COVER_LETTER draft for a catalog job', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        documentType: 'COVER_LETTER',
        jobId: testJobId,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.document.documentType, 'COVER_LETTER');
    assert.strictEqual(body.data.document.targetCompanyName, 'FinTech Africa');
  });

  it('generates an APPLICATION_EMAIL draft with a subject line', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        documentType: 'APPLICATION_EMAIL',
        jobId: testJobId,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.document.documentType, 'APPLICATION_EMAIL');
    assert.ok(body.data.document.versions[0].subjectLine);
  });

  it('lists documents belonging to the authenticated user', async () => {
    const res = await fetch(`${baseUrl}/ai-documents?page=1&limit=10`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.ok(body.data.items.length >= 3);
    assert.strictEqual(body.data.pagination.page, 1);
  });

  it('prevents User 2 from accessing User 1 document', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}`, {
      headers: {
        Authorization: `Bearer ${user2Token}`,
      },
    });

    assert.strictEqual(res.status, 403);
  });

  it('saves an edited version and increments version number', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        content: '# Dawit Alemu\n\nEdited version content emphasizing TypeScript & architecture.',
        changeSummary: 'Updated profile summary',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(body.data.version.versionNumber, 2);

    // Verify getting document includes both versions
    const getRes = await fetch(`${baseUrl}/ai-documents/${testDocumentId}`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });
    const getBody = (await getRes.json()) as any;
    assert.strictEqual(getBody.data.document.currentVersionNumber, 2);
    assert.strictEqual(getBody.data.document.versions.length, 2);
  });

  it('exports document as PDF', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}/versions/2/export?format=pdf`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 500);
  });

  it('exports document as DOCX', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}/versions/2/export?format=docx`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(
      res.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 1000);
  });

  it('exports document as TXT', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}/versions/2/export?format=txt`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/plain'));
    const text = await res.text();
    assert.ok(text.includes('Dawit Alemu'));
  });

  it('attaches generated document to a JobApplication', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}/attach-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        applicationId: testApplicationId,
        attachAs: 'CV',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, 'success');
    assert.ok(body.data.userDocumentId);

    // Verify application in DB now links to documentId
    const updatedApp = await prisma.jobApplication.findUnique({
      where: { id: testApplicationId },
    });
    assert.strictEqual(updatedApp?.documentId, body.data.userDocumentId);
  });

  it('deletes a document and prevents further access', async () => {
    const res = await fetch(`${baseUrl}/ai-documents/${testDocumentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });

    assert.strictEqual(res.status, 200);

    const getRes = await fetch(`${baseUrl}/ai-documents/${testDocumentId}`, {
      headers: {
        Authorization: `Bearer ${user1Token}`,
      },
    });
    assert.strictEqual(getRes.status, 404);
  });
});
