'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { adminApiClient, AdminApiError } from '@/lib/admin-api-client';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await adminApiClient.refreshAccessToken().catch(() => null);
      if (token) {
        const res = await adminApiClient.get('/admin/auth/verify');
        setAdmin(res?.data?.user || null);
      } else {
        setAdmin(null);
      }
    } catch (err) {
      setAdmin(null);
      adminApiClient.clearAccessToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const token = adminApiClient.getAccessToken();
        if (token) {
          const res = await adminApiClient.get('/admin/auth/verify');
          if (isMounted) {
            setAdmin(res?.data?.user || null);
          }
        } else {
          // Attempt cookie refresh
          const refreshedToken = await adminApiClient.refreshAccessToken().catch(() => null);
          if (refreshedToken && isMounted) {
            const res = await adminApiClient.get('/admin/auth/verify');
            if (isMounted) {
              setAdmin(res?.data?.user || null);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setAdmin(null);
          adminApiClient.clearAccessToken();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    init();

    const unsubscribe = adminApiClient.onSessionExpired(() => {
      if (isMounted) {
        setAdmin(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiClient.post('/admin/auth/login', { email, password });
      const { user, accessToken } = res.data;

      // Double-check role server response
      if (user.role !== 'ADMIN') {
        throw new AdminApiError(
          'Access denied. Administrative privileges are required to access this console.',
          { status: 403, code: 'ADMIN_ACCESS_DENIED' }
        );
      }

      adminApiClient.setAccessToken(accessToken);
      setAdmin(user);
      return user;
    } catch (err) {
      const msg = err.message || 'Login failed. Please verify administrative credentials.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await adminApiClient.post('/admin/auth/logout').catch(() => {});
    } finally {
      adminApiClient.clearAccessToken();
      setAdmin(null);
      setLoading(false);
    }
  };

  const value = {
    admin,
    isAuthenticated: !!admin,
    loading,
    error,
    login,
    logout,
    checkSession,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

