'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function ProfilePage() {
  const { user, isEmailVerified, logout } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  const initial = (user.firstName || user.email).charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Profile Card */}
      <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-2xl font-bold text-stormy-dark">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-stormy-main tracking-tight">
                  {fullName}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stormy-mist/40 text-stormy-dark border border-stormy-mist">
                  {user.role}
                </span>
              </div>
              <p className="text-sm text-stormy-muted mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={handleLogout}
              loading={isLoggingOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Email Verification Status & Restriction Notice */}
      {!isEmailVerified ? (
        <Alert
          variant="warning"
          title="Email Verification Required"
        >
          <div className="space-y-2 mt-1">
            <p className="text-sm text-feedback-warning-text">
              Your account email has not been verified yet. In accordance with platform security policy, CV uploads and personalized job recommendations remain locked until verification is confirmed.
            </p>
            <div className="pt-1">
              <Link href="/verify-email">
                <Button variant="cta" size="sm">
                  Complete Email Verification
                </Button>
              </Link>
            </div>
          </div>
        </Alert>
      ) : (
        <Alert variant="success" title="Account Verified">
          Your email address is verified. All personalized job matching, application tracking, and profile features are fully unlocked.
        </Alert>
      )}

      {/* Account Details & Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-stormy-main border-b border-stormy-border pb-3">
            Profile Details
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="block text-xs font-medium text-stormy-muted uppercase tracking-wider">
                Full Name
              </span>
              <span className="font-medium text-stormy-main">{fullName}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-stormy-muted uppercase tracking-wider">
                Email Address
              </span>
              <span className="font-medium text-stormy-main">{user.email}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-stormy-muted uppercase tracking-wider">
                Assigned Role
              </span>
              <span className="font-medium text-stormy-main">{user.role}</span>
            </div>
            {user.createdAt && (
              <div>
                <span className="block text-xs font-medium text-stormy-muted uppercase tracking-wider">
                  Member Since
                </span>
                <span className="font-medium text-stormy-main">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Security & Authentication Info */}
        <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-stormy-main border-b border-stormy-border pb-3">
            Security & Session
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="block font-medium text-stormy-main">Active Session</span>
                <span className="text-xs text-stormy-muted">
                  Secured with rotating HttpOnly refresh tokens
                </span>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-feedback-success-bg text-feedback-success-text border border-feedback-success-border">
                Active
              </span>
            </div>

            <div className="pt-2 border-t border-stormy-border">
              <span className="block font-medium text-stormy-main">Access Tokens</span>
              <span className="text-xs text-stormy-muted">
                Held strictly in memory and refreshed automatically via backend session cookies.
              </span>
            </div>

            <div className="pt-2 border-t border-stormy-border flex justify-between items-center">
              <div>
                <span className="block font-medium text-stormy-main">Password</span>
                <span className="text-xs text-stormy-muted">
                  Hashed with Argon2id on server
                </span>
              </div>
              <Link href="/forgot-password">
                <Button variant="ghost" size="sm">
                  Change
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

