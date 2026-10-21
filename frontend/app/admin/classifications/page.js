'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export default function AdminClassificationsPage() {
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'categories'
  const [pendingJobs, setPendingJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Override Modal state
  const [overrideJob, setOverrideJob] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedExperience, setSelectedExperience] = useState('UNSPECIFIED');
  const [overrideExplanation, setOverrideExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewRes, catRes] = await Promise.all([
        apiClient.get(`/admin/classifications/review?page=${page}&limit=10`),
        apiClient.get('/admin/categories'),
      ]);
      setPendingJobs(reviewRes?.data?.jobs || []);
      setTotalPending(reviewRes?.data?.total || 0);
      setTotalPages(reviewRes?.data?.totalPages || 1);
      setCategories(catRes?.data?.categories || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch classification review queue.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleAccept = async (jobId) => {
    try {
      await apiClient.post(`/admin/classifications/${jobId}/accept`);
      fetchQueue();
    } catch (err) {
      alert(`Accept action failed: ${err.message}`);
    }
  };

  const openOverrideModal = (job) => {
    setOverrideJob(job);
    setSelectedCategoryId(job.categoryId || (categories[0]?.id || ''));
    setSelectedExperience(job.experienceLevel || 'UNSPECIFIED');
    setOverrideExplanation('');
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideJob) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/classifications/${overrideJob.id}/override`, {
        categoryId: selectedCategoryId,
        experienceLevel: selectedExperience,
        explanation: overrideExplanation.trim() || undefined,
      });
      setOverrideJob(null);
      fetchQueue();
    } catch (err) {
      alert(`Override failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stormy-main tracking-tight">AI Classification & Taxonomy Review</h2>
          <p className="text-sm text-stormy-muted">
            Audit low-confidence classifications, correct taxonomy assignments, and inspect the 20 approved categories.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white rounded-xl border border-stormy-border shadow-subtle">
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'review'
                ? 'bg-stormy-dark text-white'
                : 'text-stormy-muted hover:text-stormy-main'
            }`}
          >
            Review Queue ({totalPending})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-stormy-dark text-white'
                : 'text-stormy-muted hover:text-stormy-main'
            }`}
          >
            20 Categories ({categories.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
          {error}
        </div>
      )}

      {/* Tab 1: Review Queue */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-stormy-border text-center text-stormy-muted shadow-subtle">
              <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
              Loading review queue...
            </div>
          ) : pendingJobs.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-stormy-border text-center space-y-3 shadow-subtle">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-stormy-main">All Clear! No Pending Reviews</h3>
              <p className="text-xs text-stormy-muted max-w-sm mx-auto">
                All vacancies have achieved high confidence (&ge; 85%) auto-acceptance or have already been manually audited.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingJobs.map((job) => {
                const currentCls = job.classifications?.[0];
                const conf = job.classificationConfidence ? Number(job.classificationConfidence) : 0;
                return (
                  <div
                    key={job.id}
                    className="p-5 bg-white rounded-2xl border border-stormy-border shadow-subtle flex flex-col md:flex-row items-start justify-between gap-6"
                  >
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stormy-canvas border border-stormy-border text-stormy-dark">
                            {job.source?.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              conf >= 0.6
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {(conf * 100).toFixed(0)}% Confidence
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-stormy-main mt-1.5">
                          {job.normalizedTitle || job.originalTitle}
                        </h4>
                        <p className="text-xs text-stormy-muted">
                          {job.companyName || 'Unknown Employer'} &bull; Ingested: {new Date(job.firstSeenAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="p-3 bg-stormy-canvas rounded-xl border border-stormy-border text-xs space-y-1.5">
                        <div className="flex items-center space-x-4">
                          <div>
                            <span className="text-[10px] text-stormy-muted block">AI Predicted Category:</span>
                            <strong className="text-stormy-dark font-semibold">
                              {currentCls?.predictedCategoryName || job.category?.name || 'Unassigned'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-stormy-muted block">Experience Detected:</span>
                            <strong className="text-stormy-dark font-semibold">
                              {currentCls?.predictedExperienceLevel || job.experienceLevel || 'UNSPECIFIED'}
                            </strong>
                          </div>
                        </div>
                        {currentCls?.explanation && (
                          <p className="text-[11px] text-stormy-muted italic pt-1 border-t border-stormy-border/60">
                            &ldquo;{currentCls.explanation}&rdquo;
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-stormy-muted line-clamp-2">
                        {job.normalizedDescription || job.originalDescription}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center justify-end gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                      <button
                        onClick={() => handleAccept(job.id)}
                        className="w-full sm:w-36 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      >
                        Accept Prediction
                      </button>
                      <button
                        onClick={() => openOverrideModal(job)}
                        className="w-full sm:w-36 px-3.5 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg border border-stormy-border transition-colors cursor-pointer"
                      >
                        Override / Correct
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Bar */}
              <div className="p-4 bg-white rounded-xl border border-stormy-border flex items-center justify-between text-xs text-stormy-muted">
                <span>Page {page} of {totalPages}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 bg-stormy-canvas border border-stormy-border rounded-md hover:bg-stormy-mist/20 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 bg-stormy-canvas border border-stormy-border rounded-md hover:bg-stormy-mist/20 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 20 Categories Overview */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="p-4 bg-white rounded-xl border border-stormy-border shadow-subtle space-y-2">
              <div className="flex items-start justify-between">
                <h4 className="font-bold text-stormy-main text-sm">{cat.name}</h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-stormy-mist/40 text-stormy-dark">
                  {cat._count?.jobs ?? 0} jobs
                </span>
              </div>
              <p className="text-[10px] font-mono text-stormy-slate">{cat.slug}</p>
              <p className="text-xs text-stormy-muted leading-relaxed line-clamp-3">
                {cat.description || 'No description provided.'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Manual Override Modal */}
      {overrideJob && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-elevated space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-stormy-border pb-3">
              <h3 className="text-base font-bold text-stormy-main">Manually Re-Categorize Vacancy</h3>
              <button onClick={() => setOverrideJob(null)} className="text-stormy-muted hover:text-stormy-main">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-stormy-dark font-medium truncate">
              {overrideJob.normalizedTitle || overrideJob.originalTitle}
            </p>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-stormy-main mb-1">Approved Category (1 of 20) *</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main font-semibold"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stormy-main mb-1">Experience Level *</label>
                <select
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value)}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main"
                >
                  <option value="ENTRY">ENTRY (Entry level, Fresh grad)</option>
                  <option value="JUNIOR">JUNIOR (1-2 years)</option>
                  <option value="MID">MID (3-5 years)</option>
                  <option value="SENIOR">SENIOR (5+ years)</option>
                  <option value="LEAD">LEAD (Lead, Manager)</option>
                  <option value="EXECUTIVE">EXECUTIVE (Director, VP, C-level)</option>
                  <option value="UNSPECIFIED">UNSPECIFIED (Missing/ambiguous text)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stormy-main mb-1">Admin Audit Justification (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Corrected to Software & IT based on React & Node requirement in body."
                  value={overrideExplanation}
                  onChange={(e) => setOverrideExplanation(e.target.value)}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stormy-border">
                <button
                  type="button"
                  onClick={() => setOverrideJob(null)}
                  className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Override (100% Certainty)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
