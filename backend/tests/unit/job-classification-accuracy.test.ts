import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GeminiClassifier } from '../../src/modules/classification/gemini.classifier';
import {
  ClassificationOutputSchema,
  normalizeCategorySlug,
} from '../../src/modules/classification/classification.types';

describe('Job Classification Accuracy & Professional Function Tests', () => {
  const classifier = new GeminiClassifier(undefined); // Offline heuristic engine

  describe('15 Standard Job Title Benchmarks', () => {
    const tableCases: Array<{
      title: string;
      expectedSlug: string;
      secondary?: string;
    }> = [
      {
        title: 'Marketing and Sales Officer',
        expectedSlug: 'sales-business-development',
        secondary: 'marketing-communications',
      },
      {
        title: 'Digital Marketing Specialist',
        expectedSlug: 'marketing-communications',
      },
      {
        title: 'Software Developer',
        expectedSlug: 'software-it',
      },
      {
        title: 'IT Support Officer',
        expectedSlug: 'software-it',
      },
      {
        title: 'Accountant',
        expectedSlug: 'finance-accounting',
      },
      {
        title: 'Human Resources Officer',
        expectedSlug: 'human-resources-recruitment',
      },
      {
        title: 'Sales Representative',
        expectedSlug: 'sales-business-development',
      },
      {
        title: 'Business Development Officer',
        expectedSlug: 'sales-business-development',
      },
      {
        title: 'Manufacturing Production Supervisor',
        expectedSlug: 'manufacturing-industrial',
      },
      {
        title: 'Customer Service Representative',
        expectedSlug: 'customer-service-support',
      },
      {
        title: 'Logistics Coordinator',
        expectedSlug: 'logistics-supply-chain',
      },
      {
        title: 'Civil Engineer',
        expectedSlug: 'engineering-architecture',
      },
      {
        title: 'School Teacher',
        expectedSlug: 'education-training',
      },
      {
        title: 'Medical Doctor',
        expectedSlug: 'healthcare-medicine',
      },
      {
        title: 'Graphic Designer',
        expectedSlug: 'design-creative',
      },
    ];

    for (const tc of tableCases) {
      it(`classifies "${tc.title}" as primary "${tc.expectedSlug}"`, () => {
        const result = classifier.classifyHeuristic(
          tc.title,
          `General duties and daily responsibilities for ${tc.title}.`
        );

        assert.strictEqual(
          result.categorySlug,
          tc.expectedSlug,
          `Expected ${tc.expectedSlug} for "${tc.title}", got ${result.categorySlug}`
        );
        assert.ok(result.confidence >= 0.85);

        if (tc.secondary) {
          assert.ok(
            result.secondaryCategories.includes(tc.secondary),
            `Expected secondary category "${tc.secondary}" for "${tc.title}"`
          );
        }
      });
    }
  });

  describe('SINEGA Regression Test: Incidental Software and Tech Terms', () => {
    it('correctly classifies Marketing and Sales Officer despite CRM software, database, MS Office, and technical terms', () => {
      const title = 'Marketing and Sales Officer';
      const description = `Sinega Manufacturing PLC is seeking an energetic Marketing and Sales Officer.
Responsibilities:
- Formulate marketing plans, execute digital campaigns, and meet monthly sales targets.
- Identify new market opportunities, lead generation, and customer relationship management.
- Utilize CRM software to record customer database and sales pipelines.
- Manage distributors, negotiate commercial contracts, and prepare regular sales reports using MS Office.
Qualifications & Skills:
- Degree in Marketing Management, Business Administration, or related field.
- 3+ years of experience in sales and marketing within consumer goods / manufacturing industry.
- Excellent analytical mindset, strong communication, and technical skills in modern sales platforms.`;

      const result = classifier.classifyHeuristic(title, description);

      // Must be Sales & Business Development
      assert.strictEqual(
        result.categorySlug,
        'sales-business-development',
        `SINEGA job must be classified as sales-business-development, but got ${result.categorySlug}`
      );

      // Must NOT be Software & IT
      assert.notStrictEqual(
        result.categorySlug,
        'software-it',
        'SINEGA job must not be classified as software-it'
      );

      // Must NOT be Manufacturing
      assert.notStrictEqual(
        result.categorySlug,
        'manufacturing-industrial',
        'SINEGA job must not be classified as manufacturing-industrial'
      );

      // Must include secondary category
      assert.ok(
        result.secondaryCategories.includes('marketing-communications'),
        'Must contain marketing-communications in secondaryCategories'
      );

      // Must detect MID level experience from 3+ years
      assert.strictEqual(result.experienceLevel, 'MID');
      assert.ok(result.confidence >= 0.85);
    });
  });

  describe('Conflicting Keywords & Industry vs Function Tests', () => {
    it('classifies an Accountant at a Software Company as Finance & Accounting (NOT Software & IT)', () => {
      const result = classifier.classifyHeuristic(
        'Senior Financial Accountant',
        'TechCloud is a leading SaaS software company developing databases and web applications. We need a Senior Accountant to manage general ledgers, tax compliance, payroll software, and audit reconciliations.'
      );

      assert.strictEqual(result.categorySlug, 'finance-accounting');
      assert.notStrictEqual(result.categorySlug, 'software-it');
      assert.strictEqual(result.experienceLevel, 'SENIOR');
    });

    it('classifies a Software Developer at a Hospital as Software & IT (NOT Healthcare)', () => {
      const result = classifier.classifyHeuristic(
        'Full Stack Software Developer',
        'St. Paul Hospital is hiring a software developer to build patient electronic medical records, clinical lab portals, and physician scheduling tools using React, Node.js, and PostgreSQL.'
      );

      assert.strictEqual(result.categorySlug, 'software-it');
      assert.notStrictEqual(result.categorySlug, 'healthcare-medicine');
    });

    it('classifies a Software Engineer at an NGO as Software & IT (NOT NGO / Development)', () => {
      const result = classifier.classifyHeuristic(
        'Backend Software Engineer',
        'International Relief NGO is seeking a backend software engineer to maintain humanitarian supply tracking APIs and deploy cloud microservices.'
      );

      assert.strictEqual(result.categorySlug, 'software-it');
      assert.notStrictEqual(result.categorySlug, 'ngo-development-social-services');
    });

    it('classifies a Front Desk Receptionist at a Manufacturing Plant as Administration (NOT Manufacturing)', () => {
      const result = classifier.classifyHeuristic(
        'Front Desk Receptionist',
        'Modern Steel Manufacturing Plant PLC seeks a receptionist to greet factory visitors, manage phone calls, handle incoming office correspondence, and organize visitor logbooks.'
      );

      assert.strictEqual(result.categorySlug, 'administration-office-support');
      assert.notStrictEqual(result.categorySlug, 'manufacturing-industrial');
    });

    it('classifies an HR Manager at a Construction Firm as HR & Recruitment (NOT Construction)', () => {
      const result = classifier.classifyHeuristic(
        'Human Resources Manager',
        'Summit Construction and Real Estate PLC is recruiting an HR Manager to lead site personnel recruitment, employee contracts, labor dispute resolution, and performance appraisals.'
      );

      assert.strictEqual(result.categorySlug, 'human-resources-recruitment');
      assert.notStrictEqual(result.categorySlug, 'construction-real-estate');
    });
  });

  describe('Edge Cases: Missing Titles, Short Descriptions & Ambiguous Duties', () => {
    it('classifies based on duties when job title is missing or generic', () => {
      const result = classifier.classifyHeuristic(
        '',
        'Daily duties include bookkeeping, financial accounts reconciliation, preparing balance sheets, and calculating tax payments.'
      );

      assert.strictEqual(result.categorySlug, 'finance-accounting');
    });

    it('handles short descriptions without throwing', () => {
      const result = classifier.classifyHeuristic('Civil Engineer', 'Urgent vacancy.');
      assert.strictEqual(result.categorySlug, 'engineering-architecture');
      assert.strictEqual(result.experienceLevel, 'UNSPECIFIED');
    });

    it('handles ambiguous office coordinator titles with office administration duties', () => {
      const result = classifier.classifyHeuristic(
        'Office Coordinator',
        'Manage office supplies, front desk operations, schedule executive meetings, and maintain office files.'
      );

      assert.strictEqual(result.categorySlug, 'administration-office-support');
    });
  });

  describe('Category Slug Normalization & Schema Validation', () => {
    it('normalizes category names to standard slugs', () => {
      assert.strictEqual(
        normalizeCategorySlug('Sales & Business Development'),
        'sales-business-development'
      );
      assert.strictEqual(
        normalizeCategorySlug('Software & IT'),
        'software-it'
      );
      assert.strictEqual(
        normalizeCategorySlug('HR & Recruitment'),
        'human-resources-recruitment'
      );
      assert.strictEqual(
        normalizeCategorySlug('Design & Creative'),
        'design-creative'
      );
    });

    it('validates structured output with secondaryCategories and explanation', () => {
      const raw = {
        categorySlug: 'sales-business-development',
        primaryCategory: 'sales-business-development',
        secondaryCategories: ['marketing-communications'],
        experienceLevel: 'MID',
        confidence: 0.94,
        explanation: 'Classified based on primary sales responsibilities with secondary marketing function.',
        skills: ['CRM', 'Digital Campaigns', 'Sales Management'],
        industry: 'Manufacturing',
      };

      const parsed = ClassificationOutputSchema.parse(raw);
      assert.strictEqual(parsed.categorySlug, 'sales-business-development');
      assert.deepStrictEqual(parsed.secondaryCategories, ['marketing-communications']);
      assert.strictEqual(parsed.industry, 'Manufacturing');
    });
  });
});

