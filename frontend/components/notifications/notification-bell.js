'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Load unread count on mount and interval
  const loadUnreadCount = async () => {
    try {
      const count = await fetchUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // Ignore background badge errors
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const timer = setInterval(loadUnreadCount, 60000); // 1 min poll
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Load recent notifications when dropdown opens
  const handleToggle = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState) {
      setIsLoading(true);
      try {
        const data = await fetchNotifications({ page: 1, limit: 5 });
        setRecentNotifications(data.notifications || []);
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      } catch (err) {
        console.error('Failed to load notifications preview:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await markNotificationRead(notif.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
      } catch {
        // Continue navigation
      }
    }
    setIsOpen(false);
    if (notif.job?.id) {
      router.push(`/jobs/${notif.job.id}`);
    } else if (notif.job?.originalUrl) {
      window.open(notif.job.originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Job alerts & notifications"
        className="relative p-2 rounded-xl text-stormy-muted hover:text-stormy-dark hover:bg-stormy-canvas transition-colors focus:outline-none focus:ring-2 focus:ring-stormy-sky cursor-pointer"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-extrabold text-white bg-stormy-sky rounded-full ring-2 ring-white shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-card border border-stormy-border py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-stormy-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-stormy-dark">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-stormy-sky/15 text-stormy-sky">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-stormy-sky hover:text-stormy-skyHover transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-stormy-border/50">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-stormy-muted">
                <div className="w-5 h-5 border-2 border-stormy-sky border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading alerts...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-stormy-muted space-y-1">
                <p className="font-semibold text-stormy-main">No notifications yet</p>
                <p>You will receive alerts here when newly collected jobs match your saved searches.</p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const jobTitle = notif.job?.normalizedTitle || notif.job?.originalTitle || 'New Matching Job';
                const company = notif.job?.companyName || 'Company';
                const location = [notif.job?.city, notif.job?.country].filter(Boolean).join(', ');
                const matchedName =
                  Array.isArray(notif.matchedSearchNames) && notif.matchedSearchNames.length > 0
                    ? notif.matchedSearchNames[0]
                    : notif.savedSearch?.name || 'Saved Search';

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-stormy-canvas/70 transition-colors cursor-pointer flex items-start gap-3 ${
                      !notif.isRead ? 'bg-stormy-sky/5' : ''
                    }`}
                  >
                    {/* Unread indicator */}
                    <div className="pt-1.5 shrink-0">
                      <span
                        className={`block w-2 h-2 rounded-full ${
                          !notif.isRead ? 'bg-stormy-sky shadow-2xs' : 'bg-transparent'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-stormy-dark truncate">
                          {jobTitle}
                        </span>
                        <span className="text-[10px] text-stormy-muted shrink-0">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-stormy-muted truncate">
                        {company} {location && `• ${location}`}
                      </p>

                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stormy-canvas border border-stormy-border text-stormy-main truncate max-w-[180px]">
                          Alert: {matchedName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-stormy-border bg-stormy-canvas/30 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-stormy-dark hover:text-stormy-sky transition-colors inline-flex items-center gap-1"
            >
              View all notifications
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
