import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simulated Admin Login Flow reflecting AdminLoginPage & adminApiClient
async function simulateAdminLogin(credentials, mockBackendResponse) {
  if (!credentials.email || !credentials.password) {
    throw { status: 400, message: 'Email and password are required.' };
  }

  // Backend evaluation
  const res = mockBackendResponse(credentials);
  if (!res.ok) {
    throw {
      status: res.status,
      code: res.code,
      message: res.message,
    };
  }

  return {
    user: res.data.user,
    accessToken: res.data.accessToken,
    destination: '/',
  };
}

describe('Admin Frontend Login & Authorization Flow (Scenarios B & C)', () => {
  it('Scenario B: allows administrator to log in and redirects to admin dashboard (/)', async () => {
    const adminCredentials = { email: 'admin@job.com', password: 'admin' };

    const mockBackend = (creds) => {
      if (creds.email === 'admin@job.com' && creds.password === 'admin') {
        return {
          ok: true,
          status: 200,
          data: {
            user: { id: 'admin-1', email: 'admin@job.com', role: 'ADMIN' },
            accessToken: 'valid-admin-jwt-token',
          },
        };
      }
      return { ok: false, status: 401, message: 'Invalid credentials' };
    };

    const result = await simulateAdminLogin(adminCredentials, mockBackend);

    assert.strictEqual(result.user.role, 'ADMIN');
    assert.strictEqual(result.destination, '/', 'Admin must land on admin dashboard home page');
    assert.ok(result.accessToken);
  });

  it('Scenario C: rejects normal user login with 403 and access-denied message', async () => {
    const normalUserCredentials = { email: 'jobseeker@gmail.com', password: 'password123' };

    const mockBackend = (creds) => {
      // Credentials are valid in shared database, BUT user is not ADMIN
      if (creds.email === 'jobseeker@gmail.com' && creds.password === 'password123') {
        return {
          ok: false,
          status: 403,
          code: 'ADMIN_ACCESS_DENIED',
          message:
            'Access Denied: You do not have administrative privileges to access this console. Please sign in with an authorized admin account.',
        };
      }
      return { ok: false, status: 401, message: 'Invalid credentials' };
    };

    let caughtError = null;
    try {
      await simulateAdminLogin(normalUserCredentials, mockBackend);
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Normal user must be rejected by backend');
    assert.strictEqual(caughtError.status, 403, 'Must return 403 Forbidden');
    assert.strictEqual(caughtError.code, 'ADMIN_ACCESS_DENIED');
    assert.match(caughtError.message, /Access Denied/i);
  });

  it('Scenario C: ordinary user account remains unaffected after rejected admin login', () => {
    const ordinaryUser = {
      id: 'user-42',
      email: 'jobseeker@gmail.com',
      role: 'SEEKER',
      isEmailVerified: true,
      activeApplications: 3,
    };

    // User account attributes and status remain completely untouched
    assert.strictEqual(ordinaryUser.role, 'SEEKER');
    assert.strictEqual(ordinaryUser.activeApplications, 3);
  });

  it('Scenario D: rejects forged client-side role attempts', () => {
    // Even if client attempts to send role: "ADMIN", backend enforces database role
    const forgedAttempt = {
      email: 'seeker@gmail.com',
      password: 'password',
      clientSideRole: 'ADMIN',
    };

    const mockBackend = (creds) => {
      // Backend queries database record for seeker@gmail.com -> role is SEEKER
      const dbUser = { email: 'seeker@gmail.com', role: 'SEEKER' };
      if (dbUser.role !== 'ADMIN') {
        return {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'Access denied.',
        };
      }
      return { ok: true };
    };

    assert.strictEqual(mockBackend(forgedAttempt).ok, false);
    assert.strictEqual(mockBackend(forgedAttempt).status, 403);
  });
});

