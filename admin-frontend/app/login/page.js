'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function AdminLoginPage() {
  const { admin, isAuthenticated, login, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // If already authenticated as admin, redirect to admin dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && admin?.role === 'ADMIN') {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, admin, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      if (err.status === 403 || err.code === 'ADMIN_ACCESS_DENIED' || err.code === 'FORBIDDEN') {
        setError(
          'Access Denied: You do not have administrative privileges to access this console. Please sign in with an authorized admin account.'
        );
      } else {
        setError(err.message || 'Invalid administrator credentials. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-elevated space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-400/30 text-sky-400 font-bold text-lg mb-2">
            AD
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Admin Console Login</h1>
          <p className="text-xs text-slate-400">
            Sign in with an authorized administrator account to access platform governance and ingestion controls.
          </p>
        </div>

        {error && (
          <Alert variant="danger" title="Authentication Error">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="admin-email">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@job.com"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <Button type="submit" variant="primary" size="md" className="w-full mt-2" loading={submitting}>
            Sign In to Admin Console &rarr;
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
          <p>Standard job seeker or recruiter?</p>
          <a
            href="http://localhost:3000"
            className="text-sky-400 hover:text-sky-300 font-medium transition-colors block"
          >
            &larr; Switch to Job Seeker Portal (Port 3000)
          </a>
        </div>
      </div>
    </div>
  );
}

