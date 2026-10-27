'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Button } from '@/components/ui/button';

export function AdminLayout({ children }) {
  const { admin, logout, isAuthenticated, loading } = useAdminAuth();
  const pathname = usePathname() || '/';
  const router = useRouter();

  const navItems = [
    { label: 'Overview', href: '/' },
    { label: 'Job Management', href: '/jobs' },
    { label: 'User Governance', href: '/users' },
    { label: 'Ingestion Sources', href: '/sources' },
    { label: 'Discovery & Coverage', href: '/discovery' },
    { label: 'Classification Review', href: '/classifications' },
    { label: 'Site Settings', href: '/settings' },
    { label: 'Audit Logs', href: '/audit-logs' },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4 text-slate-200">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-400 animate-pulse">
          Authenticating administrative credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-elevated">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-950 text-rose-400 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Administrative Access Required</h2>
          <p className="text-sm text-slate-400">
            You must be logged in with an authorized administrative account to access the control console.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" className="w-full">
              <Button variant="primary" size="md" className="w-full">
                Go to Admin Login &rarr;
              </Button>
            </Link>
            <a
              href="http://localhost:3000"
              className="text-xs text-slate-400 hover:text-sky-400 transition-colors pt-2"
            >
              &larr; Switch to Job Seeker Platform
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-sm">
              AD
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-tight leading-tight">
                JobSphere
              </h1>
              <span className="text-[10px] font-semibold tracking-wider text-sky-400 uppercase">
                Admin Console
              </span>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-3.5 py-2 rounded-lg bg-slate-950/60 border border-slate-800">
            <p className="text-xs font-semibold text-white truncate">{admin?.email}</p>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {admin?.role} Verified
            </span>
          </div>

          <div className="space-y-1.5">
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center text-xs text-slate-400 hover:text-sky-300 py-1.5 transition-colors"
            >
              Open Job Seeker App &#8599;
            </a>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-slate-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900"
              onClick={handleLogout}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-400">
              Admin Gateway Connected (Port 5001)
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Account: <span className="font-semibold text-slate-200">{admin?.email}</span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

