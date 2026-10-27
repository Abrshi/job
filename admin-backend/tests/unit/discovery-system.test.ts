import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AISearchPlannerService,
  computeSearchIdentity,
} from '../../src/modules/discovery/ai-search-planner.service';
import { PROFESSIONAL_TAXONOMY } from '../../src/modules/discovery/taxonomy-data';
import {
  LinkedInAdapter,
} from '../../src/modules/discovery/adapters/linkedin.adapter';
import { SearchRegistryService } from '../../src/modules/discovery/search-registry.service';
import { DiscoveryService } from '../../src/modules/discovery/discovery.service';
import {
  LinkedInCompaniesService,
  normalizeCompanyName,
} from '../../src/modules/discovery/linkedin-companies.service';
import { WorkArrangement, EmploymentType, ExperienceLevel, JobSource } from '@prisma/client';

describe('AI-Powered Job Discovery and Coverage System', () => {
  const planner = new AISearchPlannerService({ apiKey: '', model: 'offline-test' });
  const linkedinAdapter = new LinkedInAdapter();

  // =========================================================================
  // 1. Professional Taxonomy & Category Coverage Tests
  // =========================================================================
  describe('Taxonomy & Category Coverage', () => {
    it('1. Covers all 20 mandatory professional categories in Ethiopia', () => {
      const requiredCategories = [
        'software-it',
        'engineering-architecture',
        'healthcare-medicine',
        'education-training',
        'finance-accounting',
        'business-management',
        'sales-business-development',
        'marketing-communications',
        'customer-service-support',
        'human-resources-recruitment',
        'administration-office-support',
        'legal-compliance',
        'construction-real-estate',
        'manufacturing-industrial',
        'logistics-supply-chain',
        'agriculture-environment',
        'hospitality-tourism',
        'media-design-creative',
        'research-science',
        'ngo-development-social-services',
      ];

      for (const slug of requiredCategories) {
        const taxonomy = PROFESSIONAL_TAXONOMY[slug];
        assert.ok(taxonomy, `Category '${slug}' must exist in taxonomy`);
        assert.ok(taxonomy.titles.length > 0, `Category '${slug}' must have titles`);
        assert.ok(taxonomy.subcategories.length > 0, `Category '${slug}' must have subcategories`);
        assert.ok(taxonomy.localTerms.length > 0, `Category '${slug}' must have local Ethiopian terms`);
      }
    });

    it('2. Offline taxonomy fallback generates comprehensive search plan without AI API key', async () => {
      const plan = await planner.generateSearchPlan({
        maxPerCategory: 4,
        includeRemote: true,
        includeCities: true,
        includeLocalTerms: true,
      });

      assert.ok(plan.length >= 80, `Expected at least 80 queries across 20 categories, got ${plan.length}`);

      // Verify presence of city queries, local terms, and remote queries
      const hasAddis = plan.some((p) => p.targetLocation?.includes('Addis Ababa'));
      const hasRemote = plan.some((p) => p.workArrangement === WorkArrangement.REMOTE);
      const hasLocalAmharic = plan.some((p) => p.tags?.includes('local_amharic'));

      assert.strictEqual(hasAddis, true, 'Plan must include Addis Ababa searches');
      assert.strictEqual(hasRemote, true, 'Plan must include international remote searches');
      assert.strictEqual(hasLocalAmharic, true, 'Plan must include local Amharic searches');
    });
  });

  // =========================================================================
  // 2. Deterministic Deduplication & Identity Hashing
  // =========================================================================
  describe('Deterministic Deduplication & Normalization', () => {
    it('3. Generates identical normalized identity hashes for equivalent queries', () => {
      const hash1 = computeSearchIdentity('software-it', 'Frontend Developer', 'Addis Ababa', 'ON_SITE');
      const hash2 = computeSearchIdentity('software-it', '  frontend   developer! ', 'addis ababa', 'on_site');
      const hashDiff = computeSearchIdentity('software-it', 'Backend Developer', 'Addis Ababa', 'ON_SITE');

      assert.strictEqual(hash1, hash2, 'Punctuation and whitespace variations must yield identical hashes');
      assert.notStrictEqual(hash1, hashDiff, 'Different titles must yield different hashes');
    });

    it('4. Filters duplicate search items deterministically', () => {
      const items = [
        { queryText: 'Accountant Addis', categorySlug: 'finance-accounting', targetLocation: 'Addis Ababa' },
        { queryText: 'accountant addis', categorySlug: 'finance-accounting', targetLocation: 'Addis Ababa' },
        { queryText: 'Accountant Addis!', categorySlug: 'finance-accounting', targetLocation: 'Addis Ababa' },
        { queryText: 'Auditor Addis', categorySlug: 'finance-accounting', targetLocation: 'Addis Ababa' },
      ];

      const deduplicated = planner.deduplicateSearches(items as any);
      assert.strictEqual(deduplicated.length, 2, 'Should deduplicate 4 items down to 2 distinct queries');
    });
  });

  // =========================================================================
  // 3. LinkedIn Adapter & Intake Validation Tests
  // =========================================================================
  describe('LinkedIn Adapter & Intake Validation', () => {
    it('5. Validates and canonicalizes LinkedIn job URLs, stripping tracking parameters', () => {
      const dirtyUrl = 'https://www.linkedin.com/jobs/view/senior-software-engineer-at-tech-ethiopia-4123456789?refId=abc&trackingId=xyz&trk=public_jobs';
      const res = linkedinAdapter.canonicalizeJobUrl(dirtyUrl);

      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.jobId, '4123456789');
      assert.strictEqual(res.canonicalUrl, 'https://www.linkedin.com/jobs/view/4123456789');
      assert.ok(res.urlHash, 'Must produce SHA256 urlHash');
    });

    it('6. Rejects non-LinkedIn or malformed URLs with clear error description', () => {
      const nonLinkedIn = 'https://www.randomsite.com/jobs/view/12345';
      const res = linkedinAdapter.canonicalizeJobUrl(nonLinkedIn);

      assert.strictEqual(res.isValid, false);
      assert.match(res.error || '', /URL is not from linkedin.com domain/);

      const invalidUrl = 'not-a-valid-url';
      const res2 = linkedinAdapter.canonicalizeJobUrl(invalidUrl);
      assert.strictEqual(res2.isValid, false);
    });

    it('7. Generates verified official LinkedIn search URLs for discovery', () => {
      const searchUrl = linkedinAdapter.generateSearchUrl('Civil Engineer', { location: 'Addis Ababa', remoteOnly: false });
      assert.ok(searchUrl.includes('https://www.linkedin.com/jobs/search/'));
      assert.ok(searchUrl.includes('keywords=Civil+Engineer'));
      assert.ok(searchUrl.includes('location=Addis+Ababa'));
      assert.ok(searchUrl.includes('f_TPR=r604800'), 'Must include 7-day past week filter to exclude months-old jobs');

      const remoteSearch = linkedinAdapter.generateSearchUrl('React Developer', { location: 'Ethiopia', remoteOnly: true });
      assert.ok(remoteSearch.includes('f_WT=2'), 'Remote search must include f_WT=2');
      assert.ok(remoteSearch.includes('f_TPR=r604800'));
    });

    it('8. Documents strict compliance boundaries (no unauthorized scraping / cookies)', () => {
      const report = linkedinAdapter.getDiscoveryComplianceReport();
      assert.strictEqual(report.unauthorizedScraping, false);
      assert.strictEqual(report.sessionCookieHijacking, false);
      assert.strictEqual(report.headlessBrowserAutomation, false);
      assert.strictEqual(report.automatedApiIntegrationReady, true);
    });

    it('9. Normalizes discovery reference into standard NormalizedJob for ingestion', () => {
      const mockSource: JobSource = {
        id: 'source-linkedin-uuid',
        name: 'LinkedIn',
        slug: 'linkedin',
        type: 'API',
        endpointUrl: 'https://www.linkedin.com/jobs',
        isActive: true,
        pollingInterval: 360,
        headers: null,
        checkpoint: null,
        lastRunAt: null,
        lastSuccessAt: null,
        nextRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const normalized = linkedinAdapter.normalizeReferenceToJob(
        {
          id: 'ref-1',
          originalUrl: 'https://www.linkedin.com/jobs/view/4123456789',
          title: 'Senior DevOps Architect',
          companyName: 'Fintech Ethiopia',
          location: 'Addis Ababa',
          workArrangement: 'HYBRID',
        },
        mockSource
      );

      assert.strictEqual(normalized.sourceId, 'source-linkedin-uuid');
      assert.strictEqual(normalized.externalId, '4123456789');
      assert.strictEqual(normalized.normalizedTitle, 'Senior DevOps Architect');
      assert.strictEqual(normalized.companyName, 'Fintech Ethiopia');
      assert.strictEqual(normalized.workArrangement, 'HYBRID');
      assert.ok(normalized.fingerprint.startsWith('ext:4123456789'));
    });
  });

  // =========================================================================
  // 4. Registry, Intake Deduplication & Review Lifecycle Tests
  // =========================================================================
  describe('Discovery Registry & Ingestion Pipeline', () => {
    it('10. Detects duplicate intake references using unique urlHash', async () => {
      const storedRefs = new Map<string, any>();

      const mockDb: any = {
        jobDiscoveryReference: {
          findUnique: async ({ where }: any) => {
            return storedRefs.get(where.urlHash) || null;
          },
          create: async ({ data }: any) => {
            const created = { id: 'ref-uuid-1', ...data };
            storedRefs.set(data.urlHash, created);
            return created;
          },
        },
      };

      const discoverySvc = new DiscoveryService(
        mockDb,
        {} as any,
        linkedinAdapter,
        {} as any,
        planner,
        { recordCompanyJobDiscovered: async () => {} } as any
      );

      // First submission: should succeed
      const res1 = await discoverySvc.captureReference({
        url: 'https://www.linkedin.com/jobs/view/4988776655?refId=1',
        title: 'Backend Engineer',
        companyName: 'Alpha Tech',
      });

      assert.strictEqual(res1.isDuplicate, false);
      assert.strictEqual(res1.status, 'PENDING_REVIEW');

      // Second submission of the same job with different tracking query params: should detect duplicate
      const res2 = await discoverySvc.captureReference({
        url: 'https://www.linkedin.com/jobs/view/4988776655?trackingId=another_campaign',
        title: 'Backend Engineer',
      });

      assert.strictEqual(res2.isDuplicate, true);
      assert.strictEqual(res2.referenceId, res1.referenceId);
      assert.match(res2.message, /already been registered/);
    });

    it('11. Ingests accepted intake reference into main Job catalog', async () => {
      let upsertCalled = false;
      let referenceUpdatedStatus = '';

      const mockDb: any = {
        jobDiscoveryReference: {
          findUnique: async () => ({
            id: 'ref-uuid-2',
            originalUrl: 'https://www.linkedin.com/jobs/view/555444333',
            sourceSlug: 'linkedin',
            title: 'Lead Architect',
            companyName: 'Mega Corp',
            location: 'Addis Ababa',
            workArrangement: 'ON_SITE',
          }),
          update: async ({ data }: any) => {
            referenceUpdatedStatus = data.status;
          },
        },
        jobSource: {
          findUnique: async () => ({
            id: 'source-linkedin-id',
            name: 'LinkedIn',
            slug: 'linkedin',
          }),
        },
      };

      const mockJobsRepo: any = {
        upsertJob: async (jobData: any) => {
          upsertCalled = true;
          return { job: { id: 'created-job-uuid-99', ...jobData }, isNew: true };
        },
      };

      const discoverySvc = new DiscoveryService(mockDb, mockJobsRepo, linkedinAdapter, {} as any, planner);
      const res = await discoverySvc.reviewReference('ref-uuid-2', 'ACCEPT');

      assert.strictEqual(upsertCalled, true, 'Must upsert normalized job into main Job catalog');
      assert.strictEqual(referenceUpdatedStatus, 'INGESTED', 'Reference must be marked INGESTED');
      assert.strictEqual(res.jobId, 'created-job-uuid-99');
    });

    it('12. Adaptive gap analysis correctly scores categories and identifies critical gaps', async () => {
      const mockDb: any = {
        jobSearchDefinition: {
          groupBy: async () => [
            { categorySlug: 'software-it', _count: { id: 8 } },
            { categorySlug: 'finance-accounting', _count: { id: 6 } },
            // Other categories have 0 searches
          ],
        },
        jobCategory: {
          findMany: async () => [
            { slug: 'software-it', _count: { jobs: 50 } },
            { slug: 'finance-accounting', _count: { jobs: 25 } },
          ],
        },
      };

      const registry = new SearchRegistryService(mockDb);
      const gaps = await registry.analyzeCoverageGaps();

      assert.strictEqual(gaps.length, 20, 'Must analyze all 20 categories');

      const softwareGap = gaps.find((g) => g.categorySlug === 'software-it');
      assert.strictEqual(softwareGap?.status, 'ADEQUATE');

      const agricultureGap = gaps.find((g) => g.categorySlug === 'agriculture-environment');
      assert.strictEqual(agricultureGap?.status, 'CRITICAL_GAP');
      assert.ok(agricultureGap?.suggestedQueries.length! > 0, 'Must provide targeted suggestions');
    });
  });

  // =========================================================================
  // 5. LinkedIn Companies Directory & Tracking Tests
  // =========================================================================
  describe('LinkedIn Companies Directory & Tracking', () => {
    it('13. Normalizes company names accurately by stripping legal suffixes and noise', () => {
      assert.strictEqual(normalizeCompanyName('Commercial Bank of Ethiopia (CBE)'), 'commercial of cbe');
      assert.strictEqual(normalizeCompanyName('Safaricom Ethiopia PLC'), 'safaricom');
      assert.strictEqual(normalizeCompanyName('Awash Bank S.C.'), 'awash');
      assert.strictEqual(normalizeCompanyName('Dashen Bank S.C'), 'dashen');
      assert.strictEqual(normalizeCompanyName('BGI Ethiopia LLC'), 'bgi');
      assert.strictEqual(normalizeCompanyName('  Africom Technologies   PLC. '), 'africom technologies');
    });

    it('14. Generates search URL for company restricted to past 7 days (f_TPR=r604800)', async () => {
      const companies = new Map<string, any>();
      const mockDb: any = {
        linkedInCompany: {
          findUnique: async ({ where }: any) => companies.get(where.normalizedName) || null,
          create: async ({ data }: any) => {
            const record = { id: 'comp-uuid-1', createdAt: new Date(), ...data };
            companies.set(data.normalizedName, record);
            return record;
          },
        },
      };

      const svc = new LinkedInCompaniesService(mockDb);
      const company = await svc.upsertCompany({
        name: 'Safaricom Telecommunications PLC',
        location: 'Addis Ababa',
        industry: 'Telecommunications',
      });

      assert.strictEqual(company.name, 'Safaricom Telecommunications PLC');
      assert.ok(company.searchUrl, 'Search URL must be generated');
      assert.ok(company.searchUrl?.includes('f_TPR=r604800'), 'Search URL must enforce 7-day filter (f_TPR=r604800)');
      assert.ok(company.searchUrl?.includes('keywords=Safaricom+Telecommunications+PLC'), 'Search URL must include company name in query');
      assert.ok(company.searchUrl?.includes('location=Addis+Ababa'), 'Search URL must include location');
    });

    it('15. Automatically tracks company when jobs are discovered and increments counter', async () => {
      const dbStore = new Map<string, any>();
      const mockDb: any = {
        linkedInCompany: {
          findUnique: async ({ where }: any) => {
            if (where.normalizedName) {
              return Array.from(dbStore.values()).find((c) => c.normalizedName === where.normalizedName) || null;
            }
            if (where.id) return dbStore.get(where.id) || null;
            return null;
          },
          create: async ({ data }: any) => {
            const id = 'comp-uuid-' + (dbStore.size + 1);
            const record = { id, createdAt: new Date(), ...data };
            dbStore.set(id, record);
            return record;
          },
          update: async ({ where, data }: any) => {
            const record = dbStore.get(where.id);
            if (record && data.jobCount?.increment) {
              record.jobCount = (record.jobCount || 0) + data.jobCount.increment;
            }
            if (record && data.lastJobSeenAt) {
              record.lastJobSeenAt = data.lastJobSeenAt;
            }
            return record;
          },
        },
      };

      const svc = new LinkedInCompaniesService(mockDb);

      // First discovery of a job from "Ethio Telecom"
      await svc.recordCompanyJobDiscovered('Ethio Telecom');
      assert.strictEqual(dbStore.size, 1);
      const recorded = Array.from(dbStore.values()).find((c) => c.normalizedName === 'ethio telecom');
      assert.ok(recorded);
      assert.strictEqual(recorded.jobCount, 1);
      assert.strictEqual(recorded.status, 'ACTIVE');

      // Second discovery of a job from the same company (even with slight variance)
      await svc.recordCompanyJobDiscovered('Ethio Telecom PLC');
      assert.strictEqual(recorded.jobCount, 2, 'Job count must increment for existing company');
    });
  });
});

