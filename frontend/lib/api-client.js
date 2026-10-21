const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 500,
      code = 'ERROR',
      details = [],
      requestId = null,
      isNetworkError = false,
      raw = null,
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
    this.requestId = requestId;
    this.isNetworkError = isNetworkError;
    this.raw = raw;

    // Helper map for field-specific errors: { [fieldName]: errorMessage }
    this.fieldErrors = this.details.reduce((acc, item) => {
      if (item && item.field) {
        acc[item.field] = item.message;
      }
      return acc;
    }, {});
  }
}

class ApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshPromise = null;
    this.onSessionExpiredCallbacks = new Set();
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  clearAccessToken() {
    this.accessToken = null;
  }

  onSessionExpired(callback) {
    this.onSessionExpiredCallbacks.add(callback);
    return () => this.onSessionExpiredCallbacks.delete(callback);
  }

  notifySessionExpired() {
    this.clearAccessToken();
    this.onSessionExpiredCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Session expiry callback error:', err);
      }
    });
  }

  async refreshAccessToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Includes HttpOnly refreshToken cookie
        });

        if (!response.ok) {
          let errData = null;
          try {
            errData = await response.json();
          } catch {
            // non-json response
          }
          const message =
            errData?.error?.message ||
            errData?.message ||
            'Refresh session invalid or expired';
          throw new ApiError(message, {
            status: response.status,
            code: errData?.error?.code || 'INVALID_REFRESH_TOKEN',
            requestId:
              errData?.error?.requestId || response.headers.get('x-request-id'),
            raw: errData,
          });
        }

        const data = await response.json();
        const newAccessToken = data?.data?.accessToken;
        if (!newAccessToken) {
          throw new ApiError('No access token returned from refresh', {
            status: 500,
            code: 'INVALID_TOKEN_RESPONSE',
          });
        }

        this.setAccessToken(newAccessToken);
        return newAccessToken;
      } catch (err) {
        this.clearAccessToken();
        if (err instanceof ApiError) {
          throw err;
        }
        throw new ApiError(err.message || 'Unable to refresh session', {
          status: 0,
          code: 'REFRESH_FAILED',
          isNetworkError: true,
          raw: err,
        });
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request(endpoint, options = {}, isRetry = false) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const config = {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    };

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkErr) {
      throw new ApiError(
        'Unable to connect to the server. Please check your internet connection.',
        {
          status: 0,
          code: 'NETWORK_ERROR',
          isNetworkError: true,
          raw: networkErr,
        }
      );
    }

    // Handle 401 Unauthorized for expired access tokens
    if (
      response.status === 401 &&
      !isRetry &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/refresh') &&
      !endpoint.includes('/auth/register')
    ) {
      try {
        const newAccessToken = await this.refreshAccessToken();
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return this.request(endpoint, config, true);
      } catch (refreshErr) {
        this.notifySessionExpired();
        throw new ApiError('Session expired. Please log in again.', {
          status: 401,
          code: 'SESSION_EXPIRED',
          raw: refreshErr,
        });
      }
    }

    let parsedData = null;
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isJson) {
      try {
        parsedData = await response.json();
      } catch {
        parsedData = null;
      }
    } else {
      try {
        parsedData = await response.text();
      } catch {
        parsedData = null;
      }
    }

    if (!response.ok) {
      const requestId =
        parsedData?.error?.requestId ||
        response.headers.get('x-request-id') ||
        null;

      let code = 'HTTP_ERROR';
      let message = '';
      let details = [];

      if (parsedData && typeof parsedData === 'object') {
        // Standard error shape: { success: false, error: { code, message, details, requestId } }
        if (parsedData.error) {
          code = parsedData.error.code || code;
          message = parsedData.error.message || '';
          details = Array.isArray(parsedData.error.details)
            ? parsedData.error.details
            : [];
        } else if (parsedData.message) {
          message = parsedData.message;
          if (Array.isArray(parsedData.errors)) {
            details = parsedData.errors;
          }
        }
      }

      if (!message) {
        if (response.status === 404) {
          code = 'NOT_FOUND';
          message = 'The requested resource was not found.';
        } else if (response.status === 401) {
          code = 'UNAUTHORIZED';
          message = 'Authentication required.';
        } else if (response.status === 403) {
          code = 'FORBIDDEN';
          message = 'You do not have permission to access this resource.';
        } else if (response.status === 429) {
          code = 'RATE_LIMIT_EXCEEDED';
          message = 'Too many requests. Please slow down and try again.';
        } else if (response.status >= 500) {
          code = 'SERVER_ERROR';
          message = 'The server encountered an error. Please try again later.';
        } else {
          message = `Request failed with status ${response.status}`;
        }
      }

      throw new ApiError(message, {
        status: response.status,
        code,
        details,
        requestId,
        raw: parsedData,
      });
    }

    return parsedData;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
