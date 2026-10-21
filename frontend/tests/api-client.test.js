import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ApiError, apiClient } from '../lib/api-client.js';

describe('Frontend ApiError Class', () => {
  it('instantiates with custom attributes and derives fieldErrors map', () => {
    const error = new ApiError('Validation failed', {
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short' },
      ],
      requestId: 'req-front-123',
    });

    assert.strictEqual(error.name, 'ApiError');
    assert.strictEqual(error.message, 'Validation failed');
    assert.strictEqual(error.status, 400);
    assert.strictEqual(error.code, 'VALIDATION_ERROR');
    assert.strictEqual(error.requestId, 'req-front-123');
    assert.strictEqual(error.isNetworkError, false);
    assert.deepStrictEqual(error.fieldErrors, {
      email: 'Email is required',
      password: 'Password is too short',
    });
  });

  it('handles empty details gracefully', () => {
    const error = new ApiError('Resource not found', {
      status: 404,
      code: 'NOT_FOUND',
    });

    assert.strictEqual(error.status, 404);
    assert.strictEqual(error.code, 'NOT_FOUND');
    assert.deepStrictEqual(error.details, []);
    assert.deepStrictEqual(error.fieldErrors, {});
  });
});

describe('Frontend ApiClient Error Normalization', () => {
  it('normalizes standard JSON error responses', async () => {
    // Mock fetch
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      headers: {
        get: (h) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid credentials payload',
          details: [{ field: 'email', message: 'Invalid email format' }],
          requestId: 'trace-456',
        },
      }),
    });

    try {
      await apiClient.post('/auth/login', { email: 'invalid' });
      assert.fail('Should have thrown an ApiError');
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 400);
      assert.strictEqual(err.code, 'VALIDATION_ERROR');
      assert.strictEqual(err.message, 'Invalid credentials payload');
      assert.strictEqual(err.requestId, 'trace-456');
      assert.strictEqual(err.fieldErrors.email, 'Invalid email format');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('normalizes non-JSON HTML error responses into safe messages', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 502,
      headers: {
        get: (h) => (h === 'content-type' ? 'text/html' : 'req-html-789'),
      },
      text: async () => '<html><body>502 Bad Gateway nginx</body></html>',
    });

    try {
      await apiClient.get('/auth/me');
      assert.fail('Should have thrown an ApiError');
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.status, 502);
      assert.strictEqual(err.code, 'SERVER_ERROR');
      assert.strictEqual(
        err.message,
        'The server encountered an error. Please try again later.'
      );
      assert.strictEqual(err.requestId, 'req-html-789');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles network failure with isNetworkError and safe message', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error('Failed to fetch');
    };

    try {
      await apiClient.get('/auth/me');
      assert.fail('Should have thrown an ApiError');
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.strictEqual(err.isNetworkError, true);
      assert.strictEqual(err.code, 'NETWORK_ERROR');
      assert.strictEqual(err.status, 0);
      assert.match(err.message, /check your internet connection/i);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
