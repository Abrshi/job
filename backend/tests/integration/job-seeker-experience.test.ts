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

describe('Job Seeker Experience Integration', () => {
  let server: http.Server;
  let baseUrl = '';

  let candidate1Id = '';
  let candidate1Token = '';
  let candidate2Id = '';
  let candidate2Token = '';
  let unverifiedCandidateId = '';
  let unverifiedCandidateToken = '';

  let testSourceId = '';
  let testCategoryId = '';
  let publicJobId = '';
  let internalJobId = '';
  let expiredJobId = '';
  let reviewPendingJobId = '';

  before(async () => {
    // 1. Start HTTP Server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 2. Setup Test Category & Source
    const testCat = await prisma.jobCategory.findUnique({
      where: { slug: 'software-it' },
    });
    assert.ok(testCat);
    testCategoryId = testCat.id;

    const testSource = await prisma.jobSource.upsert({
      where: { slug: 'seeker-integ-source' },
      update: {},
      create: {
        name: 'Seeker Test Source',
        slug: 'seeker-integ-source',
        endpointUrl: 'https://example.com/api',
        isActive: true,
        pollingInterval: 60,
      },
    });
    testSourceId = testSource.id;

    // 3. Setup Test Jobs
    // A. Normal Public External Job
    const jobA = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        categoryId: testCategoryId,
        externalId: 'job-seeker-ext-01',
        fingerprint: 'ext:job-seeker-ext-01',
        originalUrl: 'https://example.com/jobs/01',
        applicationUrl: 'https://example.com/apply/01',
        originalTitle: 'Frontend React Engineer',
        normalizedTitle: 'Frontend React Engineer',
        originalDescription: 'We are seeking a Frontend React Engineer with TypeScript skills.',
        normalizedDescription: 'We are seeking a Frontend React Engineer with TypeScript skills.',
        companyName: 'Tech Innovations PLC',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        isRemote: true,
        workArrangement: 'REMOTE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'MID',
        salaryMin: new Prisma.Decimal(45000),
        salaryMax: new Prisma.Decimal(65000),
        salaryCurrency: 'ETB',
        publishedAt: new Date(),
        status: 'ACTIVE',
        classificationStatus: 'CLASSIFIED',
        applicationMethod: 'EXTERNAL',
      },
    });
    publicJobId = jobA.id;

    // B. Internal Application Allowed Job
    const jobB = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        categoryId: testCategoryId,
        externalId: 'job-seeker-int-02',
        fingerprint: 'ext:job-seeker-int-02',
        originalUrl: 'https://example.com/jobs/02',
        originalTitle: 'Junior Data Analyst',
        normalizedTitle: 'Junior Data Analyst',
        originalDescription: 'Entry level data analysis and SQL reporting role.',
        normalizedDescription: 'Entry level data analysis and SQL reporting role.',
        companyName: 'Analytics Hub',
        city: 'Hawassa',
        country: 'Ethiopia',
        isRemote: false,
        workArrangement: 'ON_SITE',
        employmentType: 'FULL_TIME',
        experienceLevel: 'JUNIOR',
        salaryMin: new Prisma.Decimal(25000),
        salaryMax: new Prisma.Decimal(35000),
        salaryCurrency: 'ETB',
        publishedAt: new Date(),
        status: 'ACTIVE',
        classificationStatus: 'CLASSIFIED',
        applicationMethod: 'INTERNAL',
      },
    });
    internalJobId = jobB.id;

    // C. Expired Job
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const jobC = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        categoryId: testCategoryId,
        externalId: 'job-seeker-exp-03',
        fingerprint: 'ext:job-seeker-exp-03',
        originalUrl: 'https://example.com/jobs/03',
        originalTitle: 'Expired Systems Admin',
        normalizedTitle: 'Expired Systems Admin',
        originalDescription: 'Expired position description.',
        normalizedDescription: 'Expired position description.',
        companyName: 'Legacy Corp',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        publishedAt: pastDate,
        closingDate: pastDate,
        status: 'EXPIRED',
        classificationStatus: 'CLASSIFIED',
        applicationMethod: 'INTERNAL',
      },
    });
    expiredJobId = jobC.id;

    // D. Review Pending Job (Must be hidden from public)
    const jobD = await prisma.job.create({
      data: {
        sourceId: testSourceId,
        categoryId: testCategoryId,
        externalId: 'job-seeker-rev-04',
        fingerprint: 'ext:job-seeker-rev-04',
        originalUrl: 'https://example.com/jobs/04',
        originalTitle: 'Suspicious Job Post',
        normalizedTitle: 'Suspicious Job Post',
        originalDescription: 'Post requiring review.',
        normalizedDescription: 'Post requiring review.',
        companyName: 'Unknown LLC',
        status: 'ACTIVE',
        classificationStatus: 'REVIEW_REQUIRED',
        applicationMethod: 'EXTERNAL',
      },
    });
    reviewPendingJobId = jobD.id;

    // 4. Setup Test Candidates
    // Candidate 1 (Verified)
    const c1Email = `candidate1-${Date.now()}@test.com`;
    const cand1 = await prisma.user.create({
      data: {
        email: c1Email,
        passwordHash: await argon2.hash('testpass123'),
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    candidate1Id = cand1.id;
    candidate1Token = jwt.sign(
      { userId: cand1.id, email: cand1.email, role: cand1.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // Candidate 2 (Verified)
    const c2Email = `candidate2-${Date.now()}@test.com`;
    const cand2 = await prisma.user.create({
      data: {
        email: c2Email,
        passwordHash: await argon2.hash('testpass123'),
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });
    candidate2Id = cand2.id;
    candidate2Token = jwt.sign(
      { userId: cand2.id, email: cand2.email, role: cand2.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );

    // Candidate 3 (Unverified Email)
    const c3Email = `unverified-${Date.now()}@test.com`;
    const cand3 = await prisma.user.create({
      data: {
        email: c3Email,
        passwordHash: await argon2.hash('testpass123'),
        role: 'CANDIDATE',
        isEmailVerified: false,
      },
    });
    unverifiedCandidateId = cand3.id;
    unverifiedCandidateToken = jwt.sign(
      { userId: cand3.id, email: cand3.email, role: cand3.role, isEmailVerified: false },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    // Clean up created jobs and relations
    await prisma.jobApplication.deleteMany({
      where: { jobId: { in: [publicJobId, internalJobId, expiredJobId, reviewPendingJobId] } },
    });
    await prisma.savedJob.deleteMany({
      where: { jobId: { in: [publicJobId, internalJobId, expiredJobId, reviewPendingJobId] } },
    });
    await prisma.job.deleteMany({
      where: { id: { in: [publicJobId, internalJobId, expiredJobId, reviewPendingJobId] } },
    });
    await prisma.jobSource.deleteMany({ where: { id: testSourceId } });

    // Clean up users & profiles
    await prisma.userProfile.deleteMany({
      where: { userId: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [candidate1Id, candidate2Id, unverifiedCandidateId] } },
    });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await prisma.$disconnect();
  });

  // 1. Public Browsing & Search
  describe('Public Job Discovery API', () => {
    it('allows public visitor to browse jobs without authentication', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs?limit=10`);
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.status, 'success');
      assert.ok(Array.isArray(json.data.jobs));
      assert.ok(json.data.total >= 1);
      assert.strictEqual(json.data.page, 1);

      // Verify that REVIEW_REQUIRED job is excluded from public results
      const hasReviewPending = json.data.jobs.some((j: any) => j.id === reviewPendingJobId);
      assert.strictEqual(hasReviewPending, false);

      // Verify that EXPIRED job is excluded from active public results
      const hasExpired = json.data.jobs.some((j: any) => j.id === expiredJobId);
      assert.strictEqual(hasExpired, false);
    });

    it('filters jobs by keyword search across title, company, description', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs?search=Frontend+React`);
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.ok(json.data.jobs.length >= 1);
      const found = json.data.jobs.find((j: any) => j.id === publicJobId);
      assert.ok(found);
      assert.strictEqual(found.title, 'Frontend React Engineer');
    });

    it('filters jobs by work arrangement and minimum salary', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs?workArrangement=REMOTE&minSalary=40000`);
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      const allRemoteAndWellPaid = json.data.jobs.every(
        (j: any) => j.workArrangement === 'REMOTE' && (Number(j.salaryMin) >= 40000 || Number(j.salaryMax) >= 40000)
      );
      assert.ok(allRemoteAndWellPaid);
    });

    it('returns categories with active job counts', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/categories`);
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(json.data.categories));
      const testCat = json.data.categories.find((c: any) => c.slug === 'software-it');
      assert.ok(testCat);
      assert.ok(typeof testCat.jobCount === 'number');
    });

    it('returns single job details and hides sensitive internals', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}`);
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.job.id, publicJobId);
      assert.strictEqual(json.data.job.title, 'Frontend React Engineer');
      assert.strictEqual(json.data.job.isRemote, true);
      assert.strictEqual(json.data.job.applicationMethod, 'EXTERNAL');

      // Internal secrets / headers / rawPayload must not be leaked
      assert.strictEqual(json.data.job.rawPayload, undefined);
      assert.strictEqual(json.data.job.source.headers, undefined);
    });

    it('returns 404 for nonexistent job ID', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/nonexistent-uuid-999`);
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 404);
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'JOB_NOT_FOUND');
    });

    it('hides jobs awaiting moderation review from public view with 404', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${reviewPendingJobId}`);
      assert.strictEqual(res.status, 404);
    });
  });

  // 2. Saved Jobs Lifecycle
  describe('Saved Jobs Operations', () => {
    it('rejects unauthenticated requests to save a job with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}/save`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 401);
    });

    it('allows authenticated candidate to save and list a job', async () => {
      // 1. Save job
      const saveRes = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const saveJson = (await saveRes.json()) as any;

      assert.strictEqual(saveRes.status, 200);
      assert.strictEqual(saveJson.status, 'success');
      assert.strictEqual(saveJson.data.saved, true);

      // 2. List saved jobs
      const listRes = await fetch(`${baseUrl}/api/v1/jobs/saved`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const listJson = (await listRes.json()) as any;

      assert.strictEqual(listRes.status, 200);
      assert.ok(listJson.data.jobs.length >= 1);
      const isPresent = listJson.data.jobs.some((j: any) => j.id === publicJobId);
      assert.strictEqual(isPresent, true);

      // 3. GET /jobs/:id with candidate token indicates isSaved: true
      const getRes = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const getJson = (await getRes.json()) as any;
      assert.strictEqual(getJson.data.job.isSaved, true);
    });

    it('enforces ownership: candidate 2 cannot see candidate 1 saved jobs', async () => {
      const listRes = await fetch(`${baseUrl}/api/v1/jobs/saved`, {
        headers: { Authorization: `Bearer ${candidate2Token}` },
      });
      const listJson = (await listRes.json()) as any;

      assert.strictEqual(listRes.status, 200);
      const hasJob = listJson.data.jobs.some((j: any) => j.id === publicJobId);
      assert.strictEqual(hasJob, false);
    });

    it('allows candidate to unsave a job idempotently', async () => {
      const unsaveRes = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}/save`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const unsaveJson = (await unsaveRes.json()) as any;

      assert.strictEqual(unsaveRes.status, 200);
      assert.strictEqual(unsaveJson.data.saved, false);

      // Verify removed from saved list
      const listRes = await fetch(`${baseUrl}/api/v1/jobs/saved`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const listJson = (await listRes.json()) as any;
      const isPresent = listJson.data.jobs.some((j: any) => j.id === publicJobId);
      assert.strictEqual(isPresent, false);
    });
  });

  // 3. Applications Handling
  describe('Internal vs External Applications', () => {
    it('rejects internal application submission for external-only jobs with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${publicJobId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverNote: 'I want to apply internally' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'EXTERNAL_APPLICATION_REQUIRED');
    });

    it('rejects application submission from unverified email accounts with 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${internalJobId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${unverifiedCandidateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverNote: 'Test application' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 403);
      assert.strictEqual(json.error.code, 'EMAIL_NOT_VERIFIED');
    });

    it('allows verified candidate to submit application for internal jobs', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${internalJobId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverNote: 'Experienced analyst with SQL & Python experience.' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.status, 'APPLIED');
      assert.strictEqual(json.data.jobTitle, 'Junior Data Analyst');

      // Verify in candidate applications list
      const appListRes = await fetch(`${baseUrl}/api/v1/jobs/applications`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const appListJson = (await appListRes.json()) as any;

      assert.strictEqual(appListRes.status, 200);
      assert.ok(appListJson.data.applications.length >= 1);
      const app = appListJson.data.applications.find((a: any) => a.job.id === internalJobId);
      assert.ok(app);
      assert.strictEqual(app.status, 'APPLIED');
    });

    it('prevents duplicate applications for the same job and user with 409', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${internalJobId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverNote: 'Second duplicate attempt' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 409);
      assert.strictEqual(json.error.code, 'APPLICATION_ALREADY_EXISTS');
    });

    it('rejects applications for expired jobs with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${expiredJobId}/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate2Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coverNote: 'Applying to expired job' }),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 400);
      assert.ok(['JOB_DEADLINE_PASSED', 'JOB_INACTIVE'].includes(json.error.code));
    });
  });

  // 4. Seeker Profile and Preferences
  describe('Profile & Career Preferences API', () => {
    it('retrieves user profile and auto-initializes profile record', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.profile.id, candidate1Id);
      assert.strictEqual(json.data.profile.isEmailVerified, true);
    });

    it('updates permitted profile fields and preferences persistently', async () => {
      const updatePayload = {
        displayName: 'Abebe Bikila',
        headline: 'Senior Mobile Engineer',
        country: 'Ethiopia',
        city: 'Addis Ababa',
        preferredWorkArrangement: 'REMOTE',
        preferredEmploymentType: 'FULL_TIME',
        preferredExperienceLevel: 'SENIOR',
        minSalary: 55000,
        salaryCurrency: 'ETB',
        preferredCategories: ['software-it', 'engineering-architecture'],
      };

      const res = await fetch(`${baseUrl}/api/v1/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.profile.displayName, 'Abebe Bikila');
      assert.strictEqual(json.data.profile.headline, 'Senior Mobile Engineer');
      assert.strictEqual(json.data.profile.preferredWorkArrangement, 'REMOTE');
      assert.strictEqual(json.data.profile.minSalary, 55000);
      assert.deepStrictEqual(json.data.profile.preferredCategories, [
        'software-it',
        'engineering-architecture',
      ]);
    });

    it('prevents mass assignment of privileged fields (role, isEmailVerified)', async () => {
      const maliciousPayload = {
        displayName: 'Hacker',
        role: 'ADMIN',
        isEmailVerified: true,
      };

      const res = await fetch(`${baseUrl}/api/v1/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(maliciousPayload),
      });
      const json = (await res.json()) as any;

      // Zod strict schema rejects unexpected keys with VALIDATION_ERROR
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');

      // Verify candidate1 is still CANDIDATE
      const checkUser = await prisma.user.findUnique({ where: { id: candidate1Id } });
      assert.strictEqual(checkUser?.role, 'CANDIDATE');
    });
  });
});
