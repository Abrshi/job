'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { fetchUserApplications } from '@/lib/jobs-api';
import { useAuth } from '@/hooks/use-auth';

export default function ApplicationsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [applications, setApplications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/?returnUrl=/jobs/applications');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadApplications() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchUserApplications(page, 15);
        setApplications(data.applications || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(err.message || 'Unable to load your applications.');
      } finally {
        setIsLoading(false);
      }
    }

    loadApplications();
  }, [isAuthenticated, page]);

  const statusStyles = {
    SUBMITTED: { label: 'Submitted', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    REVIEWING: { label: 'Under Review', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    SHORTLISTED: { label: 'Shortlisted', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
    ACCEPTED: { label: 'Accepted', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECTED: { label: 'Declined', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  if (authLoading || (!isAuthenticated && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stormy-border">
          <div>
            <h1 className="text-2xl font-extrabold text-stormy-main tracking-tight">
              My Applications
            </h1>
            <p className="text-sm text-stormy-muted mt-1">
              Track the status of roles you applied for directly on this platform.
            </p>
          </div>

          <Link
            href="/jobs"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stormy-border bg-white hover:border-stormy-slate text-xs font-semibold text-stormy-dark transition-colors shadow-subtle"
          >
            <span>Explore Jobs</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-stormy-border rounded-xl p-5 space-y-3 animate-pulse shadow-subtle"
              >
                <div className="w-1/4 h-5 bg-slate-200 rounded" />
                <div className="w-1/2 h-4 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center shadow-card space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark">
              <svg className="w-7 h-7 text-stormy-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-stormy-main">
              No applications submitted yet
            </h2>
            <p className="text-sm text-stormy-muted max-w-md mx-auto">
              When applying for positions that support direct submission, your applications and review updates will be tracked here.
            </p>
            <div className="pt-2">
              <Link
                href="/jobs"
                className="inline-flex items-center px-4 py-2 rounded-xl bg-stormy-sky text-stormy-dark font-bold text-sm hover:bg-stormy-skyHover transition-colors"
              >
                Search Available Jobs
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const status = statusStyles[app.status] || statusStyles.SUBMITTED;
              const submittedDate = new Date(app.submittedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={app.id}
                  className="bg-white border border-stormy-border rounded-xl p-5 shadow-card hover:border-stormy-slate transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Link
                        href={`/jobs/${app.job.id}`}
                        className="text-base font-bold text-stormy-main hover:text-stormy-sky transition-colors"
                      >
                        {app.job.title}
                      </Link>
                      <p className="text-xs font-semibold text-stormy-muted mt-0.5">
                        {app.job.companyName || 'Confidential Employer'} &bull;{' '}
                        {[app.job.city, app.job.country].filter(Boolean).join(', ') || 'Remote'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${status.bg}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-xs text-stormy-muted">
                        Applied {submittedDate}
                      </span>
                    </div>
                  </div>

                  {app.coverNote && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-stormy-main">
                      <span className="font-bold text-stormy-muted uppercase tracking-wider text-[10px] block mb-1">
                        Application Message
                      </span>
                      <p className="line-clamp-3">{app.coverNote}</p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="text-stormy-muted">
                      Category: <strong>{app.job.categoryName}</strong>
                    </span>
                    <Link
                      href={`/jobs/${app.job.id}`}
                      className="font-semibold text-stormy-sky hover:text-stormy-skyHover"
                    >
                      View Job Posting &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="pt-6 border-t border-stormy-border flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              &larr; Previous
            </Button>

            <span className="text-xs font-semibold text-stormy-muted">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next &rarr;
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

