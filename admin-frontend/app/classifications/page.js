'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

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
        adminApiClient.get(`/admin/classifications/review?page=${page}&limit=10`),
        adminApiClient.get('/admin/categories'),
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
      await adminApiClient.post(`/admin/classifications/${jobId}/accept`);
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
      await adminApiClient.post(`/admin/classifications/${overrideJob.id}/override`, {
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
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">AI Classification & Taxonomy Review</h2>
            <p className="text-sm text-slate-400 mt-1">
              Audit low-confidence classifications, moderate AI taxonomy assignments, and inspect the approved category system.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex p-1 bg-slate-900 rounded-xl border border-slate-800 shadow-card">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'review'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Review Queue ({totalPending})
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Taxonomy Categories ({categories.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* Tab 1: Review Queue */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {loading ? (
              <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center text-slate-400 shadow-card">
                <div className="w-8 h-8 mx-auto border-3 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
                Loading AI classification review queue...
              </div>
            ) : pendingJobs.length === 0 ? (
              <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center space-y-3 shadow-card">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950 text-emerald-400 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">All Clear! No Pending Classification Reviews</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
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
                      className="p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-card flex flex-col md:flex-row items-start justify-between gap-6 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                              {job.source?.name || 'Direct'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                conf >= 0.6
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {(conf * 100).toFixed(0)}% Confidence
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-1.5">
                            {job.normalizedTitle || job.originalTitle}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {job.companyName || 'Unknown Employer'} &bull; Ingested: {new Date(job.firstSeenAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center space-x-6">
                            <div>
                              <span className="text-[10px] text-slate-500 block">AI Predicted Category:</span>
                              <strong className="text-sky-400 font-semibold">
                                {currentCls?.predictedCategoryName || job.category?.name || 'Unassigned'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block">Experience Detected:</span>
                              <strong className="text-slate-200 font-semibold">
                                {currentCls?.predictedExperienceLevel || job.experienceLevel || 'UNSPECIFIED'}
                              </strong>
                            </div>
                          </div>
                          {currentCls?.explanation && (
                            <p className="text-[11px] text-slate-400 italic pt-1.5 border-t border-slate-800">
                              &ldquo;{currentCls.explanation}&rdquo;
                            </p>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {job.normalizedDescription || job.originalDescription}
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center justify-end gap-2.5 w-full md:w-auto shrink-0 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAccept(job.id)}
                          className="w-full sm:w-36 text-xs"
                        >
                          Accept Prediction
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openOverrideModal(job)}
                          className="w-full sm:w-36 text-xs"
                        >
                          Override / Correct
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong> ({totalPending} items)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
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
              <div key={cat.id} className="p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-card space-y-2 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                    {cat._count?.jobs ?? 0} jobs
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-400">{cat.slug}</p>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {cat.description || 'No taxonomy description provided.'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Manual Override Modal */}
        {overrideJob && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Manually Re-Categorize Vacancy</h3>
                <button onClick={() => setOverrideJob(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              <div className="text-slate-300 font-medium truncate">
                {overrideJob.normalizedTitle || overrideJob.originalTitle}
              </div>

              <form onSubmit={handleOverrideSubmit} className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Approved Category (1 of 20) *</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 font-semibold focus:outline-none focus:border-sky-400"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Experience Level *</label>
                  <select
                    value={selectedExperience}
                    onChange={(e) => setSelectedExperience(e.target.value)}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
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
                  <label className="block font-semibold text-slate-300 mb-1">Admin Audit Justification (Optional)</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Corrected to Software & IT based on React & Node requirement in body."
                    value={overrideExplanation}
                    onChange={(e) => setOverrideExplanation(e.target.value)}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOverrideJob(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={submitting}
                  >
                    Save Override (100% Certainty)
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
