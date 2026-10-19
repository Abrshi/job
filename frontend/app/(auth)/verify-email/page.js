'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const verifyToken = async () => {
      setVerifying(true);
      setErrorMessage(null);
      try {
        await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (isMounted) {
          setSuccess(true);
          // Clean token from visible URL history for privacy
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(
            err.message || 'Verification token is invalid, expired, or has already been used.'
          );
        }
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setIsResending(true);
    setResendStatus(null);
    try {
      await apiClient.post('/auth/resend-verification', { email: resendEmail.trim() });
      setResendStatus({
        type: 'success',
        message: 'If an unverified account exists for that email, a new verification link has been sent.',
      });
    } catch (err) {
      setResendStatus({
        type: 'info',
        message: 'If an unverified account exists for that email, a new verification link has been sent.',
      });
    } finally {
      setIsResending(false);
    }
  };

  if (verifying) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-10 h-10 border-4 border-stormy-sky border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-lg font-bold text-stormy-main">Verifying your email address...</h2>
        <p className="text-sm text-stormy-muted">
          Please wait while we confirm your verification token with the server.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 bg-feedback-success-bg border border-feedback-success-border rounded-full flex items-center justify-center mx-auto text-feedback-success">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-stormy-main">Email verified!</h1>
          <p className="mt-2 text-sm text-stormy-muted">
            Thank you! Your email has been verified. You now have full access to personalized job matching and CV uploads.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link href="/profile">
            <Button variant="primary" size="md" className="w-full">
              Go to Profile
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="md" className="w-full">
              Browse Jobs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-stormy-mist/40 border border-stormy-mist rounded-full flex items-center justify-center mx-auto text-stormy-dark mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-stormy-main tracking-tight">
          Verify your email address
        </h1>
        <p className="mt-1 text-sm text-stormy-muted">
          We send a verification link to your email upon registration. Click the link in that email to activate all platform features.
        </p>
      </div>

      {errorMessage && (
        <Alert variant="danger" title="Verification issue">
          {errorMessage}
        </Alert>
      )}

      {resendStatus && (
        <Alert variant={resendStatus.type}>
          {resendStatus.message}
        </Alert>
      )}

      {/* Resend Verification Form */}
      <div className="pt-4 border-t border-stormy-border">
        <h2 className="text-sm font-semibold text-stormy-main mb-2">
          Didn&apos;t receive the email?
        </h2>
        <form onSubmit={handleResend} className="space-y-3">
          <Input
            label="Enter your registered email"
            type="email"
            placeholder="you@example.com"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            required
            disabled={isResending}
          />
          <Button
            type="submit"
            variant="outline"
            size="md"
            className="w-full"
            loading={isResending}
            disabled={isResending || !resendEmail.trim()}
          >
            Resend Verification Email
          </Button>
        </form>
      </div>

      <div className="text-center text-sm text-stormy-muted pt-2 border-t border-stormy-border">
        <Link href="/login" className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors underline">
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-stormy-muted">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
