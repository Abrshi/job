'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/protected-route';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from '@/lib/jobs-api';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function NotificationsContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Action Loading states
  const [markingId, setMarkingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);

  const loadNotifications = async (currentPage = page, tab = activeTab) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications({
        page: currentPage,
        limit: 15,
        unreadOnly: tab === 'unread',
      });
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(page, activeTab);
  }, [page, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setPage(1);
  };

  const handleMarkAsRead = async (id) => {
    setMarkingId(id);
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (activeTab === 'unread') {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
      if (activeTab === 'unread') {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearRead = async () => {
    setIsClearingRead(true);
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    } finally {
      setIsClearingRead(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      {/* Header */}
      <section className="bg-gradient-to-b from-white to-stormy-canvas border-b border-stormy-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1760px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-stormy-sky" />
              <span className="text-xs font-bold uppercase tracking-wider text-stormy-muted">
                Activity Center
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-stormy-dark tracking-tight">
              Job Alerts & Notifications
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stormy-muted">
              Real-time vacancy alerts triggered by your active saved searches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/jobs/saved-searches">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-stormy-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Manage Saved Searches
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Filter Tabs & Bulk Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-stormy-border gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-stormy-dark text-white shadow-subtle'
                  : 'bg-white border border-stormy-border text-stormy-muted hover:text-stormy-dark'
              }`}
            >
              All Notifications
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('unread')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'bg-stormy-dark text-white shadow-subtle'
                  : 'bg-white border border-stormy-border text-stormy-muted hover:text-stormy-dark'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-stormy-sky text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                loading={isMarkingAll}
                className="text-xs"
              >
                Mark all as read
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearRead}
              loading={isClearingRead}
              className="text-xs text-stormy-muted hover:text-red-600"
            >
              Clear read
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white border border-stormy-border rounded-2xl animate-pulse p-5" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3 max-w-lg mx-auto">
              <p className="text-sm font-semibold text-red-700">{error}</p>
              <Button variant="outline" size="sm" onClick={() => loadNotifications(page, activeTab)}>
                Retry Loading
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center max-w-md mx-auto shadow-card space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-stormy-sky/10 border border-stormy-sky/20 flex items-center justify-center text-stormy-sky mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-stormy-dark">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </h3>
                <p className="mt-1 text-xs text-stormy-muted">
                  {activeTab === 'unread'
                    ? 'You have caught up with all your job alerts.'
                    : 'As soon as our scraping scheduler discovers vacancies that match your saved searches, you will be notified here.'}
                </p>
              </div>
              <div className="pt-2">
                <Link href="/jobs">
                  <Button variant="primary" size="sm">
                    Search Jobs & Create Alerts
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            notifications.map((notif) => {
              const job = notif.job;
              const jobTitle = job?.normalizedTitle || job?.originalTitle || 'Job Position';
              const company = job?.companyName || 'Unknown Company';
              const location = [job?.city, job?.country].filter(Boolean).join(', ');
              const matchedList =
                Array.isArray(notif.matchedSearchNames) && notif.matchedSearchNames.length > 0
                  ? notif.matchedSearchNames
                  : notif.savedSearch?.name
                  ? [notif.savedSearch.name]
                  : ['Saved Search'];

              let salaryText = null;
              if (job?.salaryMin || job?.salaryMax) {
                const curr = job.salaryCurrency || 'ETB';
                salaryText =
                  job.salaryMin && job.salaryMax
                    ? `${Number(job.salaryMin).toLocaleString()} - ${Number(job.salaryMax).toLocaleString()} ${curr}`
                    : `${Number(job.salaryMin || job.salaryMax).toLocaleString()} ${curr}`;
              }

              return (
                <div
                  key={notif.id}
                  className={`bg-white border rounded-2xl p-5 shadow-card hover:shadow-subtle transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    !notif.isRead
                      ? 'border-stormy-sky/40 bg-gradient-to-r from-stormy-sky/5 via-white to-white'
                      : 'border-stormy-border'
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Unread blue dot */}
                    <div className="pt-1 shrink-0">
                      <span
                        className={`block w-2.5 h-2.5 rounded-full ${
                          !notif.isRead ? 'bg-stormy-sky ring-4 ring-stormy-sky/20' : 'bg-transparent'
                        }`}
                      />
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={job?.id ? `/jobs/${job.id}` : '#'}
                          className="text-sm font-bold text-stormy-dark hover:text-stormy-sky transition-colors truncate"
                        >
                          {jobTitle}
                        </Link>

                        {/* Matched Search Badges */}
                        {matchedList.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stormy-sky/10 border border-stormy-sky/20 text-stormy-sky"
                          >
                            Matched: {m}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-stormy-muted flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-stormy-main">{company}</span>
                        {location && <span>• {location}</span>}
                        {job?.workArrangement && (
                          <span className="px-1.5 py-0.2 rounded bg-stormy-canvas border border-stormy-border text-[10px] font-medium text-stormy-main">
                            {job.workArrangement}
                          </span>
                        )}
                        {salaryText && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                            {salaryText}
                          </span>
                        )}
                      </p>

                      <p className="text-[11px] text-stormy-muted/80">
                        Received {formatTimeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {job?.id && (
                      <Link href={`/jobs/${job.id}`}>
                        <Button variant="primary" size="sm" className="text-xs">
                          View Details
                        </Button>
                      </Link>
                    )}

                    {!notif.isRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                        loading={markingId === notif.id}
                        className="text-xs"
                      >
                        Mark as read
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id)}
                      disabled={deletingId === notif.id}
                      className="text-stormy-muted hover:text-red-600 p-2 rounded-lg hover:bg-stormy-canvas transition-colors"
                      title="Dismiss notification"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-stormy-muted px-3">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <React.Suspense
        fallback={
          <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
            <Navbar />
            <div className="w-full max-w-[1760px] mx-auto px-4 py-16 text-center">
              <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        }
      >
        <NotificationsContent />
      </React.Suspense>
    </ProtectedRoute>
  );
}

