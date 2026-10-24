'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createSavedSearch } from '@/lib/jobs-api';

export function SaveSearchModal({ isOpen, onClose, filters = {}, onSaved }) {
  const [name, setName] = useState('');
  const [isAlertEnabled, setIsAlertEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Derive an intuitive default search name from active filters
  useEffect(() => {
    if (!isOpen) {
      setSavedSuccess(false);
      setError(null);
      return;
    }

    const parts = [];
    if (filters.search) parts.push(`"${filters.search}"`);
    if (filters.categoryName) parts.push(filters.categoryName);
    else if (filters.category) parts.push(filters.category);

    if (filters.workArrangement) {
      const arr = filters.workArrangement === 'REMOTE' ? 'Remote' : filters.workArrangement === 'HYBRID' ? 'Hybrid' : 'On-site';
      parts.push(arr);
    }

    if (filters.city) parts.push(filters.city);

    let defaultName = parts.join(' - ');
    if (!defaultName) {
      defaultName = 'All Active Jobs';
    }
    setName(defaultName);
    setIsAlertEnabled(true);
    setSavedSuccess(false);
    setError(null);
  }, [isOpen, filters]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for this saved search.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        search: filters.search || undefined,
        categorySlug: filters.category || undefined,
        city: filters.city || undefined,
        country: filters.country || undefined,
        workArrangement: filters.workArrangement || undefined,
        employmentType: filters.employmentType || undefined,
        experienceLevel: filters.experienceLevel || undefined,
        minSalary: filters.minSalary ? Number(filters.minSalary) : undefined,
        isAlertEnabled,
      };

      const res = await createSavedSearch(payload);
      setSavedSuccess(true);
      if (onSaved) onSaved(res.savedSearch);
    } catch (err) {
      setError(err.message || 'Failed to save search. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper chips to display active criteria
  const activeCriteria = [
    filters.search && { label: 'Keyword', value: filters.search },
    (filters.categoryName || filters.category) && { label: 'Category', value: filters.categoryName || filters.category },
    filters.workArrangement && { label: 'Arrangement', value: filters.workArrangement },
    filters.employmentType && { label: 'Type', value: filters.employmentType.replace('_', ' ') },
    filters.experienceLevel && { label: 'Experience', value: filters.experienceLevel },
    filters.city && { label: 'City', value: filters.city },
    filters.country && { label: 'Country', value: filters.country },
    filters.minSalary && { label: 'Min Salary', value: `${Number(filters.minSalary).toLocaleString()} ETB` },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stormy-border animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-search-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stormy-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stormy-sky/10 border border-stormy-sky/20 flex items-center justify-center text-stormy-sky">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <div>
              <h3 id="save-search-title" className="text-lg font-bold text-stormy-dark">
                Save this Job Search
              </h3>
              <p className="text-xs text-stormy-muted">
                Save your filters and get notified when matching jobs are added
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stormy-muted hover:text-stormy-dark p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {savedSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-stormy-dark">Search Saved Successfully!</h4>
            <p className="text-sm text-stormy-muted max-w-sm mx-auto">
              {isAlertEnabled
                ? 'We will automatically alert you when new jobs matching these criteria are published.'
                : 'Your search criteria have been saved for quick future access.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/jobs/saved-searches" className="inline-block">
                <Button variant="primary" size="sm">
                  View Saved Searches
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label htmlFor="search-name" className="block text-xs font-bold text-stormy-dark uppercase tracking-wider mb-1.5">
                Saved Search Name *
              </label>
              <input
                id="search-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Senior Frontend Addis Ababa"
                className="w-full bg-stormy-canvas border border-stormy-border rounded-xl px-3.5 py-2.5 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:bg-white transition-all shadow-inner"
              />
            </div>

            {/* Active Filters Summary */}
            <div>
              <label className="block text-xs font-bold text-stormy-dark uppercase tracking-wider mb-1.5">
                Included Filter Criteria
              </label>
              {activeCriteria.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 bg-stormy-canvas rounded-xl border border-stormy-border/80">
                  {activeCriteria.map((c, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stormy-border text-xs font-medium text-stormy-main shadow-2xs"
                    >
                      <span className="text-stormy-muted font-normal">{c.label}:</span>
                      <span className="font-semibold">{c.value}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stormy-muted italic bg-stormy-canvas p-3 rounded-xl border border-stormy-border/80">
                  No specific filters applied. This will match all active vacancies.
                </p>
              )}
            </div>

            {/* Alert Notification Toggle */}
            <div className="p-3.5 bg-stormy-sky/5 border border-stormy-sky/20 rounded-xl space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAlertEnabled}
                  onChange={(e) => setIsAlertEnabled(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-stormy-border text-stormy-sky focus:ring-stormy-sky cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stormy-dark">
                      Enable Job Alerts
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-stormy-muted mt-0.5">
                    Receive in-app alerts and notifications whenever new matching jobs are discovered by the platform.
                  </p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stormy-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
                Save Search
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
