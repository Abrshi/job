const ADMIN_API_BASE_URL =
  process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5001/api/v1';

export class AdminApiError extends Error {
  constructor(message, { status = 500, code = 'ERROR', details = [] } = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
  }
}

class AdminApiClient {
  constructor() {
    this.accessToken = null;
    this.refreshPromise = null;
    this.onSessionExpiredCallbacks = new Set();
  }

  setAccessToken(token) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('admin_access_token', token);
      } catch (e) {
        // storage disabled
      }
    }
  }

  getAccessToken() {
    if (!this.accessToken && typeof window !== 'undefined') {
      try {
        this.accessToken = sessionStorage.getItem('admin_access_token');
      } catch (e) {}
    }
    return this.accessToken;
  }

  clearAccessToken() {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('admin_access_token');
      } catch (e) {}
    }
  }

  onSessionExpired(cb) {
    this.onSessionExpiredCallbacks.add(cb);
    return () => this.onSessionExpiredCallbacks.delete(cb);
  }

  notifySessionExpired() {
    this.clearAccessToken();
    this.onSessionExpiredCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Admin session callback error:', err);
      }
    });
  }

  async refreshAccessToken() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${ADMIN_API_BASE_URL}/admin/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new AdminApiError(
            errData?.message || 'Admin refresh session invalid or expired',
            { status: response.status, code: errData?.code || 'INVALID_ADMIN_REFRESH_TOKEN' }
          );
        }

        const data = await response.json();
        const newToken = data?.data?.accessToken;
        if (newToken) {
          this.setAccessToken(newToken);
          return newToken;
        }
        throw new AdminApiError('No access token returned by admin refresh endpoint');
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${ADMIN_API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    let token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    } catch (err) {
      throw new AdminApiError('Network error connecting to Admin Backend', {
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }

    // Handle token expiration & automatic rotation once
    if (response.status === 401 && !options._retry && !endpoint.includes('/admin/auth/')) {
      try {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          return this.request(endpoint, { ...options, _retry: true });
        }
      } catch {
        this.notifySessionExpired();
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const message = errData?.message || `Request failed with status ${response.status}`;
      throw new AdminApiError(message, {
        status: response.status,
        code: errData?.code || 'REQUEST_FAILED',
        details: errData?.details || [],
      });
    }

    return response.json();
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const adminApiClient = new AdminApiClient();

