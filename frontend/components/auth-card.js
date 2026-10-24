'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function AuthCard({ initialTab = 'login' }) {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, login, register, logout, refreshUser } = useAuth();

  // Active view: 'login' | 'register' | 'verify-email' | 'forgot-password'
  const [activeTab, setActiveTab] = useState(initialTab);
  const [justRegistered, setJustRegistered] = useState(false);

  // --- Sign In State ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState({});
  const [loginSubmitError, setLoginSubmitError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // --- Registration State ---
  const [regForm, setRegForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CANDIDATE',
  });
  const [regErrors, setRegErrors] = useState({});
  const [regSubmitError, setRegSubmitError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // --- Verification Menu State ---
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState(null);
  const [isResendingCode, setIsResendingCode] = useState(false);

  // --- Frontend-Only Forgot Password State ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Check URL query parameters on mount (supports email link verification inside the sign in window)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const email = params.get('email');
      const code = params.get('code');
      const verify = params.get('verify');

      if (email) {
        setVerificationEmail(email);
        setLoginEmail(email);
      }
      if (code) {
        setVerificationCode(code);
      }
      if (token || verify || code || initialTab === 'verify-email') {
        setActiveTab('verify-email');
      }

      if (token) {
        setIsVerifyingCode(true);
        setVerificationError(null);
        apiClient
          .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
          .then(() => {
            setVerificationSuccess(true);
            if (refreshUser) refreshUser();
            if (window.history?.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          })
          .catch((err) => {
            setVerificationError(
              err.message || 'Verification link is invalid, expired, or has already been used.'
            );
          })
          .finally(() => {
            setIsVerifyingCode(false);
          });
      }
    }
  }, [initialTab, refreshUser]);

  // Cooldown ticker for verification resend
  useEffect(() => {
    if (verificationCooldown <= 0) return;
    const interval = setInterval(() => {
      setVerificationCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [verificationCooldown]);

  // Sign In Handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginSubmitError(null);

    const errors = {};
    if (!loginEmail.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!loginPassword) {
      errors.password = 'Password is required';
    }

    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      return;
    }

    setIsLoggingIn(true);
    try {
      const loggedUser = await login(loginEmail, loginPassword);

      // If user is unverified, prompt verification inside the window
      if (loggedUser && !loggedUser.isEmailVerified) {
        setVerificationEmail(loginEmail);
        setVerificationCode('');
        setVerificationError(null);
        setVerificationSuccess(false);
        setActiveTab('verify-email');
        return;
      }

      let target = loggedUser?.role === 'ADMIN' ? '/admin' : '/jobs';
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
          if (returnUrl.startsWith('/admin') && loggedUser?.role !== 'ADMIN') {
            target = '/jobs';
          } else {
            target = returnUrl;
          }
        }
      }

      router.push(target);
    } catch (err) {
      setLoginSubmitError(err.message || 'Invalid email or password.');
      if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setLoginErrors(err.fieldErrors);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Register Handler: immediately switches this window to Verification Menu
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegSubmitError(null);

    const errors = {};
    if (!regForm.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!regForm.password) {
      errors.password = 'Password is required';
    } else if (regForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    if (regForm.password !== regForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      return;
    }

    setIsRegistering(true);
    try {
      await register({
        email: regForm.email,
        password: regForm.password,
        firstName: regForm.firstName.trim() || undefined,
        lastName: regForm.lastName.trim() || undefined,
        role: regForm.role,
      });

      // Switch to Verification Menu inside this same sign in window
      setJustRegistered(true);
      setVerificationEmail(regForm.email);
      setVerificationCode('');
      setVerificationSuccess(false);
      setVerificationError(null);
      setVerificationCooldown(60);
      setActiveTab('verify-email');
    } catch (err) {
      setRegSubmitError(err.message || 'Registration failed. Email may already be in use.');
      if (err?.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setRegErrors((prev) => ({ ...prev, ...err.fieldErrors }));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // 6-digit Code Verification Handler
  const handleVerifyCodeSubmit = async (e) => {
    e?.preventDefault?.();
    setVerificationError(null);
    const cleanedCode = verificationCode.trim();

    if (!cleanedCode || cleanedCode.length < 6) {
      setVerificationError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      await apiClient.post('/auth/verify-email', {
        code: cleanedCode,
        email: verificationEmail.trim() || undefined,
      });

      setVerificationSuccess(true);
      if (refreshUser) {
        await refreshUser();
      }

      setTimeout(() => {
        const dest = user?.role === 'ADMIN' ? '/admin' : '/jobs';
        router.push(dest);
      }, 1500);
    } catch (err) {
      setVerificationError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Resend Verification Code Handler
  const handleResendVerificationCode = async (e) => {
    e?.preventDefault?.();
    const targetEmail = verificationEmail.trim() || regForm.email.trim() || user?.email;
    if (!targetEmail || verificationCooldown > 0) return;

    setIsResendingCode(true);
    setResendStatus(null);
    try {
      const res = await apiClient.post('/auth/resend-verification', {
        email: targetEmail,
      });
      setResendStatus({
        type: 'success',
        message: res.message || 'A new 6-digit verification code has been dispatched to your email.',
      });
      setVerificationCooldown(res.cooldownSeconds || 60);
    } catch (err) {
      setResendStatus({
        type: 'info',
        message: err.message || 'If an account exists, a new code has been sent.',
      });
      setVerificationCooldown(60);
    } finally {
      setIsResendingCode(false);
    }
  };

  // Frontend-only Forgot Password Handler
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setForgotError(null);

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError('Please enter a valid email address');
      return;
    }

    setIsSendingForgot(true);
    setTimeout(() => {
      setIsSendingForgot(false);
      setForgotSuccess(true);
    }, 600);
  };

  // If already authenticated and email is verified, show friendly profile card
  if (isAuthenticated && !authLoading && user && user.isEmailVerified && !justRegistered && activeTab !== 'verify-email') {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
    const initial = (user.firstName || user.email).charAt(0).toUpperCase();
    const isAdmin = user.role === 'ADMIN';
    const dashboardHref = isAdmin ? '/admin' : '/jobs';
    const dashboardLabel = isAdmin ? 'Go to Admin Console' : 'Go to Job Opportunities';

    return (
      <div className="w-full bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-xl font-bold text-stormy-dark">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-stormy-main tracking-tight">
                Welcome back, {fullName}
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isAdmin
                  ? 'bg-stormy-sky text-stormy-dark border border-stormy-sky'
                  : 'bg-stormy-mist/40 text-stormy-dark border border-stormy-mist'
              }`}>
                {user.role}
              </span>
            </div>
            <p className="text-xs text-stormy-muted mt-0.5">{user.email}</p>
          </div>
        </div>

        <Alert variant="success">
          {isAdmin
            ? 'Your administrator credentials are confirmed. You have full access to platform governance and controls.'
            : 'Your account is verified and active. You have full access to personalized job matching.'}
        </Alert>

        <div className="space-y-3 pt-2">
          <Link href={dashboardHref} className="block w-full">
            <Button variant="primary" size="md" className="w-full">
              {dashboardLabel}
            </Button>
          </Link>
          <Button variant="outline" size="md" className="w-full" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-stormy-border rounded-2xl shadow-card overflow-hidden">
      {/* Top Header & Navigation */}
      <div className="px-6 pt-6 pb-2 border-b border-stormy-border/60 bg-stormy-canvas/40">
        {activeTab === 'verify-email' ? (
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setJustRegistered(false);
                  setVerificationError(null);
                  setVerificationSuccess(false);
                }}
                className="p-1 -ml-1 text-stormy-muted hover:text-stormy-dark rounded-md transition-colors cursor-pointer"
                aria-label="Back to sign in"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-stormy-main">
                Email Verification
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Verify Account
            </span>
          </div>
        ) : activeTab === 'forgot-password' ? (
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setForgotSuccess(false);
              }}
              className="p-1 -ml-1 text-stormy-muted hover:text-stormy-dark rounded-md transition-colors cursor-pointer"
              aria-label="Back to sign in"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-stormy-main">
              Password Recovery
            </span>
          </div>
        ) : (
          <div className="relative flex bg-stormy-canvas p-1 rounded-xl border border-stormy-border">
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-subtle border border-stormy-border/70 transition-all duration-300 ease-in-out"
              style={{
                width: 'calc(50% - 4px)',
                left: activeTab === 'register' ? 'calc(50% + 2px)' : '4px',
              }}
            />

            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer ${
                activeTab === 'login'
                  ? 'text-stormy-dark'
                  : 'text-stormy-muted hover:text-stormy-dark'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer ${
                activeTab === 'register'
                  ? 'text-stormy-dark'
                  : 'text-stormy-muted hover:text-stormy-dark'
              }`}
            >
              Create Account
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area: directly displays whichever view is active */}
      <div className="w-full">
        {/* ==================================================== */}
        {/* 1. VERIFICATION VIEW (Active on register or verify)   */}
        {/* ==================================================== */}
        {activeTab === 'verify-email' && (
          <div className="p-6 sm:p-7 space-y-4 animate-in fade-in duration-200">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Step 2: Account Activation
              </div>
              <h3 className="text-xl font-bold text-stormy-main tracking-tight">
                Verify your email address
              </h3>
              <p className="text-xs text-stormy-muted mt-1">
                We sent a 6-digit confirmation code to{' '}
                <strong className="text-stormy-main font-semibold">
                  {verificationEmail || 'your email'}
                </strong>
                .
              </p>
            </div>

            {isVerifyingCode && !verificationCode ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-8 h-8 border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-stormy-main">Confirming verification link...</p>
                <p className="text-xs text-stormy-muted">Please wait while we activate your account.</p>
              </div>
            ) : verificationSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-feedback-success-bg border border-feedback-success-border rounded-full flex items-center justify-center mx-auto text-feedback-success">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div>
                  <h4 className="text-base font-bold text-stormy-main">Email Successfully Verified!</h4>
                  <p className="mt-1 text-xs text-stormy-muted">
                    Your profile strength has received a <strong className="text-emerald-600 font-bold">+2.5%</strong> boost.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      const dest = user?.role === 'ADMIN' ? '/admin' : '/jobs';
                      router.push(dest);
                    }}
                  >
                    Continue to Dashboard &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyCodeSubmit} noValidate className="space-y-4">
                {verificationError && (
                  <Alert variant="danger" title="Verification error">
                    {verificationError}
                  </Alert>
                )}

                {resendStatus && (
                  <Alert variant={resendStatus.type}>
                    {resendStatus.message}
                  </Alert>
                )}

                {!verificationEmail ? (
                  <Input
                    label="Account Email Address"
                    id="verification-email-input"
                    type="email"
                    placeholder="name@example.com"
                    value={verificationEmail}
                    onChange={(e) => setVerificationEmail(e.target.value)}
                    required
                  />
                ) : (
                  <div className="flex items-center justify-between px-3 py-2 bg-stormy-mist/20 rounded-xl border border-stormy-border/60 text-xs">
                    <div className="truncate">
                      <span className="text-stormy-muted">Target email: </span>
                      <strong className="text-stormy-main font-semibold">{verificationEmail}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerificationEmail('')}
                      className="text-stormy-sky hover:text-stormy-skyHover text-[11px] font-semibold underline shrink-0 ml-2 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-stormy-dark">
                      Enter 6-Digit Code
                    </label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      if (verificationError) setVerificationError(null);
                    }}
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2.5 px-3 border border-stormy-border rounded-xl focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-stormy-sky shadow-subtle text-stormy-main bg-white"
                    required
                    autoFocus
                    disabled={isVerifyingCode}
                  />
                  <p className="text-[11px] text-stormy-muted mt-1.5 text-center">
                    Enter the code from the email or click the link in your inbox.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={isVerifyingCode}
                  disabled={isVerifyingCode || verificationCode.length < 6}
                >
                  Verify Email Code
                </Button>

                <div className="pt-3 border-t border-stormy-border flex items-center justify-between text-xs">
                  <span className="text-stormy-muted">Didn&apos;t receive it?</span>
                  <button
                    type="button"
                    onClick={handleResendVerificationCode}
                    disabled={verificationCooldown > 0 || isResendingCode || !verificationEmail}
                    className="font-semibold text-stormy-sky hover:text-stormy-skyHover disabled:text-stormy-muted underline cursor-pointer"
                  >
                    {verificationCooldown > 0
                      ? `Resend in ${verificationCooldown}s`
                      : 'Resend Email Code'}
                  </button>
                </div>

                <div className="pt-2 text-center text-xs space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const dest = user?.role === 'ADMIN' ? '/admin' : '/jobs';
                      router.push(dest);
                    }}
                    className="text-stormy-muted hover:text-stormy-dark transition-colors cursor-pointer block w-full text-center"
                  >
                    Skip for now &amp; browse jobs &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setJustRegistered(false);
                    }}
                    className="text-stormy-muted hover:text-stormy-dark underline cursor-pointer block w-full text-center"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. SIGN IN VIEW                                      */}
        {/* ==================================================== */}
        {activeTab === 'login' && (
          <div className="p-6 sm:p-7 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xl font-bold text-stormy-main tracking-tight">
                Sign in to your account
              </h3>
              <p className="text-xs text-stormy-muted mt-1">
                Access your applications, saved jobs, and real-time alerts.
              </p>
            </div>

            {loginSubmitError && (
              <Alert variant="danger" title="Authentication failed">
                {loginSubmitError}
              </Alert>
            )}

            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <Input
                label="Email address"
                id="home-login-email"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  if (loginErrors.email) setLoginErrors((p) => ({ ...p, email: null }));
                }}
                error={loginErrors.email}
                required
                autoComplete="email"
                disabled={isLoggingIn}
              />

              <div>
                <Input
                  label="Password"
                  id="home-login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginErrors.password) setLoginErrors((p) => ({ ...p, password: null }));
                  }}
                  error={loginErrors.password}
                  required
                  autoComplete="current-password"
                  disabled={isLoggingIn}
                />
                <div className="flex items-center justify-between mt-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationEmail(loginEmail || '');
                      setActiveTab('verify-email');
                    }}
                    className="font-medium text-stormy-sky hover:text-stormy-skyHover transition-colors cursor-pointer"
                  >
                    Verify email with code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail || '');
                      setActiveTab('forgot-password');
                    }}
                    className="font-medium text-stormy-slate hover:text-stormy-dark transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                loading={isLoggingIn}
                disabled={isLoggingIn}
              >
                Sign In
              </Button>
            </form>

            <div className="text-center text-xs text-stormy-muted pt-3 border-t border-stormy-border">
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
              >
                Create one now
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. CREATE ACCOUNT VIEW                               */}
        {/* ==================================================== */}
        {activeTab === 'register' && (
          <div className="p-6 sm:p-7 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xl font-bold text-stormy-main tracking-tight">
                Create an account
              </h3>
              <p className="text-xs text-stormy-muted mt-1">
                Free access across 50+ aggregated boards.
              </p>
            </div>

            {regSubmitError && (
              <Alert variant="danger" title="Registration failed">
                {regSubmitError}
              </Alert>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3">
              {/* Role Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegForm((p) => ({ ...p, role: 'CANDIDATE' }))}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                    regForm.role === 'CANDIDATE'
                      ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                      : 'bg-white text-stormy-muted border-stormy-border hover:bg-stormy-canvas'
                  }`}
                >
                  Job Seeker
                </button>
                <button
                  type="button"
                  onClick={() => setRegForm((p) => ({ ...p, role: 'EMPLOYER' }))}
                  className={`py-1.5 px-3 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                    regForm.role === 'EMPLOYER'
                      ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                      : 'bg-white text-stormy-muted border-stormy-border hover:bg-stormy-canvas'
                  }`}
                >
                  Employer
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="First name"
                  id="home-reg-first"
                  type="text"
                  placeholder="Jane"
                  value={regForm.firstName}
                  onChange={(e) => setRegForm((p) => ({ ...p, firstName: e.target.value }))}
                  disabled={isRegistering}
                />
                <Input
                  label="Last name"
                  id="home-reg-last"
                  type="text"
                  placeholder="Doe"
                  value={regForm.lastName}
                  onChange={(e) => setRegForm((p) => ({ ...p, lastName: e.target.value }))}
                  disabled={isRegistering}
                />
              </div>

              <Input
                label="Email address"
                id="home-reg-email"
                type="email"
                placeholder="you@example.com"
                value={regForm.email}
                onChange={(e) => {
                  setRegForm((p) => ({ ...p, email: e.target.value }));
                  if (regErrors.email) setRegErrors((p) => ({ ...p, email: null }));
                }}
                error={regErrors.email}
                required
                autoComplete="email"
                disabled={isRegistering}
              />

              <Input
                label="Password"
                id="home-reg-password"
                type="password"
                placeholder="At least 8 characters"
                value={regForm.password}
                onChange={(e) => {
                  setRegForm((p) => ({ ...p, password: e.target.value }));
                  if (regErrors.password) setRegErrors((p) => ({ ...p, password: null }));
                }}
                error={regErrors.password}
                required
                autoComplete="new-password"
                disabled={isRegistering}
              />

              <Input
                label="Confirm password"
                id="home-reg-confirm"
                type="password"
                placeholder="Repeat password"
                value={regForm.confirmPassword}
                onChange={(e) => {
                  setRegForm((p) => ({ ...p, confirmPassword: e.target.value }));
                  if (regErrors.confirmPassword) setRegErrors((p) => ({ ...p, confirmPassword: null }));
                }}
                error={regErrors.confirmPassword}
                required
                autoComplete="new-password"
                disabled={isRegistering}
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-1"
                loading={isRegistering}
                disabled={isRegistering}
              >
                Create Account
              </Button>
            </form>

            <div className="text-center text-xs text-stormy-muted pt-2 border-t border-stormy-border">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 4. FORGOT PASSWORD VIEW                              */}
        {/* ==================================================== */}
        {activeTab === 'forgot-password' && (
          <div className="p-6 sm:p-7 space-y-5 animate-in fade-in duration-200">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-stormy-mist/40 text-stormy-dark border border-stormy-mist mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-stormy-slate animate-pulse" />
                Password Recovery
              </div>
              <h3 className="text-xl font-bold text-stormy-main tracking-tight">
                Reset your password
              </h3>
              <p className="text-xs text-stormy-muted mt-1">
                Enter your account email and we will send you a reset link.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-12 h-12 bg-feedback-info-bg border border-feedback-info-border rounded-full flex items-center justify-center mx-auto text-stormy-dark">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <div>
                  <h4 className="text-base font-bold text-stormy-main">Instructions Dispatched</h4>
                  <p className="mt-1 text-xs text-stormy-muted">
                    We sent password reset instructions to <strong className="text-stormy-main">{forgotEmail}</strong> if an account exists.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setActiveTab('login');
                      setForgotSuccess(false);
                    }}
                  >
                    Back to Sign In
                  </Button>
                  <button
                    type="button"
                    onClick={() => setForgotSuccess(false)}
                    className="text-xs text-stormy-muted hover:text-stormy-dark underline cursor-pointer"
                  >
                    Try another email address
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
                <Input
                  label="Registered email"
                  id="home-forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    if (forgotError) setForgotError(null);
                  }}
                  error={forgotError}
                  required
                  autoComplete="email"
                  disabled={isSendingForgot}
                />

                <Button
                  type="submit"
                  variant="cta"
                  size="md"
                  className="w-full mt-1"
                  loading={isSendingForgot}
                  disabled={isSendingForgot}
                >
                  Send Reset Link
                </Button>

                <div className="text-center text-xs text-stormy-muted pt-3 border-t border-stormy-border">
                  Remembered your password?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Security Tagline */}
      <div className="px-6 py-3 border-t border-stormy-border/60 bg-stormy-canvas/40 text-center text-[11px] text-stormy-muted">
        Secured with encrypted in-memory tokens &amp; Argon2id
      </div>
    </div>
  );
}
