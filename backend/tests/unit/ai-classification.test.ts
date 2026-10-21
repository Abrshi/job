import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ClassificationOutputSchema,
  evaluateClassificationStatus,
  CONFIDENCE_THRESHOLDS,
} from '../../src/modules/classification/classification.types';
import { GeminiClassifier } from '../../src/modules/classification/gemini.classifier';

describe('Classification Schema and Confidence Bands', () => {
  it('validates a compliant classification output', () => {
    const valid = {
      categorySlug: 'software-it',
      experienceLevel: 'SENIOR',
      confidence: 0.95,
      explanation: 'Position requires 5+ years building distributed Node.js applications.',
      skills: ['Node.js', 'TypeScript', 'MySQL'],
    };

    const parsed = ClassificationOutputSchema.parse(valid);
    assert.strictEqual(parsed.categorySlug, 'software-it');
    assert.strictEqual(parsed.experienceLevel, 'SENIOR');
    assert.strictEqual(parsed.confidence, 0.95);
  });

  it('rejects confidence out of [0, 1] range', () => {
    const invalid = {
      categorySlug: 'software-it',
      experienceLevel: 'MID',
      confidence: 1.5, // invalid
      explanation: 'Some explanation here',
    };

    assert.throws(() => ClassificationOutputSchema.parse(invalid));
  });

  it('correctly maps confidence to status according to thresholds', () => {
    // High confidence (>= 0.85): AUTO_APPROVED / CLASSIFIED
    const high = evaluateClassificationStatus(0.92);
    assert.strictEqual(high.reviewStatus, 'AUTO_APPROVED');
    assert.strictEqual(high.jobStatus, 'CLASSIFIED');

    const exactBoundary = evaluateClassificationStatus(CONFIDENCE_THRESHOLDS.HIGH);
    assert.strictEqual(exactBoundary.reviewStatus, 'AUTO_APPROVED');
    assert.strictEqual(exactBoundary.jobStatus, 'CLASSIFIED');

    // Medium confidence (0.60 <= conf < 0.85): NEEDS_REVIEW / REVIEW_REQUIRED
    const medium = evaluateClassificationStatus(0.72);
    assert.strictEqual(medium.reviewStatus, 'NEEDS_REVIEW');
    assert.strictEqual(medium.jobStatus, 'REVIEW_REQUIRED');

    // Low confidence (< 0.60): NEEDS_REVIEW / REVIEW_REQUIRED
    const low = evaluateClassificationStatus(0.45);
    assert.strictEqual(low.reviewStatus, 'NEEDS_REVIEW');
    assert.strictEqual(low.jobStatus, 'REVIEW_REQUIRED');
  });
});

describe('Heuristic Classifier Fallback', () => {
  const classifier = new GeminiClassifier(undefined); // No API key, forces heuristic

  it('classifies software roles into software-it with extracted skills', () => {
    const result = classifier.classifyHeuristic(
      'Senior Full Stack React and Node Developer',
      'We are looking for a senior developer with 6+ years building TypeScript web applications and MySQL databases.'
    );

    assert.strictEqual(result.categorySlug, 'software-it');
    assert.strictEqual(result.experienceLevel, 'SENIOR');
    assert.ok(result.confidence >= 0.85);
    assert.ok(result.skills.includes('React'));
    assert.ok(result.skills.includes('Node.js'));
  });

  it('classifies finance positions into finance-accounting', () => {
    const result = classifier.classifyHeuristic(
      'Senior Accountant & Tax Auditor',
      'Manage corporate financial reporting, balance sheets, and external tax audits.'
    );

    assert.strictEqual(result.categorySlug, 'finance-accounting');
    assert.ok(result.confidence >= 0.85);
  });

  it('assigns UNSPECIFIED when no experience information is present', () => {
    const result = classifier.classifyHeuristic(
      'Administrative Office Clerk',
      'General clerical duties including phone calls, customer greeting, and file filing.'
    );

    assert.strictEqual(result.categorySlug, 'administration-office-support');
    assert.strictEqual(result.experienceLevel, 'UNSPECIFIED');
  });
});
