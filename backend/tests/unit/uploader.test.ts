import { describe, it } from 'node:test';
import assert from 'node:assert';
import { uploadFile, uploadFileToDrive, downloadFile, deleteFile } from '../../src/lib/storage/uploader';

describe('Unified File Uploader Helper Module', () => {
  it('exports simple uploadFile and uploadFileToDrive functions', () => {
    assert.strictEqual(typeof uploadFile, 'function');
    assert.strictEqual(typeof uploadFileToDrive, 'function');
    assert.strictEqual(typeof downloadFile, 'function');
    assert.strictEqual(typeof deleteFile, 'function');
  });

  it('uploads a file buffer, generates unique file ID, and stores metadata', async () => {
    const testContent = Buffer.from('CV Test Content for Single Function Uploader ' + Date.now());
    const filename = 'resume-test.pdf';
    const mimeType = 'application/pdf';

    const result = await uploadFile({
      buffer: testContent,
      filename,
      mimeType,
    });

    assert.ok(result.fileId, 'Should return a valid fileId');
    assert.strictEqual(result.originalFilename, filename);
    assert.strictEqual(result.mimeType, mimeType);
    assert.strictEqual(result.sizeBytes, testContent.length);
    assert.ok(result.storageProvider === 'GOOGLE_DRIVE' || result.storageProvider === 'LOCAL_STORAGE');

    // Test download retrieves identical bytes
    const downloaded = await downloadFile(result.fileId);
    assert.deepStrictEqual(downloaded.buffer, testContent);
    assert.strictEqual(downloaded.mimeType, mimeType);

    // Test delete cleanly removes the file
    const deleted = await deleteFile(result.fileId);
    assert.strictEqual(deleted, true);
  });

  it('supports uploadFileToDrive alias identically', async () => {
    const testContent = Buffer.from('Drive upload alias content ' + Date.now());
    const filename = 'document.docx';
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const result = await uploadFileToDrive({
      buffer: testContent,
      filename,
      mimeType,
    });

    assert.ok(result.fileId);
    assert.strictEqual(result.sizeBytes, testContent.length);

    // Clean up
    await deleteFile(result.fileId);
  });
});

