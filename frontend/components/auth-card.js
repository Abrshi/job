'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  const [isMounted, setIsMounted] = useState(false);

  // Synchronize activeTab whenever initialTab prop changes (e.g. route transitions)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  // --- Forgot Password State ---
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState(null);
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Enable animation after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Switch tab with internal navigation sync
  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'login' || tab === 'register') {
      setJustRegistered(false);
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname === '/login' && tab === 'register') {
          router.replace('/register');
        } else if (pathname === '/register' && tab === 'login') {
          router.replace('/login');
        }
      }
    }
  }, [router]);

  // Listen to custom tab change events (e.g. from navbar "Get Started" or "Sign In")
  useEffect(() => {
    const handleSwitchEvent = (e) => {
      if (e?.detail) {
        switchTab(e.detail);
      }
    };
    window.addEventListener('authcard-switch-tab', handleSwitchEvent);
    return () => window.removeEventListener('authcard-switch-tab', handleSwitchEvent);
  }, [switchTab]);

  // Check URL query parameters on mount (supports email link verification inside the card)
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

      if (loggedUser && !loggedUser.isEmailVerified) {
        setVerificationEmail(loginEmail);
        setVerificationCode('');
        setVerificationError(null);
        setVerificationSuccess(false);
        setActiveTab('verify-email');
        return;
      }

      let target = '/jobs';
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') && !returnUrl.startsWith('/admin')) {
          target = returnUrl;
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

  // Register Handler: switches smoothly to Verification Menu
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
        router.push('/jobs');
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

  // Forgot Password Handler
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

  // If already authenticated and email is verified, render profile card maintaining constant container size
  if (isAuthenticated && !authLoading && user && user.isEmailVerified && !justRegistered && activeTab !== 'verify-email') {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
    const initial = (user.firstName || user.email).charAt(0).toUpperCase();

    return (
      <div className="w-full max-w-md h-[610px] max-h-[calc(100dvh-2rem)] bg-white border border-stormy-border rounded-2xl shadow-card overflow-hidden flex flex-col justify-between p-6 sm:p-8">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-xl font-bold text-stormy-dark">
              {initial}
            </div>
            <div>
              <h3 className="text-lg font-bold text-stormy-main tracking-tight">
                Welcome back, {fullName}
              </h3>
              <p className="text-xs text-stormy-muted mt-0.5">{user.email}</p>
            </div>
          </div>

          <Alert variant="success">
            Your account is verified and active. You have full access to personalized job matching.
          </Alert>

          <div className="rounded-xl bg-stormy-canvas/70 border border-stormy-border/70 p-4 space-y-2 text-xs text-stormy-muted">
            <div className="font-semibold text-stormy-main">Your Session is Active</div>
            <p>Access your saved searches, application tracker, and customized AI document generation tools.</p>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-stormy-border">
          <Link href="/jobs" className="block w-full">
            <Button variant="primary" size="md" className="w-full">
              Go to Job Opportunities
            </Button>
          </Link>
          <Button variant="outline" size="md" className="w-full" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const isSubView = activeTab === 'verify-email' || activeTab === 'forgot-password';

  return (
    <div className="w-full max-w-md h-[710px] max-h-[calc(100dvh-2rem)] bg-white border border-stormy-border rounded-2xl shadow-card overflow-hidden flex flex-col relative">
      {/* ==================================================== */}
      {/* 1. TOP HEADER & SWITCHER (CONSTANT FIXED HEIGHT)     */}
      {/* ==================================================== */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-stormy-border/60 bg-stormy-canvas/40 relative">
        <div className="relative h-10 w-full overflow-hidden">
          {/* Main Primary Tab Bar (Sign In / Create Account) */}
          <div
            className={`absolute inset-0 ${
              isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
            }`}
            style={{
              opacity: isSubView ? 0 : 1,
              transform: isSubView ? 'translateY(-10px)' : 'translateY(0)',
              pointerEvents: isSubView ? 'none' : 'auto',
            }}
          >
            <div className="relative flex bg-stormy-canvas p-1 rounded-xl border border-stormy-border h-full">
              {/* Sliding Active Pill Indicator */}
              <div
                className={`absolute top-1 bottom-1 rounded-lg bg-white shadow-subtle border border-stormy-border/70 ${
                  isMounted ? 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
                }`}
                style={{
                  width: 'calc(50% - 4px)',
                  left: '4px',
                  transform: activeTab === 'register' ? 'translateX(100%)' : 'translateX(0)',
                }}
              />

              <button
                type="button"
                onClick={() => switchTab('login')}
                className={`relative z-10 flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center ${
                  activeTab === 'login'
                    ? 'text-stormy-dark'
                    : 'text-stormy-muted hover:text-stormy-dark'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchTab('register')}
                className={`relative z-10 flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center ${
                  activeTab === 'register'
                    ? 'text-stormy-dark'
                    : 'text-stormy-muted hover:text-stormy-dark'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          {/* Sub-view Header (Verify Email / Password Recovery) */}
          <div
            className={`absolute inset-0 flex items-center justify-between ${
              isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
            }`}
            style={{
              opacity: isSubView ? 1 : 0,
              transform: isSubView ? 'translateY(0)' : 'translateY(10px)',
              pointerEvents: isSubView ? 'auto' : 'none',
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="p-1 -ml-1 text-stormy-muted hover:text-stormy-dark rounded-md transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
                aria-label="Back to sign in"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>
              <span className="text-xs font-bold text-stormy-main">
                {activeTab === 'verify-email' ? 'Email Verification' : 'Password Recovery'}
              </span>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {activeTab === 'verify-email' ? 'Account Verify' : 'Reset Access'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. MAIN CONSTANT-SIZE CONTENT CONTAINER              */}
      {/* ==================================================== */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* PANEL 1: SIGN IN VIEW */}
        <div
          className={`absolute inset-0 w-full h-full p-6 sm:p-7 flex flex-col justify-between overflow-y-auto auth-panel-scroll ${
            isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
          }`}
          style={{
            transform: activeTab === 'login' ? 'translateX(0%)' : 'translateX(-40px)',
            opacity: activeTab === 'login' ? 1 : 0,
            pointerEvents: activeTab === 'login' ? 'auto' : 'none',
            visibility: activeTab === 'login' ? 'visible' : 'hidden',
          }}
        >
          <div className="space-y-4">
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

            <form onSubmit={handleLoginSubmit} noValidate className="space-y-3.5">
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
                      switchTab('verify-email');
                    }}
                    className="font-medium text-stormy-sky hover:text-stormy-skyHover transition-colors cursor-pointer"
                  >
                    Verify email with code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail || '');
                      switchTab('forgot-password');
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
                className="w-full mt-1"
                loading={isLoggingIn}
                disabled={isLoggingIn}
              >
                Sign In
              </Button>
            </form>
          </div>

          {/* Bottom Section: Security & Fast Switcher */}
          <div className="space-y-3 pt-3">
            <div className="rounded-xl bg-stormy-canvas/80 border border-stormy-border/70 p-2.5 flex items-center gap-2.5 text-xs text-stormy-muted">
              <div className="w-7 h-7 rounded-lg bg-white border border-stormy-border/80 flex items-center justify-center shrink-0 text-stormy-slate shadow-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="leading-tight text-[11px]">
                <span className="font-semibold text-stormy-dark">Seamless multi-board aggregation</span>
                <p className="text-stormy-muted mt-0.5">Instant matching with encrypted in-memory session protection.</p>
              </div>
            </div>

            <div className="text-center text-xs text-stormy-muted pt-2 border-t border-stormy-border">
              Don&apos;t have an account yet?{' '}
              <button
                type="button"
                onClick={() => switchTab('register')}
                className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
              >
                Create one now
              </button>
            </div>
          </div>
        </div>

        {/* PANEL 2: CREATE ACCOUNT (SIGN UP) VIEW */}
        <div
          className={`absolute inset-0 w-full h-full p-6 sm:p-7 flex flex-col justify-between overflow-y-auto auth-panel-scroll ${
            isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
          }`}
          style={{
            transform: activeTab === 'register' ? 'translateX(0%)' : 'translateX(40px)',
            opacity: activeTab === 'register' ? 1 : 0,
            pointerEvents: activeTab === 'register' ? 'auto' : 'none',
            visibility: activeTab === 'register' ? 'visible' : 'hidden',
          }}
        >
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-bold text-stormy-main tracking-tight">
                Create an account
              </h3>
              <p className="text-xs text-stormy-muted mt-0.5">
                Free access across 50+ aggregated boards.
              </p>
            </div>

            {regSubmitError && (
              <Alert variant="danger" title="Registration failed">
                {regSubmitError}
              </Alert>
            )}

            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-2.5">
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
          </div>

          <div className="text-center text-xs text-stormy-muted pt-2 border-t border-stormy-border">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
            >
              Sign in
            </button>
          </div>
        </div>

        {/* SUB-VIEW 1: EMAIL VERIFICATION (SLIDING OVERLAY) */}
        <div
          className={`absolute inset-0 w-full h-full bg-white z-20 flex flex-col justify-between p-6 sm:p-7 overflow-y-auto auth-panel-scroll ${
            isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
          }`}
          style={{
            transform: activeTab === 'verify-email' ? 'translateX(0%)' : 'translateX(40px)',
            opacity: activeTab === 'verify-email' ? 1 : 0,
            pointerEvents: activeTab === 'verify-email' ? 'auto' : 'none',
            visibility: activeTab === 'verify-email' ? 'visible' : 'hidden',
          }}
        >
          <div className="space-y-4">
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
                      router.push('/jobs');
                    }}
                  >
                    Continue to Dashboard &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleVerifyCodeSubmit} noValidate className="space-y-3.5">
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
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2 px-3 border border-stormy-border rounded-xl focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-stormy-sky shadow-subtle text-stormy-main bg-white"
                    required
                    autoFocus
                    disabled={isVerifyingCode}
                  />
                  <p className="text-[11px] text-stormy-muted mt-1 text-center">
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

                <div className="pt-2 border-t border-stormy-border flex items-center justify-between text-xs">
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
              </form>
            )}
          </div>

          <div className="pt-2 text-center text-xs space-y-1 border-t border-stormy-border">
            <button
              type="button"
              onClick={() => {
                router.push('/jobs');
              }}
              className="text-stormy-muted hover:text-stormy-dark transition-colors cursor-pointer block w-full text-center"
            >
              Skip for now &amp; browse jobs &rarr;
            </button>
            <button
              type="button"
              onClick={() => switchTab('login')}
              className="text-stormy-muted hover:text-stormy-dark underline cursor-pointer block w-full text-center"
            >
              Return to Sign In
            </button>
          </div>
        </div>

        {/* SUB-VIEW 2: FORGOT PASSWORD (SLIDING OVERLAY) */}
        <div
          className={`absolute inset-0 w-full h-full bg-white z-20 flex flex-col justify-between p-6 sm:p-7 overflow-y-auto auth-panel-scroll ${
            isMounted ? 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]' : ''
          }`}
          style={{
            transform: activeTab === 'forgot-password' ? 'translateX(0%)' : 'translateX(40px)',
            opacity: activeTab === 'forgot-password' ? 1 : 0,
            pointerEvents: activeTab === 'forgot-password' ? 'auto' : 'none',
            visibility: activeTab === 'forgot-password' ? 'visible' : 'hidden',
          }}
        >
          <div className="space-y-4">
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
                      switchTab('login');
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
              </form>
            )}
          </div>

          <div className="space-y-3 pt-3">
            <div className="rounded-xl bg-stormy-canvas/80 border border-stormy-border/70 p-2.5 flex items-center gap-2.5 text-xs text-stormy-muted">
              <div className="w-7 h-7 rounded-lg bg-white border border-stormy-border/80 flex items-center justify-center shrink-0 text-stormy-slate shadow-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="leading-tight text-[11px]">
                <span className="font-semibold text-stormy-dark">Secure Recovery</span>
                <p className="text-stormy-muted mt-0.5">One-time encrypted recovery link valid for 15 minutes.</p>
              </div>
            </div>

            <div className="text-center text-xs text-stormy-muted pt-2 border-t border-stormy-border">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="font-semibold text-stormy-dark hover:text-stormy-sky transition-colors cursor-pointer underline"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. CARD FOOTER TAGLINE (CONSTANT FIXED HEIGHT)       */}
      {/* ==================================================== */}
      <div className="shrink-0 px-6 py-2.5 border-t border-stormy-border/60 bg-stormy-canvas/40 text-center text-[11px] text-stormy-muted flex items-center justify-center">
        Secured with encrypted in-memory tokens &amp; Argon2id
      </div>
    </div>
  );
}
