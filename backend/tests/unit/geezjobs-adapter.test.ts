import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { geezJobsAdapter, GeezJobsAdapter } from '../../src/modules/sources/adapters/geezjobs.adapter';
import { adapterRegistry } from '../../src/modules/sources/adapters/adapter.registry';
import { JobSource } from '@prisma/client';

describe('GeezJobsAdapter Unit Tests', () => {
  const dummySource: JobSource = {
    id: 'src-geez-001',
    name: 'GeezJobs',
    slug: 'geezjobs',
    type: 'SCRAPER',
    endpointUrl: 'https://geezjobs.com/search-jobs',
    isActive: true,
    pollingInterval: 120,
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    headers: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('is registered in AdapterRegistry with slug geezjobs', () => {
    assert.strictEqual(adapterRegistry.has('geezjobs'), true);
    const resolved = adapterRegistry.get('geezjobs');
    assert.strictEqual(resolved.slug, 'geezjobs');
    assert.strictEqual(resolved.name, 'GeezJobs');
  });

  it('correctly parses search page HTML fixture', () => {
    const fixturePath = path.join(__dirname, '../fixtures/geezjobs-page.html');
    const searchHtml = fs.readFileSync(fixturePath, 'utf8');

    const { cards, hasMore } = geezJobsAdapter.parseSearchPage(searchHtml);
    assert.ok(cards.length > 0, 'Should find job cards in search page fixture');
    assert.strictEqual(hasMore, true);

    const firstCard = cards[0];
    assert.ok(firstCard.url.includes('import-and-export-operations-officer'));
    assert.strictEqual(firstCard.slug, 'import-and-export-operations-officer-geezjobs-recruitment-department');
    assert.strictEqual(firstCard.title, 'Import & Export Operations Officer');
    assert.strictEqual(firstCard.company, 'GeezJobs (Recruitment Department)');
    assert.strictEqual(firstCard.deadline, 'October 31, 2026');
    assert.strictEqual(firstCard.employmentType, 'Full-time / Permanent');
    assert.strictEqual(firstCard.experience, '2-6 years');
  });

  it('correctly parses detail page HTML fixture with full Schema.org JSON-LD', () => {
    const fixturePath = path.join(__dirname, '../fixtures/geezjobs-detail.html');
    const detailHtml = fs.readFileSync(fixturePath, 'utf8');

    const rawPosting = geezJobsAdapter.parseDetailPage(detailHtml, {
      url: 'https://geezjobs.com/job-detail/import-and-export-operations-officer-geezjobs-recruitment-department',
      slug: 'import-and-export-operations-officer-geezjobs-recruitment-department',
      title: 'Import & Export Operations Officer',
      company: 'GeezJobs (Recruitment Department)',
      experience: '2-6 years',
    });

    assert.strictEqual(rawPosting.externalId, 'import-and-export-operations-officer-geezjobs-recruitment-department');
    assert.strictEqual(rawPosting.title, 'Import & Export Operations Officer');
    assert.ok(!rawPosting.title.toLowerCase().includes('via geezjobs'), 'Should strip "via GeezJobs" suffix');
    assert.ok(rawPosting.description.includes('Job Summary'));
    assert.ok(rawPosting.description.includes('Bachelor’s or Master'));
    assert.strictEqual(rawPosting.companyName, 'GeezJobs (Recruitment Department)');
    assert.strictEqual(rawPosting.city, 'Addis Ababa');
    assert.strictEqual(rawPosting.country, 'Ethiopia');
    assert.strictEqual(rawPosting.employmentType, 'FULL_TIME');
    assert.strictEqual(rawPosting.experienceLevel, 'MID');
    assert.strictEqual(rawPosting.salaryMin, 5000);
    assert.strictEqual(rawPosting.salaryMax, 100000);
    assert.strictEqual(rawPosting.salaryCurrency, 'ETB');
    assert.strictEqual(rawPosting.salaryPeriod, 'MONTHLY');
    assert.strictEqual(rawPosting.applicationUrl, 'mailto:to-recruiters@geezjobs.com');
  });

  it('normalizes raw job posting into canonical schema correctly', () => {
    const fixturePath = path.join(__dirname, '../fixtures/geezjobs-detail.html');
    const detailHtml = fs.readFileSync(fixturePath, 'utf8');

    const rawPosting = geezJobsAdapter.parseDetailPage(detailHtml, {
      url: 'https://geezjobs.com/job-detail/import-and-export-operations-officer-geezjobs-recruitment-department',
      slug: 'import-and-export-operations-officer-geezjobs-recruitment-department',
      title: 'Import & Export Operations Officer',
      company: 'GeezJobs (Recruitment Department)',
      experience: '2-6 years',
    });

    const normalized = geezJobsAdapter.normalize(rawPosting, dummySource);

    assert.strictEqual(normalized.sourceId, 'src-geez-001');
    assert.strictEqual(normalized.externalId, 'import-and-export-operations-officer-geezjobs-recruitment-department');
    assert.strictEqual(
      normalized.fingerprint,
      'ext:import-and-export-operations-officer-geezjobs-recruitment-department'
    );
    assert.strictEqual(normalized.normalizedTitle, 'Import & Export Operations Officer');
    assert.ok(!normalized.normalizedDescription.includes('<p>'));
    assert.ok(!normalized.normalizedDescription.includes('<ul>'));
    assert.ok(normalized.normalizedDescription.includes('manage and coordinate import and export activities'));
    assert.strictEqual(normalized.companyName, 'GeezJobs (Recruitment Department)');
    assert.strictEqual(normalized.city, 'Addis Ababa');
    assert.strictEqual(normalized.country, 'Ethiopia');
    assert.strictEqual(normalized.isRemote, false);
    assert.strictEqual(normalized.workArrangement, 'ON_SITE');
    assert.strictEqual(normalized.employmentType, 'FULL_TIME');
    assert.strictEqual(normalized.experienceLevel, 'MID');
    assert.strictEqual(normalized.salaryMin, 5000);
    assert.strictEqual(normalized.salaryMax, 100000);
    assert.strictEqual(normalized.salaryCurrency, 'ETB');
    assert.strictEqual(normalized.salaryPeriod, 'MONTHLY');
    assert.strictEqual(normalized.applicationUrl, 'mailto:to-recruiters@geezjobs.com');
  });

  it('handles fallback card to raw posting when detail page is unavailable', () => {
    const raw = (geezJobsAdapter as any).fallbackCardToRawPosting({
      url: 'https://geezjobs.com/job-detail/software-engineer-sample',
      slug: 'software-engineer-sample',
      title: 'Senior Software Engineer',
      company: 'Tech PLC',
      location: 'Bole, Addis Ababa - ethiopia',
      deadline: 'November 15, 2026',
      employmentType: 'Full-time',
      experience: '5+ years',
    });

    assert.strictEqual(raw.externalId, 'software-engineer-sample');
    assert.strictEqual(raw.title, 'Senior Software Engineer');
    assert.strictEqual(raw.companyName, 'Tech PLC');
    assert.strictEqual(raw.city, 'Addis Ababa');
    assert.strictEqual(raw.country, 'Ethiopia');
    assert.strictEqual(raw.employmentType, 'FULL_TIME');
    assert.strictEqual(raw.experienceLevel, 'SENIOR');
    assert.strictEqual(raw.closingDate.getFullYear(), 2026);
  });

  it('cleans urgent prefix and trailing via GeezJobs from titles', () => {
    assert.strictEqual(
      (geezJobsAdapter as any).cleanTitle('!!! Urgent Logistics Coordinator via GeezJobs'),
      'Logistics Coordinator'
    );
    assert.strictEqual(
      (geezJobsAdapter as any).cleanTitle('Accountant via GeezJobs'),
      'Accountant'
    );
  });
});

