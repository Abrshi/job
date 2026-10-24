'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!token && !isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <Alert variant="danger" title="Invalid or missing reset token">
          No password reset token was found in your link. Please request a new password reset.
        </Alert>
        <Link href="/forgot-password">
          <Button variant="primary" size="md" className="w-full">
            Request Password Reset
          </Button>
        </Link>
      </div>
    );
  }

  const validate = () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = 'New password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: password,
      });

      // Clear token from visible address bar for privacy
      if (typeof window !== 'undefined' && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setIsSuccess(true);
    } catch (err) {
      setSubmitError(
        err.message || 'Failed to reset password. The reset link may be expired or already used.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 bg-feedback-success-bg border border-feedback-success-border rounded-full flex items-center justify-center mx-auto text-feedback-success">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-stormy-main">Password reset complete!</h1>
          <p className="mt-2 text-sm text-stormy-muted">
            Your password has been securely updated. You can now log in with your new credentials.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="primary" size="md" className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-stormy-main tracking-tight">
          Create new password
        </h1>
        <p className="mt-1 text-sm text-stormy-muted">
          Choose a strong password with at least 8 characters.
        </p>
      </div>

      {submitError && (
        <Alert variant="danger" title="Reset failed">
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="New password"
          id="reset-password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
          }}
          error={errors.password}
          helperText="Minimum 8 characters"
          required
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Input
          label="Confirm new password"
          id="reset-confirmPassword"
          type="password"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
          }}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Update Password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-stormy-muted">Loading reset form...</div>}>
      <div className="w-full bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card">
        <ResetPasswordForm />
      </div>
    </Suspense>
  );
}

