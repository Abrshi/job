'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { getAvatarUrl } from '@/lib/jobs-api';
import { NotificationBell } from '@/components/notifications/notification-bell';

function NavbarContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isNavActive = (href) => {
    if (href === '/jobs') {
      return (
        pathname === '/jobs' ||
        (pathname.startsWith('/jobs/') &&
          !pathname.startsWith('/jobs/saved') &&
          !pathname.startsWith('/jobs/saved-searches') &&
          !pathname.startsWith('/jobs/applications'))
      );
    }
    if (href === '/jobs/saved') {
      return pathname === '/jobs/saved' || pathname.startsWith('/jobs/saved/');
    }
    if (href === '/jobs/saved-searches') {
      return pathname === '/jobs/saved-searches' || pathname.startsWith('/jobs/saved-searches/');
    }
    if (href === '/jobs/applications') {
      return pathname === '/jobs/applications' || pathname.startsWith('/jobs/applications/');
    }
    if (href === '/documents') {
      return pathname === '/documents' || pathname.startsWith('/documents/');
    }
    if (href === '/profile') {
      return pathname === '/profile' || pathname.startsWith('/profile/');
    }
    if (href === '/notifications') {
      return pathname === '/notifications' || pathname.startsWith('/notifications/');
    }
    if (href === '/admin') {
      return pathname.startsWith('/admin');
    }
    return pathname === href;
  };

  const getDesktopNavLinkClass = (href) => {
    const active = isNavActive(href);
    return active
      ? 'px-3 py-1.5 rounded-lg text-sm font-bold text-stormy-dark bg-stormy-sky/20 border border-stormy-sky/40 transition-colors shadow-2xs'
      : 'px-3 py-1.5 rounded-lg text-sm font-medium text-stormy-muted hover:text-stormy-dark hover:bg-stormy-canvas transition-colors';
  };

  const getMobileNavLinkClass = (href) => {
    const active = isNavActive(href);
    return active
      ? 'block px-3 py-2 rounded-lg text-sm font-bold bg-stormy-sky/20 text-stormy-dark border border-stormy-sky/30'
      : 'block px-3 py-2 rounded-lg text-sm font-medium text-stormy-muted hover:text-stormy-dark hover:bg-stormy-canvas';
  };

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
      <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6 xl:gap-8">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-stormy-dark flex items-center justify-center text-stormy-sky font-bold text-lg shadow-subtle group-hover:bg-stormy-darkHover transition-colors">
                J
              </div>
              <span className="font-semibold text-lg text-stormy-dark tracking-tight">
                Job<span className="text-stormy-sky">Platform</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1.5 text-sm text-stormy-muted">
              <Link href="/jobs" className={getDesktopNavLinkClass('/jobs')}>
                Browse Jobs
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/jobs/saved" className={getDesktopNavLinkClass('/jobs/saved')}>
                    Saved Jobs
                  </Link>
                  <Link href="/jobs/saved-searches" className={getDesktopNavLinkClass('/jobs/saved-searches')}>
                    Saved Searches
                  </Link>
                  <Link href="/jobs/applications" className={getDesktopNavLinkClass('/jobs/applications')}>
                    Applications
                  </Link>
                  <Link href="/documents" className={getDesktopNavLinkClass('/documents')}>
                    My Documents
                  </Link>
                  <Link href="/profile" className={getDesktopNavLinkClass('/profile')}>
                    Profile
                  </Link>
                </>
              )}
              {isAuthenticated && user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={
                    isNavActive('/admin')
                      ? 'px-3 py-1.5 rounded-lg text-sm font-bold text-stormy-dark bg-stormy-sky/30 border border-stormy-sky/50 flex items-center gap-1.5 shadow-2xs'
                      : 'px-3 py-1.5 rounded-lg text-sm font-semibold text-stormy-sky hover:text-stormy-skyHover hover:bg-stormy-sky/10 transition-colors flex items-center gap-1.5'
                  }
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
              <div className="flex items-center gap-3">
                <NotificationBell />

                <Link
                  href={user?.role === 'ADMIN' ? '/admin' : '/profile'}
                  className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-stormy-canvas transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-xs font-semibold text-stormy-dark overflow-hidden shrink-0">
                    {user?.avatarUrl ? (
                      <img
                        src={getAvatarUrl(user.avatarUrl)}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
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
          <div className="flex items-center gap-2 md:hidden">
            {isAuthenticated && <NotificationBell />}

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
        <div className="md:hidden border-t border-stormy-border bg-white px-4 pt-2 pb-4 space-y-1.5 shadow-card">
          <Link
            href="/jobs"
            onClick={() => setIsMobileMenuOpen(false)}
            className={getMobileNavLinkClass('/jobs')}
          >
            Browse Jobs
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/jobs/saved"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/jobs/saved')}
              >
                Saved Jobs
              </Link>
              <Link
                href="/jobs/saved-searches"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/jobs/saved-searches')}
              >
                Saved Searches
              </Link>
              <Link
                href="/notifications"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/notifications')}
              >
                Notifications
              </Link>
              <Link
                href="/jobs/applications"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/jobs/applications')}
              >
                My Applications
              </Link>
              <Link
                href="/documents"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/documents')}
              >
                My Documents
              </Link>
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className={getMobileNavLinkClass('/profile')}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-[10px] font-semibold text-stormy-dark overflow-hidden shrink-0">
                    {user?.avatarUrl ? (
                      <img
                        src={getAvatarUrl(user.avatarUrl)}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>My Profile ({displayName})</span>
                </div>
              </Link>
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={
                    isNavActive('/admin')
                      ? 'block px-3 py-2 rounded-lg text-sm font-bold bg-stormy-sky/30 text-stormy-dark border border-stormy-sky/40'
                      : 'block px-3 py-2 rounded-lg text-sm font-bold text-stormy-sky hover:text-stormy-skyHover hover:bg-stormy-sky/10'
                  }
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

function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-stormy-border">
      <div className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stormy-dark flex items-center justify-center text-stormy-sky font-bold text-lg">
            J
          </div>
          <span className="font-semibold text-lg text-stormy-dark tracking-tight">
            Job<span className="text-stormy-sky">Platform</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export function Navbar() {
  return (
    <React.Suspense fallback={<NavbarFallback />}>
      <NavbarContent />
    </React.Suspense>
  );
}
