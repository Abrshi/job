'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { JobCard } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { fetchSavedJobs, unsaveJob } from '@/lib/jobs-api';
import { useAuth } from '@/hooks/use-auth';

export default function SavedJobsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [savedJobs, setSavedJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/?returnUrl=/jobs/saved');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadSavedJobs = async (pageNum = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSavedJobs(pageNum, 36);
      setSavedJobs(data.jobs || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Unable to retrieve your saved jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSavedJobs(page);
    }
  }, [isAuthenticated, page]);

  const handleUnsave = async (job) => {
    // Optimistic removal
    setSavedJobs((prev) => prev.filter((j) => j.id !== job.id));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      await unsaveJob(job.id);
    } catch (err) {
      // Revert if error
      console.error('Failed to unsave job:', err);
      loadSavedJobs(page);
    }
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
              Saved Jobs
            </h1>
            <p className="text-sm text-stormy-muted mt-1">
              Review and manage the positions you bookmarked across sources.
            </p>
          </div>

          <Link
            href="/jobs"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stormy-border bg-white hover:border-stormy-slate text-xs font-semibold text-stormy-dark transition-colors shadow-subtle"
          >
            <span>Browse More Jobs</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-stormy-border rounded-xl p-5 space-y-3 animate-pulse shadow-subtle"
              >
                <div className="w-1/3 h-4 bg-slate-200 rounded" />
                <div className="w-3/4 h-5 bg-slate-200 rounded" />
                <div className="w-1/2 h-4 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : savedJobs.length === 0 ? (
          <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center shadow-card space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark">
              <svg className="w-7 h-7 text-stormy-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-stormy-main">
              No saved jobs yet
            </h2>
            <p className="text-sm text-stormy-muted max-w-md mx-auto">
              When browsing positions, click the bookmark icon on any job card to save it here for easy access.
            </p>
            <div className="pt-2">
              <Link
                href="/jobs"
                className="inline-flex items-center px-4 py-2 rounded-xl bg-stormy-sky text-stormy-dark font-bold text-sm hover:bg-stormy-skyHover transition-colors"
              >
                Find Jobs to Save
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onToggleSave={handleUnsave}
              />
            ))}
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

