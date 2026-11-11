import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBackoff, evaluateRetryable } from '../src/delivery/retry.js';

describe('Retry Logic and Backoff', () => {
  describe('calculateBackoff', () => {
    it('calculates exponential delay with jitter', () => {
      const delay1 = calculateBackoff(1, 1000, 60000);
      const delay2 = calculateBackoff(2, 1000, 60000);
      const delay3 = calculateBackoff(3, 1000, 60000);

      // Attempt 1: 1000 * 2^1 = 2000 ms + 10-25% jitter (2200 - 2500)
      assert.ok(delay1 >= 2200 && delay1 <= 2500, `Delay 1 (${delay1}) outside expected range`);

      // Attempt 2: 1000 * 2^2 = 4000 ms + 10-25% jitter (4400 - 5000)
      assert.ok(delay2 >= 4400 && delay2 <= 5000, `Delay 2 (${delay2}) outside expected range`);

      // Attempt 3: 1000 * 2^3 = 8000 ms + 10-25% jitter (8800 - 10000)
      assert.ok(delay3 >= 8800 && delay3 <= 10000, `Delay 3 (${delay3}) outside expected range`);
    });

    it('caps delay at maxDelayMs plus jitter', () => {
      const maxDelay = 10000;
      const delayHigh = calculateBackoff(10, 1000, maxDelay);
      // Even with attempt 10, the base cap is 10000 ms + max 25% jitter = max 12500 ms
      assert.ok(delayHigh <= 12500, `Delay ${delayHigh} exceeds capped maximum`);
    });
  });

  describe('evaluateRetryable', () => {
    it('marks network errors without response as retryable', () => {
      const networkError = new Error('getaddrinfo ENOTFOUND backend');
      networkError.code = 'ENOTFOUND';

      const result = evaluateRetryable(networkError);
      assert.equal(result.isRetryable, true);
      assert.equal(result.reason, 'ENOTFOUND');
    });

    it('marks connection timeout as retryable', () => {
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.code = 'ETIMEDOUT';

      const result = evaluateRetryable(timeoutError);
      assert.equal(result.isRetryable, true);
      assert.equal(result.reason, 'ETIMEDOUT');
    });

    it('handles HTTP 429 Rate Limit and respects Retry-After header', () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'retry-after': '30',
          },
        },
      };

      const result = evaluateRetryable(rateLimitError);
      assert.equal(result.isRetryable, true);
      assert.equal(result.retryAfterMs, 30000);
      assert.equal(result.reason, 'RATE_LIMITED_429');
    });

    it('falls back to 5000ms retry-after for HTTP 429 if header is missing', () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {},
        },
      };

      const result = evaluateRetryable(rateLimitError);
      assert.equal(result.isRetryable, true);
      assert.equal(result.retryAfterMs, 5000);
    });

    it('marks HTTP 5xx server errors as retryable', () => {
      for (const status of [500, 502, 503, 504]) {
        const serverError = {
          response: {
            status,
            headers: {},
          },
        };

        const result = evaluateRetryable(serverError);
        assert.equal(result.isRetryable, true, `Status ${status} should be retryable`);
        assert.equal(result.reason, `SERVER_ERROR_${status}`);
      }
    });

    it('marks HTTP 4xx client errors as non-retryable (permanent)', () => {
      for (const status of [400, 401, 403, 404, 422]) {
        const clientError = {
          response: {
            status,
            headers: {},
          },
        };

        const result = evaluateRetryable(clientError);
        assert.equal(result.isRetryable, false, `Status ${status} should not be retryable`);
        assert.equal(result.reason, `CLIENT_ERROR_${status}`);
      }
    });
  });
});
