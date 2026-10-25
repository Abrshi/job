import { describe, it } from 'node:test';
import assert from 'node:assert';

// Redirection resolution helper in user-facing frontend
// An administrator logging into the user frontend receives the same normal user experience as job seekers
function resolveLoginRedirect(user, returnUrlParam) {
  let target = '/jobs';

  if (returnUrlParam && typeof returnUrlParam === 'string') {
    if (returnUrlParam.startsWith('/') && !returnUrlParam.startsWith('//')) {
      // In user frontend, /admin is not a user destination; redirect to /jobs
      if (returnUrlParam.startsWith('/admin')) {
        target = '/jobs';
      } else {
        target = returnUrlParam;
      }
    }
  }

  return target;
}

describe('Post-Login User Frontend Redirection Logic (Scenario A)', () => {
  it('redirects administrator to normal user home /jobs by default (no admin redirect)', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const destination = resolveLoginRedirect(adminUser, null);
    assert.strictEqual(destination, '/jobs', 'Administrator in user app must land on /jobs');
  });

  it('redirects standard user to /jobs by default', () => {
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destination = resolveLoginRedirect(regularUser, null);
    assert.strictEqual(destination, '/jobs');
  });

  it('preserves valid relative returnUrl for administrator without diverting to /admin', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const destination = resolveLoginRedirect(adminUser, '/jobs/saved');
    assert.strictEqual(destination, '/jobs/saved');
  });

  it('preserves valid relative returnUrl for standard user', () => {
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };
    const destination = resolveLoginRedirect(regularUser, '/jobs/saved');
    assert.strictEqual(destination, '/jobs/saved');
  });

  it('safeguards against /admin returnUrl in user app and falls back to /jobs for all accounts', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };

    assert.strictEqual(resolveLoginRedirect(adminUser, '/admin/users'), '/jobs');
    assert.strictEqual(resolveLoginRedirect(regularUser, '/admin/users'), '/jobs');
  });

  it('prevents open redirect attacks (//malicious.com) and defaults to /jobs', () => {
    const adminUser = { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' };
    const regularUser = { id: 'user-1', email: 'user@job.com', role: 'USER' };

    assert.strictEqual(resolveLoginRedirect(adminUser, '//malicious.com'), '/jobs');
    assert.strictEqual(resolveLoginRedirect(regularUser, '//malicious.com'), '/jobs');
  });
});
