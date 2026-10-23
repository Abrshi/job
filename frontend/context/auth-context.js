'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Manual retry function for components
  const restoreSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await apiClient.refreshAccessToken();
      if (token) {
        const meRes = await apiClient.get('/auth/me');
        setUser(meRes?.data?.user || null);
      }
    } catch (err) {
      if (err.isNetworkError) {
        setError('Network error: Unable to connect to authentication service.');
      } else {
        setUser(null);
        apiClient.clearAccessToken();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize session from HttpOnly cookie on initial mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const token = await apiClient.refreshAccessToken();
        if (token && isMounted) {
          const meRes = await apiClient.get('/auth/me');
          if (isMounted) {
            setUser(meRes?.data?.user || null);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.isNetworkError) {
          setError('Network error: Unable to connect to authentication service.');
        } else {
          setUser(null);
          apiClient.clearAccessToken();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen to session expired events from the API client interceptor
    const unsubscribe = apiClient.onSessionExpired(() => {
      if (isMounted) {
        setUser(null);
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
      const res = await apiClient.post('/auth/login', { email, password });
      const { user: userData, accessToken } = res.data;
      apiClient.setAccessToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/auth/register', formData);
      const { user: userData, accessToken } = res.data;
      apiClient.setAccessToken(accessToken);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.warn('Backend logout warning:', err.message);
    } finally {
      apiClient.clearAccessToken();
      setUser(null);
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      if (res?.data?.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
  };

  const updateUserAvatar = (avatarUrl) => {
    setUser((prev) => (prev ? { ...prev, avatarUrl } : prev));
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    isEmailVerified: Boolean(user?.isEmailVerified),
    login,
    register,
    logout,
    restoreSession,
    refreshUser,
    updateUserAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

