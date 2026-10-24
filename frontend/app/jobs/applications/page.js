'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchApplications,
  fetchApplicationStats,
  withdrawApplication,
  deleteDraftApplication,
} from '@/lib/jobs-api';
import { ApplicationStatsCards } from '@/components/applications/application-stats-cards';
import { ApplicationFilters } from '@/components/applications/application-filters';
import { ApplicationListCard } from '@/components/applications/application-list-card';
import { ApplicationKanbanBoard } from '@/components/applications/application-kanban-board';
import { AddExternalModal } from '@/components/applications/add-external-modal';
import { StatusUpdateModal } from '@/components/applications/status-update-modal';
import { ScheduleInterviewModal } from '@/components/applications/schedule-interview-modal';

export default function ApplicationsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Data states
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Query states
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST' (primary) or 'BOARD' (Kanban)

  // Modal states
  const [isAddExternalOpen, setIsAddExternalOpen] = useState(false);
  const [statusModalApp, setStatusModalApp] = useState(null);
  const [interviewModalApp, setInterviewModalApp] = useState(null);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/?returnUrl=/jobs/applications');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load summary stats
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const res = await fetchApplicationStats();
      setStats(res);
    } catch {
      // Non-blocking for page
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Load applications list
  const loadApplications = useCallback(
    async (currentPage = 1) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchApplications({
          page: currentPage,
          limit: viewMode === 'BOARD' ? 50 : 15,
          status,
          source,
          search: search.trim() || undefined,
          sort,
        });
        setApplications(res.applications || []);
        setPagination(res.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 });
      } catch (err) {
        setError(err.message || 'Unable to load your applications.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, status, source, search, sort, viewMode]
  );

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated, loadStats]);

  useEffect(() => {
    if (isAuthenticated) {
      loadApplications(pagination.page);
    }
  }, [isAuthenticated, loadApplications, pagination.page]);

  // Handlers for quick card actions
  const handleWithdraw = async (app) => {
    const confirmWithdraw = window.confirm(
      `Are you sure you want to withdraw your application for "${app.title || app.jobTitle}"? You can reapply later if the position reopens.`
    );
    if (!confirmWithdraw) return;

    try {
      await withdrawApplication(app.id, 'Withdrawn by candidate via dashboard');
      loadApplications(pagination.page);
      loadStats();
    } catch (err) {
      alert(err.message || 'Failed to withdraw application.');
    }
  };

  const handleDeleteDraft = async (app) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this draft application for "${app.title || app.jobTitle}"?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDraftApplication(app.id);
      loadApplications(pagination.page);
      loadStats();
    } catch (err) {
      alert(err.message || 'Failed to delete draft application.');
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Header with Title and Action CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stormy-border">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stormy-main tracking-tight">
              Application Tracker
            </h1>
            <p className="text-sm text-stormy-muted mt-1">
              Organize, track interview stages, and manage all your job applications in one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stormy-border bg-white hover:border-stormy-slate text-xs font-semibold text-stormy-dark transition-colors shadow-subtle"
            >
              <span>Browse Jobs</span>
              <span>&rarr;</span>
            </Link>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddExternalOpen(true)}
              className="flex items-center gap-1.5 shadow-subtle"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Track External Job</span>
            </Button>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <ApplicationStatsCards
          stats={stats}
          isLoading={isStatsLoading}
          onSelectStatusFilter={(newStatus) => {
            setStatus(newStatus);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        />

        {/* Filter & Search Toolbar */}
        <div className="bg-white border border-stormy-border rounded-2xl p-4 sm:p-5 shadow-card">
          <ApplicationFilters
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            status={status}
            onStatusChange={(val) => {
              setStatus(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            source={source}
            onSourceChange={(val) => {
              setSource(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            sort={sort}
            onSortChange={(val) => {
              setSort(val);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            countsByStatus={stats?.byStatus}
          />
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadApplications(pagination.page)}
              className="text-xs font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-white border border-stormy-border rounded-2xl p-6 space-y-4 animate-pulse shadow-subtle"
              >
                <div className="w-1/3 h-5 bg-slate-200 rounded" />
                <div className="w-1/2 h-4 bg-slate-100 rounded" />
                <div className="w-1/4 h-3 bg-slate-100 rounded" />
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
              No applications found
            </h2>
            <p className="text-sm text-stormy-muted max-w-md mx-auto">
              {search || status !== 'ALL' || source !== 'ALL'
                ? 'Try adjusting your search terms or filters to see matching job applications.'
                : 'You have not submitted or tracked any job applications yet. Apply to platform jobs or track external positions.'}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/jobs"
                className="inline-flex items-center px-4 py-2 rounded-xl bg-stormy-sky text-stormy-dark font-bold text-sm hover:bg-stormy-skyHover transition-colors shadow-subtle"
              >
                Search Platform Jobs
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddExternalOpen(true)}
              >
                + Track External Job
              </Button>
            </div>
          </div>
        ) : viewMode === 'BOARD' ? (
          /* Kanban Board View */
          <ApplicationKanbanBoard
            applications={applications}
            onOpenStatusModal={(app) => setStatusModalApp(app)}
            onOpenInterviewModal={(app) => setInterviewModalApp(app)}
          />
        ) : (
          /* Primary List View */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-stormy-muted px-1">
              <span>
                Showing <strong>{applications.length}</strong> of <strong>{pagination.total}</strong> applications
              </span>
            </div>

            {applications.map((app) => (
              <ApplicationListCard
                key={app.id}
                application={app}
                onOpenStatusModal={(selected) => setStatusModalApp(selected)}
                onOpenInterviewModal={(selected) => setInterviewModalApp(selected)}
                onWithdraw={handleWithdraw}
                onDeleteDraft={handleDeleteDraft}
              />
            ))}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  &larr; Previous
                </Button>
                <span className="text-xs font-semibold text-stormy-dark px-3 py-1 bg-white border border-stormy-border rounded-lg shadow-subtle">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next &rarr;
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add External Application Modal */}
      <AddExternalModal
        isOpen={isAddExternalOpen}
        onClose={() => setIsAddExternalOpen(false)}
        onSuccess={() => {
          loadApplications(1);
          loadStats();
        }}
      />

      {/* Status Transition Modal */}
      {statusModalApp && (
        <StatusUpdateModal
          application={statusModalApp}
          isOpen={Boolean(statusModalApp)}
          onClose={() => setStatusModalApp(null)}
          onSuccess={() => {
            loadApplications(pagination.page);
            loadStats();
          }}
        />
      )}

      {/* Schedule Interview Modal */}
      {interviewModalApp && (
        <ScheduleInterviewModal
          applicationId={interviewModalApp.id}
          existingRoundsCount={interviewModalApp.interviewsCount || 0}
          isOpen={Boolean(interviewModalApp)}
          onClose={() => setInterviewModalApp(null)}
          onSuccess={() => {
            loadApplications(pagination.page);
            loadStats();
          }}
        />
      )}
    </div>
  );
}
