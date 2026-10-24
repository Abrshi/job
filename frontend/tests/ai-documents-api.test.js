import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as aiDocsApi from '../lib/ai-documents-api.js';
import * as jobsApi from '../lib/jobs-api.js';

describe('AI Application Documents Frontend API Exports', () => {
  test('exports all document generation and export functions from ai-documents-api.js', () => {
    assert.strictEqual(typeof aiDocsApi.generateDocument, 'function');
    assert.strictEqual(typeof aiDocsApi.fetchGeneratedDocuments, 'function');
    assert.strictEqual(typeof aiDocsApi.fetchGeneratedDocumentById, 'function');
    assert.strictEqual(typeof aiDocsApi.saveDocumentVersion, 'function');
    assert.strictEqual(typeof aiDocsApi.downloadGeneratedDocument, 'function');
    assert.strictEqual(typeof aiDocsApi.attachDocumentToApplication, 'function');
    assert.strictEqual(typeof aiDocsApi.deleteGeneratedDocument, 'function');
  });

  test('re-exports document functions through jobs-api.js', () => {
    assert.strictEqual(typeof jobsApi.generateDocument, 'function');
    assert.strictEqual(typeof jobsApi.fetchGeneratedDocuments, 'function');
    assert.strictEqual(typeof jobsApi.fetchGeneratedDocumentById, 'function');
    assert.strictEqual(typeof jobsApi.saveDocumentVersion, 'function');
    assert.strictEqual(typeof jobsApi.downloadGeneratedDocument, 'function');
    assert.strictEqual(typeof jobsApi.attachDocumentToApplication, 'function');
    assert.strictEqual(typeof jobsApi.deleteGeneratedDocument, 'function');
  });
});
