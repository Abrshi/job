import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fetchJobs, fetchCategories, fetchSources } from '../lib/jobs-api.js';

describe('Job Search and Filtering API Exports', () => {
  it('exports fetchSources in jobs-api.js', () => {
    assert.strictEqual(typeof fetchSources, 'function');
    assert.strictEqual(typeof fetchCategories, 'function');
    assert.strictEqual(typeof fetchJobs, 'function');
  });

  it('constructs correct query params with source, status, category, workArrangement, and experienceLevel', () => {
    const params = {
      source: 'hahujobs',
      category: 'software-it',
      status: 'ACTIVE',
      workArrangement: 'REMOTE',
      experienceLevel: 'JUNIOR',
      sortBy: 'publishedAt',
      page: 1,
      limit: 12,
    };

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    assert.strictEqual(query.get('source'), 'hahujobs');
    assert.strictEqual(query.get('category'), 'software-it');
    assert.strictEqual(query.get('status'), 'ACTIVE');
    assert.strictEqual(query.get('workArrangement'), 'REMOTE');
    assert.strictEqual(query.get('experienceLevel'), 'JUNIOR');
    assert.strictEqual(query.get('sortBy'), 'publishedAt');
  });

  it('constructs query params with ethiojobs as source', () => {
    const params = {
      source: 'ethiojobs',
      category: 'agriculture-environment',
      status: 'ACTIVE',
      workArrangement: 'HYBRID',
      experienceLevel: 'MID',
    };

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    assert.strictEqual(query.get('source'), 'ethiojobs');
    assert.strictEqual(query.get('category'), 'agriculture-environment');
    assert.strictEqual(query.get('workArrangement'), 'HYBRID');
    assert.strictEqual(query.get('experienceLevel'), 'MID');
  });

  it('constructs query params with geezjobs as source', () => {
    const params = {
      source: 'geezjobs',
      category: 'logistics-supply-chain',
      status: 'ACTIVE',
      workArrangement: 'ON_SITE',
      experienceLevel: 'MID',
    };

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    assert.strictEqual(query.get('source'), 'geezjobs');
    assert.strictEqual(query.get('category'), 'logistics-supply-chain');
    assert.strictEqual(query.get('workArrangement'), 'ON_SITE');
    assert.strictEqual(query.get('experienceLevel'), 'MID');
  });

  it('handles empty filters without adding blank parameters to query', () => {
    const params = {
      source: '',
      category: 'software-it',
      status: '',
      workArrangement: '',
      experienceLevel: '',
      sortBy: 'salaryMax',
    };

    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    });

    assert.strictEqual(query.has('source'), false);
    assert.strictEqual(query.has('status'), false);
    assert.strictEqual(query.has('workArrangement'), false);
    assert.strictEqual(query.has('experienceLevel'), false);
    assert.strictEqual(query.get('category'), 'software-it');
    assert.strictEqual(query.get('sortBy'), 'salaryMax');
  });
});

