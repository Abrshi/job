'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, overviewRes] = await Promise.all([
        adminApiClient.get('/admin/dashboard/stats'),
        adminApiClient.get('/admin/dashboard/overview'),
      ]);
      setStats(statsRes?.data || null);
      setOverview(overviewRes?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: 'Total Vacancies',
      value: stats?.totalJobs ?? 0,
      description: 'Ingested into shared database',
      color: 'text-sky-400',
      href: '/jobs',
    },
    {
      title: 'Active / Published',
      value: stats?.activeJobs ?? 0,
      description: 'Live to job candidates',
      color: 'text-emerald-400',
      href: '/jobs',
    },
    {
      title: 'Pending AI Review',
      value: stats?.pendingJobs ?? 0,
      description: 'Low-confidence classification',
      color: (stats?.pendingJobs || 0) > 0 ? 'text-amber-400' : 'text-slate-400',
      badge: (stats?.pendingJobs || 0) > 0 ? 'Action Needed' : null,
      href: '/classifications',
    },
    {
      title: 'Expired / Closed',
      value: stats?.expiredJobs ?? 0,
      description: 'Past deadline or 30-day window',
      color: 'text-slate-400',
      href: '/jobs',
    },
    {
      title: 'Collected Today',
      value: stats?.jobsToday ?? 0,
      description: 'Ingested since midnight',
      color: 'text-teal-400',
      href: '/jobs',
    },
    {
      title: 'Total Accounts',
      value: stats?.totalUsers ?? 0,
      description: 'Seekers, employers & admins',
      color: 'text-indigo-400',
      href: '/users',
    },
    {
      title: 'Active Users (30d)',
      value: stats?.activeUsers ?? 0,
      description: 'Recent session or activity',
      color: 'text-purple-400',
      href: '/users',
    },
    {
      title: 'Job Sources',
      value: `${stats?.enabledSources ?? 0} / ${stats?.totalSources ?? 0}`,
      description: 'Active vs total configured',
      color: 'text-sky-300',
      href: '/sources',
    },
    {
      title: 'Collection Failures',
      value: stats?.failedRuns ?? 0,
      description: 'Historical failed scrapes',
      color: (stats?.failedRuns || 0) > 0 ? 'text-rose-400' : 'text-emerald-400',
      href: '/sources',
    },
  ];

  const maxTrend = Math.max(...(overview?.jobsTrend?.map((t) => t.count) || [1]), 5);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">System Intelligence Overview</h2>
            <p className="text-sm text-slate-400 mt-1">
              Real-time platform metrics, continuous scraper telemetry, and AI classification performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={fetchDashboardData} loading={loading}>
              Refresh Telemetry
            </Button>
            <Link href="/jobs">
              <Button variant="primary" size="sm">
                Manage Jobs &rarr;
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* Attention Alert: Failing or Overdue Sources */}
        {overview?.failingSources && overview.failingSources.length > 0 && (
          <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span>Attention Required: {overview.failingSources.length} ingestion source(s) failing or overdue</span>
              </div>
              <Link href="/sources" className="text-xs font-bold text-amber-400 hover:text-amber-300 underline">
                Inspect Ingestion Sources &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overview.failingSources.map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 rounded-xl border border-amber-900/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{s.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {s.isOverdue ? 'Overdue for polling' : s.lastError || 'Last execution failed'}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-400 border border-rose-800">
                    {s.lastStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map((card, idx) => (
            <Link
              key={idx}
              href={card.href}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-card flex flex-col justify-between hover:border-sky-500/50 hover:bg-slate-800/60 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-sky-300 transition-colors">
                  {card.title}
                </span>
                {card.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                    {card.badge}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className={`text-3xl font-extrabold tracking-tight ${card.color}`}>
                  {card.value}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{card.description}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* 7-Day Ingestion Trend Chart */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Daily Vacancy Ingestion Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Continuous job aggregation volume over the past 7 days</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-950 text-slate-300 rounded-lg border border-slate-800">
              7-Day Activity Window
            </span>
          </div>

          <div className="pt-4">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 border-b border-slate-800 pb-2">
              {overview?.jobsTrend?.map((t, idx) => {
                const heightPct = Math.max((t.count / maxTrend) * 100, 6);
                const dayLabel = new Date(t.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'numeric',
                  day: 'numeric',
                });

                return (
                  <div key={idx} className="flex flex-col items-center justify-end h-full group">
                    <span className="text-[11px] font-bold text-sky-400 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      {t.count}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[48px] bg-gradient-to-t from-sky-600 to-sky-400 hover:from-sky-500 hover:to-sky-300 rounded-t-lg transition-all duration-300 relative shadow-sm"
                    />
                    <span className="text-[10px] text-slate-400 mt-2 text-center truncate w-full">
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dual Section: Recent Runs & Recently Ingested Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Collection Runs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Recent Collection Runs</h3>
              <Link href="/sources" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                View Ingestion Pipeline &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Fetched</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview?.recentRuns && overview.recentRuns.length > 0 ? (
                    overview.recentRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white">{run.source?.name || 'Direct'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              run.status === 'SUCCESS'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : run.status === 'RUNNING'
                                ? 'bg-sky-950 text-sky-400 border border-sky-800 animate-pulse'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{run.recordsFetched}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-400">+{run.jobsCreated}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {run.startedAt
                            ? new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No collection runs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recently Ingested Jobs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Recently Ingested Vacancies</h3>
              <Link href="/jobs" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
                View Catalog &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-3">Job Posting</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {overview?.recentJobs && overview.recentJobs.length > 0 ? (
                    overview.recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white truncate max-w-[200px]">
                            {job.normalizedTitle || job.originalTitle}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {job.companyName || 'Unknown company'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{job.source?.name || 'Direct'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {job.category?.name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              job.status === 'ACTIVE'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No vacancies ingested yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
