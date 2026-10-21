'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const scrollToAuth = (e) => {
    e?.preventDefault?.();
    const el = document.getElementById('auth-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        el.querySelector('input')?.focus();
      }, 400);
    } else {
      router.push('/#auth-card');
    }
  };

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : '';

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-stormy-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-stormy-dark flex items-center justify-center text-stormy-sky font-bold text-lg shadow-subtle group-hover:bg-stormy-darkHover transition-colors">
                J
              </div>
              <span className="font-semibold text-lg text-stormy-dark tracking-tight">
                Job<span className="text-stormy-sky">Platform</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stormy-muted">
              <Link href="/jobs" className="hover:text-stormy-dark transition-colors">
                Browse Jobs
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/jobs/saved" className="hover:text-stormy-dark transition-colors">
                    Saved Jobs
                  </Link>
                  <Link href="/jobs/applications" className="hover:text-stormy-dark transition-colors">
                    Applications
                  </Link>
                  <Link href="/profile" className="hover:text-stormy-dark transition-colors">
                    Profile
                  </Link>
                </>
              )}
              {isAuthenticated && user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="font-semibold text-stormy-sky hover:text-stormy-skyHover transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stormy-sky" />
                  Admin Console
                </Link>
              )}
            </nav>
          </div>

          {/* User / Auth Controls */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="w-24 h-9 bg-slate-100 animate-pulse rounded-lg" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-4">
                <Link
                  href={user?.role === 'ADMIN' ? '/admin' : '/profile'}
                  className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-stormy-canvas transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-xs font-semibold text-stormy-dark">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-stormy-main leading-tight line-clamp-1 max-w-[140px]">
                      {displayName}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-stormy-slate tracking-wider">
                      {user.role}
                    </span>
                  </div>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  loading={isLoggingOut}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={scrollToAuth}>
                  Sign In
                </Button>
                <Button variant="cta" size="sm" onClick={scrollToAuth}>
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-stormy-muted hover:text-stormy-dark hover:bg-stormy-canvas focus:outline-none focus:ring-2 focus:ring-stormy-sky cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-stormy-border bg-white px-4 pt-2 pb-4 space-y-3 shadow-card">
          <Link
            href="/jobs"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
          >
            Browse Jobs
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/jobs/saved"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
              >
                Saved Jobs
              </Link>
              <Link
                href="/jobs/applications"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
              >
                My Applications
              </Link>
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
              >
                My Profile ({displayName})
              </Link>
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-2 text-sm font-bold text-stormy-sky hover:text-stormy-skyHover"
                >
                  Admin Console &rarr;
                </Link>
              )}
              <div className="pt-2 border-t border-stormy-border">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  loading={isLoggingOut}
                >
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <div className="pt-2 border-t border-stormy-border flex flex-col gap-2">
              <Button
                variant="outline"
                size="md"
                className="w-full"
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  scrollToAuth(e);
                }}
              >
                Sign In
              </Button>
              <Button
                variant="cta"
                size="md"
                className="w-full"
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  scrollToAuth(e);
                }}
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
