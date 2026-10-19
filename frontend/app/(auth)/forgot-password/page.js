'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // Regardless of error, do not reveal if email exists
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-stormy-main tracking-tight">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-stormy-muted">
          Enter your account email and we will send you instructions to reset your password.
        </p>
      </div>

      {submitted ? (
        <div className="space-y-5">
          <Alert variant="info" title="Check your inbox">
            If an account is associated with <strong className="text-stormy-main">{email}</strong>, you will receive an email with instructions to reset your password shortly.
          </Alert>

          <div className="pt-2">
            <Link href="/login">
              <Button variant="primary" size="md" className="w-full">
                Return to Sign In
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Email address"
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            error={error}
            required
            autoComplete="email"
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
            Send Reset Instructions
          </Button>

          <div className="text-center text-sm text-stormy-muted pt-2 border-t border-stormy-border">
            Remember your password?{' '}
            <Link
              href="/login"
              className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors underline"
            >
              Sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
