'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

function RegisterForm() {
  const router = useRouter();
  const { register, isAuthenticated, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CANDIDATE',
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !registeredSuccess) {
      router.replace('/profile');
    }
  }, [isAuthenticated, authLoading, router, registeredSuccess]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        role: formData.role,
      });
      setRegisteredSuccess(true);
    } catch (err) {
      setSubmitError(
        err.message || 'Registration failed. The email may already be in use.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registeredSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 bg-feedback-success-bg border border-feedback-success-border rounded-full flex items-center justify-center mx-auto text-feedback-success">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-stormy-main">Account created successfully!</h2>
          <p className="mt-2 text-sm text-stormy-muted">
            We have registered your account for <strong className="text-stormy-main">{formData.email}</strong>.
          </p>
        </div>

        <Alert variant="info" title="Verification Notice">
          Please check your email inbox to verify your email address. Email verification is required before uploading CVs and accessing personalized job matching.
        </Alert>

        <div className="pt-2">
          <Link href="/profile">
            <Button variant="primary" size="md" className="w-full">
              Proceed to Profile
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
          Create an account
        </h1>
        <p className="mt-1 text-sm text-stormy-muted">
          Join the platform to discover and track opportunities across all major boards.
        </p>
      </div>

      {submitError && (
        <Alert variant="danger" title="Registration failed">
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Account Role Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-stormy-main">
            I want to <span className="text-feedback-danger">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChange('role', 'CANDIDATE')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                formData.role === 'CANDIDATE'
                  ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                  : 'bg-white text-stormy-muted border-stormy-border hover:bg-stormy-canvas'
              }`}
            >
              Find a Job (Candidate)
            </button>
            <button
              type="button"
              onClick={() => handleChange('role', 'EMPLOYER')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                formData.role === 'EMPLOYER'
                  ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                  : 'bg-white text-stormy-muted border-stormy-border hover:bg-stormy-canvas'
              }`}
            >
              Post Jobs (Employer)
            </button>
          </div>
        </div>

        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            id="register-firstName"
            type="text"
            placeholder="Jane"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            disabled={isSubmitting}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            id="register-lastName"
            type="text"
            placeholder="Doe"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            disabled={isSubmitting}
            autoComplete="family-name"
          />
        </div>

        <Input
          label="Email address"
          id="register-email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          required
          autoComplete="email"
          disabled={isSubmitting}
        />

        <Input
          label="Password"
          id="register-password"
          type="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          error={errors.password}
          helperText="Minimum 8 characters"
          required
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Input
          label="Confirm password"
          id="register-confirmPassword"
          type="password"
          placeholder="Repeat password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full mt-2"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Create Account
        </Button>
      </form>

      <div className="text-center text-sm text-stormy-muted pt-2 border-t border-stormy-border">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="h-40 flex items-center justify-center text-stormy-muted">Loading register...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
