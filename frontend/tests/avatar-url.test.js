import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getAvatarUrl } from '../lib/jobs-api.js';

describe('Avatar URL Resolution Logic', () => {
  it('returns null for empty or null avatar input', () => {
    assert.strictEqual(getAvatarUrl(null), null);
    assert.strictEqual(getAvatarUrl(undefined), null);
    assert.strictEqual(getAvatarUrl(''), null);
  });

  it('preserves absolute URLs (http:// or https://)', () => {
    const url = 'https://example.com/avatar.png';
    assert.strictEqual(getAvatarUrl(url), url);

    const httpUrl = 'http://cdn.example.com/pic.jpg';
    assert.strictEqual(getAvatarUrl(httpUrl), httpUrl);
  });

  it('resolves relative proxy path using backend origin', () => {
    const relative = '/api/v1/profile/avatar/user-123';
    const resolved = getAvatarUrl(relative);
    assert.ok(resolved.endsWith('/api/v1/profile/avatar/user-123'));
    assert.ok(resolved.startsWith('http'));
  });
});
