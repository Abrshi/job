/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt Current retry attempt (1-based)
 * @param {number} baseDelayMs Initial backoff delay (default 1000ms)
 * @param {number} maxDelayMs Maximum backoff cap (default 60000ms)
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(attempt, baseDelayMs = 1000, maxDelayMs = 60000) {
  const exp = Math.min(attempt, 6);
  const factor = Math.pow(2, exp);
  const delay = Math.min(baseDelayMs * factor, maxDelayMs);
  // Add 10-25% random jitter to avoid thundering herd problem
  const jitter = delay * (0.1 + Math.random() * 0.15);
  return Math.round(delay + jitter);
}

/**
 * Determine if an HTTP response error is retryable
 * @param {Error} error Axios error or Network error
 * @returns {{ isRetryable: boolean; retryAfterMs?: number; reason: string }}
 */
export function evaluateRetryable(error) {
  // 1. Network / Timeout errors
  if (!error.response) {
    return {
      isRetryable: true,
      reason: error.code || 'NETWORK_ERROR_OR_TIMEOUT',
    };
  }

  const status = error.response.status;

  // 2. Rate Limit (HTTP 429)
  if (status === 429) {
    let retryAfterMs = 5000;
    const retryAfterHeader = error.response.headers['retry-after'];
    if (retryAfterHeader) {
      const parsed = Number(retryAfterHeader);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = parsed * 1000;
      }
    }
    return {
      isRetryable: true,
      retryAfterMs,
      reason: 'RATE_LIMITED_429',
    };
  }

  // 3. Server errors (500, 502, 503, 504)
  if (status >= 500) {
    return {
      isRetryable: true,
      reason: `SERVER_ERROR_${status}`,
    };
  }

  // 4. Client errors (400, 401, 403, 404, 422) - Permanent
  return {
    isRetryable: false,
    reason: `CLIENT_ERROR_${status}`,
  };
}
