import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JobQuerySchema } from '../../src/modules/jobs/jobs.validation';

describe('JobQuerySchema Validation', () => {
  it('parses valid search query with source, status, category, workArrangement, experienceLevel, and sortBy', () => {
    const rawQuery = {
      page: '1',
      limit: '12',
      search: 'software engineer',
      source: 'hahujobs',
      status: 'ACTIVE',
      category: 'software-it',
      workArrangement: 'REMOTE',
      experienceLevel: 'JUNIOR',
      sortBy: 'salaryMax',
      sortOrder: 'desc',
    };

    const parsed = JobQuerySchema.parse({ query: rawQuery });
    assert.strictEqual(parsed.query.page, 1);
    assert.strictEqual(parsed.query.limit, 12);
    assert.strictEqual(parsed.query.search, 'software engineer');
    assert.strictEqual(parsed.query.source, 'hahujobs');
    assert.strictEqual(parsed.query.status, 'ACTIVE');
    assert.strictEqual(parsed.query.category, 'software-it');
    assert.strictEqual(parsed.query.workArrangement, 'REMOTE');
    assert.strictEqual(parsed.query.experienceLevel, 'JUNIOR');
    assert.strictEqual(parsed.query.sortBy, 'salaryMax');
    assert.strictEqual(parsed.query.sortOrder, 'desc');
  });

  it('allows omitting optional query parameters and sets default values', () => {
    const parsed = JobQuerySchema.parse({ query: {} });
    assert.strictEqual(parsed.query.page, 1);
    assert.strictEqual(parsed.query.limit, 20);
    assert.strictEqual(parsed.query.sortBy, 'publishedAt');
    assert.strictEqual(parsed.query.sortOrder, 'desc');
    assert.strictEqual(parsed.query.source, undefined);
    assert.strictEqual(parsed.query.status, undefined);
    assert.strictEqual(parsed.query.workArrangement, undefined);
    assert.strictEqual(parsed.query.experienceLevel, undefined);
  });

  it('rejects invalid workArrangement or experienceLevel enum values', () => {
    assert.throws(() => {
      JobQuerySchema.parse({
        query: { workArrangement: 'INVALID_ARRANGEMENT' },
      });
    });

    assert.throws(() => {
      JobQuerySchema.parse({
        query: { experienceLevel: 'INVALID_LEVEL' },
      });
    });
  });

  it('supports status values including ACTIVE, EXPIRED, CLOSED, ARCHIVED, ALL', () => {
    ['ACTIVE', 'EXPIRED', 'CLOSED', 'ARCHIVED', 'ALL'].forEach((status) => {
      const parsed = JobQuerySchema.parse({ query: { status } });
      assert.strictEqual(parsed.query.status, status);
    });

    assert.throws(() => {
      JobQuerySchema.parse({ query: { status: 'INVALID_STATUS' } });
    });
  });

  it('supports sortBy values including publishedAt, firstSeenAt, closingDate, salaryMax', () => {
    ['publishedAt', 'firstSeenAt', 'closingDate', 'salaryMax'].forEach((sortBy) => {
      const parsed = JobQuerySchema.parse({ query: { sortBy } });
      assert.strictEqual(parsed.query.sortBy, sortBy);
    });

    assert.throws(() => {
      JobQuerySchema.parse({ query: { sortBy: 'unsupportedSort' } });
    });
  });
});

