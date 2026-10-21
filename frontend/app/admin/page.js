'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboardData() {
    try {
      setError(null);
      const [statsRes, overviewRes] = await Promise.all([
        apiClient.get('/admin/dashboard/stats'),
        apiClient.get('/admin/dashboard/overview'),
      ]);
      setStats(statsRes.data);
      setOverview(overviewRes.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard intelligence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-stormy-border/40 rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl shadow-subtle border border-stormy-border p-4 animate-pulse space-y-2">
              <div className="h-4 bg-stormy-border/40 rounded w-2/3" />
              <div className="h-8 bg-stormy-border/30 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text space-y-3">
        <div className="flex items-center space-x-2 font-bold">
          <svg className="w-5 h-5 text-feedback-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Error loading admin dashboard</span>
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 text-xs font-semibold bg-white border border-feedback-danger-border text-feedback-danger rounded-lg hover:bg-feedback-danger-bg transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Jobs Collected',
      value: stats?.totalJobs ?? 0,
      description: 'Ingested into catalog',
      color: 'text-stormy-dark',
      bg: 'bg-white',
    },
    {
      title: 'Active / Published Jobs',
      value: stats?.activeJobs ?? 0,
      description: 'Currently live to candidates',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50/50',
    },
    {
      title: 'Pending Review',
      value: stats?.pendingJobs ?? 0,
      description: 'Uncertain classifications',
      color: stats?.pendingJobs > 0 ? 'text-amber-700' : 'text-stormy-muted',
      bg: stats?.pendingJobs > 0 ? 'bg-amber-50/60' : 'bg-white',
      badge: stats?.pendingJobs > 0 ? 'Action Needed' : null,
      href: '/admin/classifications',
    },
    {
      title: 'Expired / Closed',
      value: stats?.expiredJobs ?? 0,
      description: 'Passed closing or 30d window',
      color: 'text-stormy-muted',
      bg: 'bg-white',
    },
    {
      title: 'Jobs Collected Today',
      value: stats?.jobsToday ?? 0,
      description: 'New vacancies since midnight',
      color: 'text-sky-700',
      bg: 'bg-sky-50/40',
    },
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      description: 'Registered accounts',
      color: 'text-stormy-dark',
      bg: 'bg-white',
      href: '/admin/users',
    },
    {
      title: 'Active Users (30d)',
      value: stats?.activeUsers ?? 0,
      description: 'Logged in or valid sessions',
      color: 'text-indigo-700',
      bg: 'bg-indigo-50/40',
      href: '/admin/users',
    },
    {
      title: 'Job Sources',
      value: `${stats?.enabledSources ?? 0} / ${stats?.totalSources ?? 0}`,
      description: 'Active vs total configured',
      color: 'text-stormy-dark',
      bg: 'bg-white',
      href: '/admin/sources',
    },
    {
      title: 'Collection Failures',
      value: stats?.failedRuns ?? 0,
      description: 'Recorded failed runs',
      color: stats?.failedRuns > 0 ? 'text-red-700' : 'text-emerald-700',
      bg: stats?.failedRuns > 0 ? 'bg-red-50/50' : 'bg-white',
      href: '/admin/sources',
    },
  ];

  // Maximum value for jobs trend bar scale
  const maxTrend = Math.max(...(overview?.jobsTrend?.map((t) => t.count) || [1]), 5);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stormy-main tracking-tight">Platform Intelligence Overview</h2>
          <p className="text-sm text-stormy-muted">
            Real-time catalog metrics, collection health, and taxonomy performance.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-stormy-dark bg-white border border-stormy-border hover:bg-stormy-canvas rounded-lg shadow-subtle transition-all cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
          <Link
            href="/admin/jobs"
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle transition-all"
          >
            Manage Jobs
          </Link>
        </div>
      </div>

      {/* Failing or Overdue Sources Alert */}
      {overview?.failingSources && overview.failingSources.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-900 font-semibold text-sm">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Attention Required: {overview.failingSources.length} source(s) are failing or overdue</span>
            </div>
            <Link
              href="/admin/sources"
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
            >
              Inspect Sources &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {overview.failingSources.map((s) => (
              <div key={s.id} className="p-2.5 bg-white rounded-lg border border-amber-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-stormy-dark">{s.name}</span>
                  <span className="ml-2 text-stormy-muted">
                    {s.isOverdue ? 'Overdue for collection' : 'Last run failed'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-red-100 text-red-800">
                  {s.lastStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const content = (
            <div
              key={idx}
              className={`p-4 rounded-xl border border-stormy-border shadow-subtle flex flex-col justify-between transition-all hover:shadow-card ${card.bg} ${
                card.href ? 'cursor-pointer hover:border-stormy-sky' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-stormy-muted leading-tight">{card.title}</p>
                {card.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className={`text-2xl font-extrabold tracking-tight ${card.color}`}>
                  {card.value}
                </p>
                <p className="text-[11px] text-stormy-muted mt-0.5">{card.description}</p>
              </div>
            </div>
          );

          return card.href ? (
            <Link key={idx} href={card.href} className="block">
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>

      {/* Jobs Ingestion Trend Chart (Last 7 Days) */}
      <div className="p-6 bg-white rounded-2xl border border-stormy-border shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stormy-main">Daily Jobs Ingestion Trend</h3>
            <p className="text-xs text-stormy-muted">Job vacancies collected per day over the past 7 days</p>
          </div>
          <span className="text-xs font-semibold text-stormy-slate bg-stormy-canvas px-2.5 py-1 rounded-lg border border-stormy-border">
            7-Day Activity Window
          </span>
        </div>

        <div className="pt-4">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-40 border-b border-stormy-border pb-2">
            {overview?.jobsTrend?.map((t, idx) => {
              const heightPct = Math.max((t.count / maxTrend) * 100, 6);
              const dayLabel = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

              return (
                <div key={idx} className="flex flex-col items-center justify-end h-full group">
                  <span className="text-[11px] font-bold text-stormy-dark mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {t.count}
                  </span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full max-w-[42px] bg-stormy-slate hover:bg-stormy-sky rounded-t-lg transition-all duration-300 relative"
                  />
                  <span className="text-[10px] text-stormy-muted mt-2 text-center truncate w-full">
                    {dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dual Section: Recent Runs & Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Collection Runs Table */}
        <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stormy-main">Recent Collection Runs</h3>
            <Link href="/admin/sources" className="text-xs font-semibold text-stormy-sky hover:text-stormy-skyHover">
              View All Runs &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Fetched</th>
                  <th className="py-2.5 px-3 font-semibold">Created</th>
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stormy-border/60">
                {overview?.recentRuns && overview.recentRuns.length > 0 ? (
                  overview.recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-stormy-canvas/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-stormy-main">{run.source?.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            run.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : run.status === 'RUNNING'
                              ? 'bg-sky-100 text-sky-800 animate-pulse'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-stormy-muted">{run.recordsFetched}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600">{run.jobsCreated}</td>
                      <td className="py-2.5 px-3 text-stormy-muted">
                        {run.startedAt ? new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-stormy-muted">
                      No collection runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recently Collected Jobs Table */}
        <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stormy-main">Recently Ingested Jobs</h3>
            <Link href="/admin/jobs" className="text-xs font-semibold text-stormy-sky hover:text-stormy-skyHover">
              View Catalog &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Job Title</th>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stormy-border/60">
                {overview?.recentJobs && overview.recentJobs.length > 0 ? (
                  overview.recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-stormy-canvas/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-stormy-main truncate max-w-[180px]">
                          {job.normalizedTitle || job.originalTitle}
                        </p>
                        <p className="text-[11px] text-stormy-muted truncate max-w-[180px]">
                          {job.companyName || 'Unknown company'}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-stormy-muted">{job.source?.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-stormy-mist/40 text-stormy-dark text-[10px] font-medium">
                          {job.category?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            job.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stormy-slate/20 text-stormy-muted'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-stormy-muted">
                      No jobs ingested yet. Trigger collection to populate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
