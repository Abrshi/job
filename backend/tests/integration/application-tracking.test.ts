import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';
import { Prisma } from '@prisma/client';

describe('Application Tracking System Integration Tests', () => {
  let server: http.Server;
  let baseUrl = '';

  let candidate1Id = '';
  let candidate1Token = '';
  let candidate2Id = '';
  let candidate2Token = '';
  let unverifiedCandidateId = '';
  let unverifiedCandidateToken = '';

  let testDocumentId = '';
  let platformJobId = '';
  let expiredJobId = '';
  let createdPlatformAppId = '';
  let createdExternalAppId = '';
  let draftAppId = '';

  before(async () => {
    // 1. Start HTTP Server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const passwordHash = await argon2.hash('TestPassword123!');

    // 2. Setup Candidates
    const cand1 = await prisma.user.create({
      data: {
        email: `ats-cand1-${Date.now()}@example.com`,
        passwordHash,
        firstName: 'ATS',
        lastName: 'Candidate One',
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    candidate1Id = cand1.id;
    candidate1Token = jwt.sign(
      { userId: cand1.id, role: cand1.role, email: cand1.email, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    const cand2 = await prisma.user.create({
      data: {
        email: `ats-cand2-${Date.now()}@example.com`,
        passwordHash,
        firstName: 'ATS',
        lastName: 'Candidate Two',
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    candidate2Id = cand2.id;
    candidate2Token = jwt.sign(
      { userId: cand2.id, role: cand2.role, email: cand2.email, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    const unverified = await prisma.user.create({
      data: {
        email: `ats-unver-${Date.now()}@example.com`,
        passwordHash,
        firstName: 'Unverified',
        lastName: 'Candidate',
        role: 'CANDIDATE',
        isEmailVerified: false,
      },
    });
    unverifiedCandidateId = unverified.id;
    unverifiedCandidateToken = jwt.sign(
      { userId: unverified.id, role: unverified.role, email: unverified.email, isEmailVerified: false },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Setup Test User Document (CV)
    const doc = await prisma.userDocument.create({
      data: {
        userId: candidate1Id,
        documentType: 'CV',
        originalFilename: 'Abrsh_FullStack_2026.pdf',
        mimeType: 'application/pdf',
        fileSize: 204800,
        driveFileId: 'mock-google-drive-file-id-123',
        storageProvider: 'GOOGLE_DRIVE',
        fileChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    });
    testDocumentId = doc.id;

    // 4. Setup Test Source & Category & Jobs
    const cat = await prisma.jobCategory.findFirst();
    const source = await prisma.jobSource.findFirst();

    const job = await prisma.job.create({
      data: {
        sourceId: source!.id,
        categoryId: cat!.id,
        externalId: `ats-plat-${Date.now()}`,
        fingerprint: `fingerprint:ats-plat-${Date.now()}`,
        originalUrl: 'https://example.com/ats-platform-job',
        originalTitle: 'Principal Cloud Architect',
        normalizedTitle: 'Principal Cloud Architect',
        originalDescription: 'We are looking for a Principal Cloud Architect with AWS and Kubernetes expertise.',
        normalizedDescription: 'We are looking for a Principal Cloud Architect with AWS and Kubernetes expertise.',
        companyName: 'EthioCloud PLC',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        workArrangement: 'HYBRID',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        classificationStatus: 'CLASSIFIED',
        applicationMethod: 'INTERNAL',
      },
    });
    platformJobId = job.id;

    const expJob = await prisma.job.create({
      data: {
        sourceId: source!.id,
        categoryId: cat!.id,
        externalId: `ats-exp-${Date.now()}`,
        fingerprint: `fingerprint:ats-exp-${Date.now()}`,
        originalUrl: 'https://example.com/ats-expired-job',
        originalTitle: 'Legacy Cobol Programmer',
        normalizedTitle: 'Legacy Cobol Programmer',
        originalDescription: 'Archived posting.',
        normalizedDescription: 'Archived posting.',
        companyName: 'Old Systems Inc',
        status: 'EXPIRED',
        classificationStatus: 'CLASSIFIED',
      },
    });
    expiredJobId = expJob.id;
  });

  after(async () => {
    // Cleanup created test records
    await prisma.jobApplicationReminder.deleteMany({
      where: { application: { userId: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } } },
    });
    await prisma.jobApplicationInterview.deleteMany({
      where: { application: { userId: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } } },
    });
    await prisma.jobApplicationHistory.deleteMany({
      where: { changedByUserId: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } },
    });
    await prisma.jobApplication.deleteMany({
      where: { userId: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } },
    });
    await prisma.userDocument.deleteMany({
      where: { userId: { in: [candidate1Id, candidate2Id] } },
    });
    await prisma.job.deleteMany({
      where: { id: { in: [platformJobId, expiredJobId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } },
    });

    if (server) {
      server.close();
    }
  });

  describe('1. Platform Application Submission & Safeguards', () => {
    it('rejects platform application submission for unverified candidate with 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${unverifiedCandidateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'PLATFORM',
          jobId: platformJobId,
          status: 'APPLIED',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 403);
      assert.strictEqual(json.error.code, 'EMAIL_NOT_VERIFIED');
    });

    it('submits platform application with document snapshot and history', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'PLATFORM',
          jobId: platformJobId,
          status: 'APPLIED',
          documentId: testDocumentId,
          coverNoteText: 'I have 10+ years designing enterprise cloud architectures.',
          notes: 'Referred by senior director.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.id);
      assert.strictEqual(json.data.status, 'APPLIED');
      assert.strictEqual(json.data.jobTitle, 'Principal Cloud Architect');
      assert.strictEqual(json.data.companyName, 'EthioCloud PLC');

      createdPlatformAppId = json.data.id;

      // Verify DB record captured snapshots
      const record = await prisma.jobApplication.findUnique({
        where: { id: createdPlatformAppId },
        include: { history: true },
      });
      assert.ok(record);
      assert.strictEqual(record.documentSnapshotFilename, 'Abrsh_FullStack_2026.pdf');
      assert.strictEqual(record.documentSnapshotChecksum, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      assert.strictEqual(record.activeKey, `${candidate1Id}_${platformJobId}`);
      assert.strictEqual(record.history.length, 1);
      assert.strictEqual(record.history[0].toStatus, 'APPLIED');
    });

    it('rejects duplicate active platform application for the same job with 409', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'PLATFORM',
          jobId: platformJobId,
          status: 'APPLIED',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 409);
      assert.strictEqual(json.error.code, 'APPLICATION_ALREADY_EXISTS');
    });

    it('rejects application for expired job with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'PLATFORM',
          jobId: expiredJobId,
          status: 'APPLIED',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'JOB_INACTIVE');
    });
  });

  describe('2. External Application Tracking', () => {
    it('creates external application with valid metadata', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'EXTERNAL',
          externalCompanyName: 'Google DeepMind',
          externalJobTitle: 'Research Scientist',
          externalJobUrl: 'https://careers.google.com/jobs/results/12345',
          externalLocation: 'London, UK / Remote',
          externalSalary: '£120,000 - £150,000',
          status: 'APPLIED',
          notes: 'Submitted directly through Google Careers portal.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.source, 'EXTERNAL');
      assert.strictEqual(json.data.companyName, 'Google DeepMind');
      assert.strictEqual(json.data.jobTitle, 'Research Scientist');

      createdExternalAppId = json.data.id;
    });

    it('prevents accidental duplicate external application for identical company and title with 409', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'EXTERNAL',
          externalCompanyName: 'Google DeepMind',
          externalJobTitle: 'Research Scientist',
          status: 'APPLIED',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 409);
      assert.strictEqual(json.error.code, 'APPLICATION_ALREADY_EXISTS');
    });

    it('rejects external application with SSRF/loopback URL', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'EXTERNAL',
          externalCompanyName: 'Malicious Corp',
          externalJobTitle: 'Security Tester',
          externalJobUrl: 'http://169.254.169.254/latest/meta-data',
        }),
      });

      assert.strictEqual(res.status, 400);
    });
  });

  describe('3. Draft Lifecycle & Deletion Safeguards', () => {
    it('creates a draft application', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'EXTERNAL',
          externalCompanyName: 'Stripe',
          externalJobTitle: 'Staff Backend Engineer',
          status: 'DRAFT',
          notes: 'Drafting cover letter.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.data.status, 'DRAFT');
      draftAppId = json.data.id;
    });

    it('allows physical deletion of DRAFT applications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${draftAppId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');

      // Verify deletion from DB
      const record = await prisma.jobApplication.findUnique({
        where: { id: draftAppId },
      });
      assert.strictEqual(record, null);
    });

    it('strictly forbids physical deletion of SUBMITTED applications with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'CANNOT_DELETE_SUBMITTED_APPLICATION');
    });
  });

  describe('4. Status Transitions, State Machine & Mistake Corrections', () => {
    it('rejects invalid state machine jump (APPLIED -> OFFER) with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'OFFER' }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'INVALID_STATUS_TRANSITION');
    });

    it('advances status from APPLIED -> IN_REVIEW with audit history', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'IN_REVIEW',
          reason: 'Received confirmation email that recruiter is screening profile.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.status, 'IN_REVIEW');

      // Check history
      const history = await prisma.jobApplicationHistory.findMany({
        where: { applicationId: createdPlatformAppId },
        orderBy: { createdAt: 'desc' },
      });
      assert.strictEqual(history[0].fromStatus, 'APPLIED');
      assert.strictEqual(history[0].toStatus, 'IN_REVIEW');
    });

    it('advances status from IN_REVIEW -> INTERVIEW', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'INTERVIEW',
          reason: 'Invited to first round interview.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.status, 'INTERVIEW');
    });

    it('advances status from INTERVIEW -> OFFER', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'OFFER',
          reason: 'Received written offer package.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.status, 'OFFER');
    });

    it('allows voluntary withdrawal of application', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/withdraw`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Accepted another competing offer.' }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.status, 'WITHDRAWN');

      // Verify activeKey was cleared so candidate can reapply later
      const record = await prisma.jobApplication.findUnique({
        where: { id: createdPlatformAppId },
      });
      assert.strictEqual(record!.activeKey, null);
    });

    it('permits mistake correction from WITHDRAWN back to APPLIED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'APPLIED',
          reason: 'Accidental click on withdraw; restoring status.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.status, 'APPLIED');
    });
  });

  describe('5. Reapplication After Withdrawal', () => {
    it('withdraws first application and allows submitting a fresh application to the same job', async () => {
      // 1. Withdraw again
      await fetch(`${baseUrl}/api/v1/applications/${createdPlatformAppId}/withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      // 2. Submit new application for the same platform job
      const res = await fetch(`${baseUrl}/api/v1/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'PLATFORM',
          jobId: platformJobId,
          status: 'APPLIED',
          coverNoteText: 'Re-submitting updated application after role reopening.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.ok(json.data.id !== createdPlatformAppId);
      assert.strictEqual(json.data.status, 'APPLIED');

      // Verify both applications exist in database for this user
      const userApps = await prisma.jobApplication.findMany({
        where: { userId: candidate1Id, jobId: platformJobId },
        orderBy: { createdAt: 'asc' },
      });
      assert.strictEqual(userApps.length, 2);
      assert.strictEqual(userApps[0].status, 'WITHDRAWN');
      assert.strictEqual(userApps[1].status, 'APPLIED');
    });
  });

  describe('6. Multi-Round Interview Tracking', () => {
    let interviewId = '';

    it('schedules Round 1 interview and updates application status', async () => {
      const interviewTime = new Date(Date.now() + 86400000 * 3).toISOString(); // 3 days in future

      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}/interviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roundNumber: 1,
          title: 'Technical Screen with Staff Scientist',
          interviewType: 'VIDEO',
          scheduledAt: interviewTime,
          timezone: 'Africa/Addis_Ababa',
          durationMinutes: 45,
          locationUrl: 'https://meet.google.com/xyz-uvwx-rst',
          interviewerInfo: 'Dr. Demis Hassabis (Lead Investigator)',
          preparationNotes: 'Review reinforcement learning and neural dynamics.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.roundNumber, 1);
      assert.strictEqual(json.data.title, 'Technical Screen with Staff Scientist');

      interviewId = json.data.id;

      // Verify application status auto-advanced to INTERVIEW
      const appRecord = await prisma.jobApplication.findUnique({
        where: { id: createdExternalAppId },
      });
      assert.strictEqual(appRecord!.status, 'INTERVIEW');
    });

    it('updates interview round details and marks outcome as PASSED', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/applications/${createdExternalAppId}/interviews/${interviewId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${candidate1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feedbackNotes: 'Went exceptionally well; answered all algorithmic questions.',
            outcome: 'PASSED',
          }),
        }
      );

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.outcome, 'PASSED');
      assert.ok(json.data.feedbackNotes.includes('exceptionally well'));
    });

    it('schedules Round 2 interview', async () => {
      const interviewTime = new Date(Date.now() + 86400000 * 7).toISOString();

      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}/interviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'System Design and Deep Learning Architecture',
          interviewType: 'VIDEO',
          scheduledAt: interviewTime,
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.data.roundNumber, 2);
    });

    it('deletes an interview round', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/applications/${createdExternalAppId}/interviews/${interviewId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${candidate1Token}` },
        }
      );

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
    });
  });

  describe('7. Standalone Follow-up Reminders', () => {
    let reminderId = '';

    it('creates a follow-up reminder', async () => {
      const remindTime = new Date(Date.now() + 86400000).toISOString();

      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}/reminders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Send thank you email to panel',
          remindAt: remindTime,
          notes: 'Highlight discussion about distributed attention mechanisms.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.data.title, 'Send thank you email to panel');
      assert.strictEqual(json.data.isCompleted, false);

      reminderId = json.data.id;
    });

    it('marks reminder as completed', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/applications/${createdExternalAppId}/reminders/${reminderId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${candidate1Token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isCompleted: true }),
        }
      );

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.isCompleted, true);
      assert.ok(json.data.completedAt);
    });

    it('deletes a reminder', async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/applications/${createdExternalAppId}/reminders/${reminderId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${candidate1Token}` },
        }
      );

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
    });
  });

  describe('8. Aggregate Stats, Search, Filters and Listing', () => {
    it('retrieves summary statistics for candidate dashboard', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/stats`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.totalApplications >= 2);
      assert.ok(json.data.activeApplications >= 1);
      assert.ok('byStatus' in json.data);
      assert.ok('bySource' in json.data);
    });

    it('lists applications with search query and status filter', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications?search=DeepMind&source=EXTERNAL`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.applications.length >= 1);
      assert.strictEqual(json.data.applications[0].companyName, 'Google DeepMind');
      assert.strictEqual(json.data.applications[0].source, 'EXTERNAL');
    });

    it('retrieves single application details by ID', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.id, createdExternalAppId);
      assert.ok(Array.isArray(json.data.history));
      assert.ok(Array.isArray(json.data.interviews));
    });
  });

  describe('9. Strict Ownership and Authorization Isolation', () => {
    it('candidate 2 cannot view candidate 1 application details (404)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}`, {
        headers: { Authorization: `Bearer ${candidate2Token}` },
      });

      assert.strictEqual(res.status, 404);
    });

    it('candidate 2 cannot update candidate 1 application status (404)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'REJECTED' }),
      });

      assert.strictEqual(res.status, 404);
    });

    it('candidate 2 cannot schedule interview for candidate 1 application (404)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/applications/${createdExternalAppId}/interviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Hacked Interview',
          scheduledAt: new Date().toISOString(),
        }),
      });

      assert.strictEqual(res.status, 404);
    });
  });
});
