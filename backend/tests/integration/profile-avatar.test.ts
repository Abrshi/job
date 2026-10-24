import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { AddressInfo } from 'net';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { env } from '../../src/config/env';

describe('Profile Picture (Avatar) Upload and Image Proxy Integration', () => {
  let server: http.Server;
  let baseUrl = '';

  let testUserId = '';
  let testUserToken = '';

  // Minimal valid 1x1 PNG image buffer
  const samplePngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d420000000049454e44ae426082',
    'hex'
  );

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    const user = await prisma.user.create({
      data: {
        email: `avatar-test-${Date.now()}@test.com`,
        passwordHash: await argon2.hash('Password123!'),
        role: 'CANDIDATE',
        isEmailVerified: true,
      },
    });

    testUserId = user.id;
    testUserToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, isEmailVerified: true },
      env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    await prisma.userProfile.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated avatar upload with 401', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.png"\r\nContent-Type: image/png\r\n\r\n`),
      samplePngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.strictEqual(res.status, 401);
  });

  it('rejects invalid file types or spoofed extensions with bad magic bytes', async () => {
    const boundary = '----WebKitFormBoundaryBadFile';
    const fakeImageBuffer = Buffer.from('NOT AN IMAGE CONTENT AT ALL');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="fake.png"\r\nContent-Type: image/png\r\n\r\n`),
      fakeImageBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testUserToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.strictEqual(data.error.code, 'INVALID_IMAGE_SIGNATURE');
  });

  it('uploads valid image, stores to storage, and sets avatarUrl in profile', async () => {
    const boundary = '----WebKitFormBoundaryValid';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="profile-pic.png"\r\nContent-Type: image/png\r\n\r\n`),
      samplePngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${baseUrl}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testUserToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, 'success');
    assert.ok(json.data.avatarUrl);
    assert.strictEqual(json.data.avatarUrl, `/api/v1/profile/avatar/${testUserId}`);

    // Verify UserProfile in database
    const profile = await prisma.userProfile.findUnique({
      where: { userId: testUserId },
    });
    assert.ok(profile?.avatarFileId);
    assert.strictEqual(profile?.avatarUrl, `/api/v1/profile/avatar/${testUserId}`);
  });

  it('serves the avatar image via backend proxy without requiring authentication (public for <img> tags)', async () => {
    // Request without Authorization header (simulates standard browser <img src="...">)
    const res = await fetch(`${baseUrl}/api/v1/profile/avatar/${testUserId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    assert.ok(res.headers.get('cache-control')?.includes('public'));
    assert.strictEqual(res.headers.get('cross-origin-resource-policy'), 'cross-origin');

    const imageArrayBuffer = await res.arrayBuffer();
    assert.strictEqual(imageArrayBuffer.byteLength, samplePngBuffer.byteLength);
    assert.deepStrictEqual(Buffer.from(imageArrayBuffer), samplePngBuffer);
  });

  it('serves the avatar via authenticated /api/v1/profile/avatar', async () => {
    const res = await fetch(`${baseUrl}/api/v1/profile/avatar`, {
      headers: {
        Authorization: `Bearer ${testUserToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const imageArrayBuffer = await res.arrayBuffer();
    assert.deepStrictEqual(Buffer.from(imageArrayBuffer), samplePngBuffer);
  });

  it('returns 404 for non-existent avatar', async () => {
    const res = await fetch(`${baseUrl}/api/v1/profile/avatar/non-existent-user-id`);
    assert.strictEqual(res.status, 404);
  });

  it('deletes user avatar and returns 404 on subsequent proxy requests', async () => {
    const delRes = await fetch(`${baseUrl}/api/v1/profile/avatar`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${testUserToken}`,
      },
    });

    assert.strictEqual(delRes.status, 200);

    const checkRes = await fetch(`${baseUrl}/api/v1/profile/avatar/${testUserId}`);
    assert.strictEqual(checkRes.status, 404);
  });
});
