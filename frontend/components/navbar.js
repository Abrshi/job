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
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
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
              <Link href="/" className="hover:text-stormy-dark transition-colors">
                Browse Jobs
              </Link>
              {isAuthenticated && (
                <Link href="/profile" className="hover:text-stormy-dark transition-colors">
                  My Profile
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
                  href="/profile"
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
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="cta" size="sm">
                    Get Started
                  </Button>
                </Link>
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
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
          >
            Browse Jobs
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-stormy-muted hover:text-stormy-dark"
              >
                My Profile ({displayName})
              </Link>
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
              <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="md" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="cta" size="md" className="w-full">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
