'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { ProtectedRoute } from '@/components/protected-route';
import {
  fetchSavedSearches,
  updateSavedSearch,
  toggleSavedSearchAlert,
  deleteSavedSearch,
} from '@/lib/jobs-api';

function formatDate(dateString) {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SavedSearchesContent() {
  const router = useRouter();
  const [searches, setSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Modal State
  const [editingSearch, setEditingSearch] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAlert, setEditAlert] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete State
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle Loading IDs
  const [togglingIds, setTogglingIds] = useState(new Set());

  const loadSearches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSavedSearches();
      setSearches(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load saved searches.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSearches();
  }, []);

  const handleToggleAlert = async (search) => {
    setTogglingIds((prev) => new Set(prev).add(search.id));
    const nextState = !search.isAlertEnabled;

    // Optimistic UI update
    setSearches((prev) =>
      prev.map((s) => (s.id === search.id ? { ...s, isAlertEnabled: nextState } : s))
    );

    try {
      await toggleSavedSearchAlert(search.id);
    } catch (err) {
      // Revert on failure
      setSearches((prev) =>
        prev.map((s) => (s.id === search.id ? { ...s, isAlertEnabled: !nextState } : s))
      );
      console.error('Failed to toggle alert status:', err);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(search.id);
        return next;
      });
    }
  };

  const handleRunSearch = (search) => {
    const params = new URLSearchParams();
    if (search.search) params.set('search', search.search);
    if (search.categorySlug) params.set('category', search.categorySlug);
    if (search.city) params.set('city', search.city);
    if (search.country) params.set('country', search.country);
    if (search.workArrangement) params.set('workArrangement', search.workArrangement);
    if (search.employmentType) params.set('employmentType', search.employmentType);
    if (search.experienceLevel) params.set('experienceLevel', search.experienceLevel);
    if (search.minSalary) params.set('minSalary', String(search.minSalary));

    const queryStr = params.toString();
    router.push(queryStr ? `/jobs?${queryStr}` : '/jobs');
  };

  const openEditModal = (search) => {
    setEditingSearch(search);
    setEditName(search.name);
    setEditAlert(search.isAlertEnabled);
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Name is required');
      return;
    }

    setIsUpdating(true);
    setEditError(null);
    try {
      const updated = await updateSavedSearch(editingSearch.id, {
        name: editName.trim(),
        isAlertEnabled: editAlert,
      });

      setSearches((prev) =>
        prev.map((s) => (s.id === editingSearch.id ? { ...s, ...updated } : s))
      );
      setEditingSearch(null);
    } catch (err) {
      setEditError(err.message || 'Failed to update saved search.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(true);
    try {
      await deleteSavedSearch(id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
      setDeletingId(null);
    } catch (err) {
      console.error('Failed to delete saved search:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      {/* Header */}
      <section className="bg-gradient-to-b from-white to-stormy-canvas border-b border-stormy-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-stormy-sky" />
              <span className="text-xs font-bold uppercase tracking-wider text-stormy-muted">
                Candidate Management
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-stormy-dark tracking-tight">
              Saved Searches & Job Alerts
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stormy-muted">
              Configure your search presets and manage automated email and in-app alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/jobs">
              <Button variant="primary" size="md" className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Explore New Jobs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-white border border-stormy-border rounded-2xl animate-pulse p-6" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3 max-w-lg mx-auto">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={loadSearches}>
              Retry Loading
            </Button>
          </div>
        ) : searches.length === 0 ? (
          <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center max-w-xl mx-auto shadow-card space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-stormy-sky/10 border border-stormy-sky/20 flex items-center justify-center text-stormy-sky mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-stormy-dark">No Saved Searches Found</h3>
              <p className="mt-1 text-sm text-stormy-muted max-w-md mx-auto">
                Save your favourite filter combinations while browsing jobs to quickly rerun them or receive automated in-app alerts when new positions open.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/jobs">
                <Button variant="primary" size="md">
                  Search Jobs to Save One
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold text-stormy-muted uppercase tracking-wider">
                {searches.length} {searches.length === 1 ? 'Saved Search' : 'Saved Searches'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searches.map((search) => {
                const isToggling = togglingIds.has(search.id);

                // Collect filter chips
                const filterChips = [
                  search.search && { label: 'Keyword', value: search.search },
                  search.categorySlug && { label: 'Category', value: search.categorySlug },
                  search.workArrangement && { label: 'Arrangement', value: search.workArrangement },
                  search.employmentType && { label: 'Type', value: search.employmentType.replace('_', ' ') },
                  search.experienceLevel && { label: 'Level', value: search.experienceLevel },
                  search.city && { label: 'City', value: search.city },
                  search.country && { label: 'Country', value: search.country },
                  search.minSalary && {
                    label: 'Min Salary',
                    value: `${Number(search.minSalary).toLocaleString()} ${search.currency || 'ETB'}`,
                  },
                ].filter(Boolean);

                return (
                  <div
                    key={search.id}
                    className="bg-white border border-stormy-border rounded-2xl p-5 shadow-card hover:shadow-subtle transition-all flex flex-col justify-between gap-4"
                  >
                    {/* Top Row: Name + Alert Toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-stormy-dark leading-tight">
                            {search.name}
                          </h3>
                        </div>
                        <p className="text-xs text-stormy-muted">
                          Created {formatDate(search.createdAt)} • Last checked {formatDate(search.lastAlertAt || search.lastRunAt)}
                        </p>
                      </div>

                      {/* Alert Status Pill / Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleAlert(search)}
                        disabled={isToggling}
                        title={search.isAlertEnabled ? 'Alerts are active. Click to pause.' : 'Alerts are paused. Click to enable.'}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          search.isAlertEnabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            search.isAlertEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        {search.isAlertEnabled ? 'Alerts On' : 'Alerts Paused'}
                      </button>
                    </div>

                    {/* Filter Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {filterChips.length > 0 ? (
                        filterChips.map((chip, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-stormy-canvas border border-stormy-border text-[11px] font-medium text-stormy-dark"
                          >
                            <span className="text-stormy-muted">{chip.label}:</span>
                            <span className="font-semibold">{chip.value}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-stormy-muted italic">
                          Matches all available vacancies
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-stormy-border/80">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRunSearch(search)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          Run Search
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(search)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeletingId(search.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete saved search"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingSearch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stormy-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stormy-border">
              <h3 className="text-base font-bold text-stormy-dark">Edit Saved Search</h3>
              <button
                onClick={() => setEditingSearch(null)}
                className="text-stormy-muted hover:text-stormy-dark p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stormy-dark uppercase tracking-wider mb-1.5">
                  Search Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-stormy-canvas border border-stormy-border rounded-xl px-3.5 py-2 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              <div className="p-3 bg-stormy-canvas rounded-xl border border-stormy-border">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editAlert}
                    onChange={(e) => setEditAlert(e.target.checked)}
                    className="w-4 h-4 rounded border-stormy-border text-stormy-sky focus:ring-stormy-sky"
                  />
                  <div>
                    <span className="text-sm font-bold text-stormy-dark">
                      Enable automated alerts
                    </span>
                    <p className="text-xs text-stormy-muted">
                      Receive notifications when newly scraped jobs match these filters.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSearch(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={isUpdating}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stormy-border space-y-4 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-stormy-dark">Delete Saved Search?</h4>
            <p className="text-xs text-stormy-muted">
              Are you sure you want to delete this saved search? You will no longer receive alerts for it.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(deletingId)}
                loading={isDeleting}
              >
                Delete Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SavedSearchesPage() {
  return (
    <ProtectedRoute>
      <React.Suspense
        fallback={
          <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-16 text-center">
              <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        }
      >
        <SavedSearchesContent />
      </React.Suspense>
    </ProtectedRoute>
  );
}
