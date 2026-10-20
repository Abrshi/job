const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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
          throw new Error('Refresh session invalid or expired');
        }

        const data = await response.json();
        const newAccessToken = data?.data?.accessToken;
        if (!newAccessToken) {
          throw new Error('No access token returned from refresh');
        }

        this.setAccessToken(newAccessToken);
        return newAccessToken;
      } catch (err) {
        this.clearAccessToken();
        throw err;
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
    } catch (networkError) {
      const error = new Error('Network error. Unable to reach the server.');
      error.isNetworkError = true;
      throw error;
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
      } catch {
        this.notifySessionExpired();
        const err = new Error('Session expired. Please log in again.');
        err.status = 401;
        throw err;
      }
    }

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        data?.message || (typeof data === 'string' ? data : `Request failed with status ${response.status}`);
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      error.errors = data?.errors;
      throw error;
    }

    return data;
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

