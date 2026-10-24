import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';

describe('CV-First Onboarding, Documents, and Comprehensive Profiles Integration', () => {
  let server: http.Server;
  let baseUrl = '';

  let candidate1Id = '';
  let candidate1Token = '';
  let candidate2Id = '';
  let candidate2Token = '';

  let uploadedDocId = '';

  // Minimal valid PDF buffer
  const samplePdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF'
  );

  before(async () => {
    // 1. Start HTTP test server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 2. Setup Candidate 1
    const cand1 = await prisma.user.create({
      data: {
        email: `cv-candidate1-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('password123'),
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

    // 3. Setup Candidate 2 (for authorization and ownership checks)
    const cand2 = await prisma.user.create({
      data: {
        email: `cv-candidate2-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('password123'),
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
  });

  after(async () => {
    // Cleanup documents
    await prisma.userDocument.deleteMany({
      where: { userId: { in: [candidate1Id, candidate2Id] } },
    });

    // Cleanup relational profile sections
    const profiles = await prisma.userProfile.findMany({
      where: { userId: { in: [candidate1Id, candidate2Id] } },
      select: { id: true },
    });
    const profileIds = profiles.map((p) => p.id);

    await prisma.profileExperience.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileEducation.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileCertification.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileProject.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileSkill.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileLanguage.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.profileAchievement.deleteMany({ where: { profileId: { in: profileIds } } });
    await prisma.userProfile.deleteMany({ where: { id: { in: profileIds } } });

    await prisma.user.deleteMany({
      where: { id: { in: [candidate1Id, candidate2Id] } },
    });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    await prisma.$disconnect();
  });

  // ==========================================
  // 1. Document Upload & Validation
  // ==========================================
  describe('Document Upload & Security Validations', () => {
    it('rejects unauthenticated document uploads with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
      });
      assert.strictEqual(res.status, 401);
    });

    it('rejects uploads without a file with 400', async () => {
      const form = new FormData();
      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
        body: form,
      });
      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'FILE_REQUIRED');
    });

    it('rejects unsupported file formats (e.g. .exe / .sh) with 400', async () => {
      const form = new FormData();
      const badBlob = new Blob(['malicious payload'], { type: 'application/x-sh' });
      form.append('file', badBlob, 'script.sh');

      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
        body: form,
      });
      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'UNSUPPORTED_FORMAT');
    });

    it('rejects corrupted PDF file signature with 400', async () => {
      const form = new FormData();
      const corruptBlob = new Blob(['not a real pdf content'], { type: 'application/pdf' });
      form.append('file', corruptBlob, 'corrupted.pdf');

      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
        body: form,
      });
      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'INVALID_SIGNATURE');
    });

    it('accepts valid PDF, securely stores in Drive, and extracts metadata', async () => {
      const form = new FormData();
      const pdfBlob = new Blob([samplePdfBuffer], { type: 'application/pdf' });
      form.append('file', pdfBlob, 'resume.pdf');

      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${candidate1Token}` },
        body: form,
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.status, 'success');
      assert.ok(json.data.document.id);
      assert.strictEqual(json.data.document.originalFilename, 'resume.pdf');
      assert.strictEqual(json.data.document.mimeType, 'application/pdf');
      assert.strictEqual(json.data.document.processingStatus, 'COMPLETED');
      assert.ok(json.data.document.fileChecksum);

      uploadedDocId = json.data.document.id;
    });
  });

  // ==========================================
  // 2. Document Access, Ownership, and Download
  // ==========================================
  describe('Document Ownership and Download Controls', () => {
    it('allows owner to list uploaded documents', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(json.data.documents));
      assert.ok(json.data.documents.length >= 1);
      assert.strictEqual(json.data.documents[0].id, uploadedDocId);
    });

    it('enforces ownership: candidate 2 cannot view or download candidate 1 document', async () => {
      // 1. Details access
      const getRes = await fetch(`${baseUrl}/api/v1/documents/${uploadedDocId}`, {
        headers: { Authorization: `Bearer ${candidate2Token}` },
      });
      assert.strictEqual(getRes.status, 403);

      // 2. Download access
      const dlRes = await fetch(`${baseUrl}/api/v1/documents/${uploadedDocId}/download`, {
        headers: { Authorization: `Bearer ${candidate2Token}` },
      });
      assert.strictEqual(dlRes.status, 403);
    });

    it('allows owner to download the original document stream', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${uploadedDocId}/download`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
      assert.ok(res.headers.get('content-disposition')?.includes('resume.pdf'));
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.strictEqual(buffer.length, samplePdfBuffer.length);
    });
  });

  // ==========================================
  // 3. Confirm Extracted Profile & Relational Import
  // ==========================================
  describe('Confirm Extracted Profile & Relational Storage', () => {
    it('imports reviewed and confirmed CV data into relational profile tables', async () => {
      const payload = {
        personal: {
          fullName: 'Abebe Bikila',
          headline: 'Senior Full Stack TypeScript Architect',
          phoneNumber: '+251911223344',
          professionalEmail: 'abebe.pro@example.com',
          city: 'Addis Ababa',
          country: 'Ethiopia',
          summary: 'Experienced software engineer specializing in scalable distributed web systems.',
          linkedInUrl: 'https://linkedin.com/in/abebe-bikila',
          githubUrl: 'https://github.com/abebe',
        },
        experiences: [
          {
            companyName: 'FinTech Solutions PLC',
            jobTitle: 'Senior Software Engineer',
            employmentType: 'FULL_TIME',
            location: 'Addis Ababa',
            startYear: 2021,
            startMonth: 3,
            isCurrent: true,
            description: 'Lead engineering on core payment processing service.',
            responsibilities: ['Architecture design', 'Code review'],
            skillsUsed: ['TypeScript', 'Node.js', 'PostgreSQL'],
          },
        ],
        educations: [
          {
            institution: 'Addis Ababa University',
            degree: 'B.Sc. in Computer Science',
            fieldOfStudy: 'Computer Science',
            startYear: 2016,
            endYear: 2020,
            isCurrent: false,
            grade: '3.85',
          },
        ],
        certifications: [
          {
            name: 'AWS Certified Solutions Architect',
            issuingOrganization: 'Amazon Web Services',
            type: 'CERTIFICATION',
            issueYear: 2023,
          },
        ],
        projects: [
          {
            name: 'OpenJob Aggregator',
            role: 'Lead Developer',
            description: 'Modern open source job aggregation portal.',
            technologies: ['Next.js', 'Express', 'Prisma'],
            liveUrl: 'https://example.com/demo',
          },
        ],
        skills: [
          { name: 'TypeScript', category: 'Programming Language', proficiency: 'EXPERT' },
          { name: 'React', category: 'Frontend', proficiency: 'ADVANCED' },
          { name: 'Node.js', category: 'Backend', proficiency: 'EXPERT' },
        ],
        languages: [
          { name: 'English', proficiency: 'FLUENT' },
          { name: 'Amharic', proficiency: 'NATIVE' },
        ],
        achievements: [
          {
            title: 'National Coding Championship Winner',
            organization: 'Ministry of Innovation & Technology',
            year: 2022,
          },
        ],
        jobPreferences: {
          preferredWorkArrangement: 'HYBRID',
          preferredEmploymentType: 'FULL_TIME',
          minSalary: 80000,
          preferredJobTitles: ['Senior Software Engineer', 'Lead Developer'],
        },
        onboardingCompleted: true,
      };

      const res = await fetch(`${baseUrl}/api/v1/profile/confirm-cv`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');
      assert.strictEqual(json.data.profile.displayName, 'Abebe Bikila');
      assert.strictEqual(json.data.profile.onboardingCompleted, true);

      // Verify relational records created
      assert.strictEqual(json.data.profile.experiences.length, 1);
      assert.strictEqual(json.data.profile.experiences[0].companyName, 'FinTech Solutions PLC');
      assert.strictEqual(json.data.profile.experiences[0].provenance, 'CV_EXTRACTED');

      assert.strictEqual(json.data.profile.educations.length, 1);
      assert.strictEqual(json.data.profile.educations[0].institution, 'Addis Ababa University');

      assert.strictEqual(json.data.profile.skills.length, 3);
      assert.strictEqual(json.data.profile.projects.length, 1);
      assert.strictEqual(json.data.profile.certifications.length, 1);
      assert.strictEqual(json.data.profile.languages.length, 2);
      assert.strictEqual(json.data.profile.achievements.length, 1);

      // Verify profile completion score
      assert.ok(json.data.profile.completionPercentage >= 90);
      assert.strictEqual(json.data.profile.completion.isComplete, true);
    });
  });

  // ==========================================
  // 4. Section-Based CRUD & Provenance Preservation
  // ==========================================
  describe('Section-Based Profile CRUD & Safeguards', () => {
    let expId = '';

    it('allows candidate to add an experience entry manually', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile/experiences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: 'Previous Tech Corp',
          jobTitle: 'Junior Frontend Developer',
          employmentType: 'FULL_TIME',
          startYear: 2020,
          endYear: 2021,
          isCurrent: false,
          description: 'Frontend UI development using React.',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 201);
      assert.strictEqual(json.data.experience.companyName, 'Previous Tech Corp');
      assert.strictEqual(json.data.experience.provenance, 'MANUAL');
      expId = json.data.experience.id;
    });

    it('allows candidate to update their experience entry', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile/experiences/${expId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle: 'Mid Frontend Developer',
        }),
      });

      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.data.experience.jobTitle, 'Mid Frontend Developer');
    });

    it('enforces ownership: candidate 2 cannot delete candidate 1 experience entry', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile/experiences/${expId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate2Token}` },
      });
      assert.strictEqual(res.status, 404);
    });

    it('allows candidate to delete their experience entry', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile/experiences/${expId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      assert.strictEqual(res.status, 200);
    });

    it('strictly prevents mass-assignment of privileged fields (role, isEmailVerified)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${candidate1Token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'ADMIN',
          isEmailVerified: true,
        }),
      });
      const json = (await res.json()) as any;
      assert.strictEqual(res.status, 400);
      assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    });
  });

  // ==========================================
  // 5. Document Deletion
  // ==========================================
  describe('Document Deletion', () => {
    it('allows owner to delete document and removes storage record', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${uploadedDocId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      const json = (await res.json()) as any;

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.status, 'success');

      // Verify document is deleted
      const checkRes = await fetch(`${baseUrl}/api/v1/documents/${uploadedDocId}`, {
        headers: { Authorization: `Bearer ${candidate1Token}` },
      });
      assert.strictEqual(checkRes.status, 404);
    });
  });
});

