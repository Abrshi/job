'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';

const NAV_ITEMS = [
  {
    name: 'Overview',
    href: '/admin',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Jobs Management',
    href: '/admin/jobs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'Job Sources',
    href: '/admin/sources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: 'AI Classification',
    href: '/admin/classifications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    name: 'Site Branding',
    href: '/admin/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteName, setSiteName] = useState('JobSphere');

  // Load site branding
  useEffect(() => {
    async function loadBranding() {
      try {
        const res = await apiClient.get('/settings');
        if (res?.data?.settings?.siteName) {
          setSiteName(res.data.settings.siteName);
        }
      } catch {
        // Fallback to default
      }
    }
    loadBranding();
  }, []);

  // Enforce ADMIN role
  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace(`/?auth=login&returnUrl=${encodeURIComponent(pathname)}`);
      } else if (user?.role !== 'ADMIN') {
        router.replace('/');
      }
    }
  }, [loading, isAuthenticated, user, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stormy-canvas flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-stormy-sky border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-stormy-muted animate-pulse">
          Verifying administrator credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-stormy-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-card border border-stormy-border space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-feedback-danger-bg text-feedback-danger flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stormy-main">Access Denied</h2>
          <p className="text-sm text-stormy-muted">
            You must be signed in with an active <strong>ADMIN</strong> account to access the administrative control console.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg transition-colors"
            >
              Return to Public Platform
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stormy-canvas flex flex-col lg:flex-row">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-stormy-dark text-white px-4 py-3 flex items-center justify-between shadow-subtle border-b border-stormy-slate/30">
        <div className="flex items-center space-x-2">
          <span className="font-bold tracking-tight text-white">{siteName}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-stormy-sky text-stormy-dark px-2 py-0.5 rounded">
            Admin
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-stormy-mist hover:text-white hover:bg-white/10"
          aria-label="Toggle Navigation"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-stormy-dark text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-stormy-slate/20 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white tracking-tight">{siteName}</span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-stormy-sky text-stormy-dark px-1.5 py-0.5 rounded">
                Admin
              </span>
            </div>
            <p className="text-xs text-stormy-mist/70 mt-0.5">Control & Intelligence Console</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isActive
                    ? 'bg-stormy-sky text-stormy-dark shadow-subtle font-semibold'
                    : 'text-stormy-mist hover:text-white hover:bg-white/10'
                }`}
              >
                <span className={`mr-3 ${isActive ? 'text-stormy-dark' : 'text-stormy-slate'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Public Platform Link */}
        <div className="p-4 border-t border-stormy-slate/20 bg-black/10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-stormy-slate/40 flex items-center justify-center font-bold text-stormy-sky text-sm">
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
              <span className="inline-block text-[10px] font-bold text-stormy-sky uppercase">
                {user?.role}
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-stormy-mist hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-stormy-slate/20"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Public Platform
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-stormy-border px-8 py-4 shadow-subtle sticky top-0 z-30">
          <div>
            <h1 className="text-lg font-bold text-stormy-main tracking-tight capitalize">
              {NAV_ITEMS.find((item) =>
                item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
              )?.name || 'Admin Console'}
            </h1>
            <p className="text-xs text-stormy-muted">
              Live database metrics & administrative control
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Scheduler Active (30s)
            </span>
            <span className="text-xs text-stormy-muted font-medium">
              Signed in as: <strong className="text-stormy-dark">{user?.email}</strong>
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1760px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
