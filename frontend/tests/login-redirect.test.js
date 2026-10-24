import { describe, it } from 'node:test';
import assert from 'node:assert';

// Redirection resolution helper reflecting the logic in AuthCard & universal dashboard
function resolveLoginRedirect(user, returnUrlParam) {
  let target = user?.role === 'ADMIN' ? '/admin' : '/jobs';

  if (returnUrlParam && typeof returnUrlParam === 'string') {
    if (returnUrlParam.startsWith('/') && !returnUrlParam.startsWith('//')) {
      if (returnUrlParam.startsWith('/admin') && user?.role !== 'ADMIN') {
        target = '/jobs';
      } else {
        target = returnUrlParam;
      }
    }
  }

  return target;
}

describe('Post-Login Dashboard Redirection Logic', () => {
  it('redirects administrator to /admin by default', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const destination = resolveLoginRedirect(adminUser, null);
    assert.strictEqual(destination, '/admin');
  });

  it('redirects standard user to /jobs by default', () => {
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destination = resolveLoginRedirect(regularUser, null);
    assert.strictEqual(destination, '/jobs');
  });

  it('preserves valid relative returnUrl for standard user', () => {
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destination = resolveLoginRedirect(regularUser, '/jobs/saved');
    assert.strictEqual(destination, '/jobs/saved');
  });

  it('safeguards against non-admin accessing admin returnUrl and falls back to /jobs', () => {
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destination = resolveLoginRedirect(regularUser, '/admin/users');
    assert.strictEqual(destination, '/jobs');
  });

  it('allows administrator to follow admin returnUrl', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const destination = resolveLoginRedirect(adminUser, '/admin/sources');
    assert.strictEqual(destination, '/admin/sources');
  });

  it('prevents open redirect attacks (//malicious.com) and defaults to role dashboard', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const destinationAdmin = resolveLoginRedirect(adminUser, '//malicious.com');
    assert.strictEqual(destinationAdmin, '/admin');

    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destinationUser = resolveLoginRedirect(regularUser, '//malicious.com');
    assert.strictEqual(destinationUser, '/jobs');
  });
});
