'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [isRemote, setIsRemote] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [sortBy, setSortBy] = useState('firstSeenAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Metadata dropdowns
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);

  // Details Modal & Action state
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'STATUS', jobId, status, title }

  // Load sources and categories for filters
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [srcRes, catRes] = await Promise.all([
          apiClient.get('/admin/sources'),
          apiClient.get('/admin/categories'),
        ]);
        setSources(srcRes?.data?.sources || []);
        setCategories(catRes?.data?.categories || []);
      } catch {
        // Continue without filters if metadata fails
      }
    }
    loadMetadata();
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        sortBy,
        sortOrder,
      });

      if (search.trim()) params.append('search', search.trim());
      if (sourceId) params.append('sourceId', sourceId);
      if (categoryId) params.append('categoryId', categoryId);
      if (status) params.append('status', status);
      if (isRemote) params.append('isRemote', isRemote);
      if (experienceLevel) params.append('experienceLevel', experienceLevel);
      if (employmentType) params.append('employmentType', employmentType);

      const res = await apiClient.get(`/admin/jobs?${params.toString()}`);
      setJobs(res?.data?.jobs || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch catalog jobs.');
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceId, categoryId, status, isRemote, experienceLevel, employmentType, sortBy, sortOrder]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const handleOpenDetails = async (jobId) => {
    setDetailsLoading(true);
    setSelectedJob(null);
    try {
      const res = await apiClient.get(`/admin/jobs/${jobId}`);
      setSelectedJob(res?.data?.job);
    } catch (err) {
      alert(`Failed to load job details: ${err.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const executeStatusChange = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      await apiClient.patch(`/admin/jobs/${confirmAction.jobId}/status`, {
        status: confirmAction.status,
      });
      setConfirmAction(null);
      if (selectedJob && selectedJob.id === confirmAction.jobId) {
        setSelectedJob((prev) => ({ ...prev, status: confirmAction.status }));
      }
      fetchJobs();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReclassify = async (jobId) => {
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/admin/jobs/${jobId}/classify`);
      alert('AI Classification completed successfully.');
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(res?.data?.job);
      }
      fetchJobs();
    } catch (err) {
      alert(`Classification failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Search Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stormy-main tracking-tight">Jobs Catalog Management</h2>
          <p className="text-sm text-stormy-muted">
            Inspect, filter, audit, and reclassify aggregated vacancies ({total} total vacancies).
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search title, company, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white border border-stormy-border rounded-lg shadow-subtle focus:outline-none focus:ring-2 focus:ring-stormy-sky w-full md:w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle transition-colors shrink-0"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-stormy-border shadow-subtle grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Source</label>
          <select
            value={sourceId}
            onChange={(e) => { setSourceId(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE (Published)</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Work Arrangement</label>
          <select
            value={isRemote}
            onChange={(e) => { setIsRemote(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Locations</option>
            <option value="true">Remote Only</option>
            <option value="false">On-Site / Hybrid</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Experience Level</label>
          <select
            value={experienceLevel}
            onChange={(e) => { setExperienceLevel(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Experience</option>
            <option value="ENTRY">Entry Level</option>
            <option value="JUNIOR">Junior</option>
            <option value="MID">Mid Level</option>
            <option value="SENIOR">Senior</option>
            <option value="LEAD">Lead</option>
            <option value="EXECUTIVE">Executive</option>
            <option value="UNSPECIFIED">Unspecified</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Sort By</label>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-');
              setSortBy(sb);
              setSortOrder(so);
            }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="firstSeenAt-desc">Recently Ingested</option>
            <option value="publishedAt-desc">Published (Newest)</option>
            <option value="closingDate-asc">Closing Soon</option>
            <option value="firstSeenAt-asc">Oldest Ingested</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
          {error}
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Job Title & Company</th>
                <th className="py-3 px-4 font-semibold">Source</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Experience</th>
                <th className="py-3 px-4 font-semibold">Confidence</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stormy-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stormy-muted">
                    <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
                    Loading catalog jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stormy-muted">
                    No vacancies match the selected criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const conf = job.classificationConfidence ? Number(job.classificationConfidence) : null;
                  return (
                    <tr key={job.id} className="hover:bg-stormy-canvas/40 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenDetails(job.id)}
                          className="font-semibold text-stormy-main hover:text-stormy-dark text-left block truncate max-w-[240px]"
                        >
                          {job.normalizedTitle || job.originalTitle}
                        </button>
                        <p className="text-[11px] text-stormy-muted truncate max-w-[240px]">
                          {job.companyName || 'Unknown Employer'} &bull; {job.city || job.country || 'Ethiopia'}
                          {job.isRemote && (
                            <span className="ml-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded">
                              Remote
                            </span>
                          )}
                        </p>
                      </td>

                      <td className="py-3 px-4 text-stormy-muted">
                        <span className="font-medium text-stormy-dark">{job.source?.name}</span>
                        {job.externalId && (
                          <span className="block text-[10px] text-stormy-slate truncate max-w-[120px]">
                            ID: {job.externalId}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-stormy-mist/40 text-stormy-dark font-medium text-[11px]">
                          {job.category?.name || 'Unassigned'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-stormy-muted font-medium">
                          {job.experienceLevel || 'UNSPECIFIED'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {conf !== null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              conf >= 0.85
                                ? 'bg-emerald-100 text-emerald-800'
                                : conf >= 0.6
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {(conf * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-stormy-slate text-[10px]">Unrated</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            job.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : job.status === 'EXPIRED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenDetails(job.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded border border-stormy-border"
                        >
                          Details
                        </button>
                        {job.status !== 'ACTIVE' ? (
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: 'STATUS',
                                jobId: job.id,
                                status: 'ACTIVE',
                                title: `Publish vacancy '${job.normalizedTitle}'?`,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: 'STATUS',
                                jobId: job.id,
                                status: 'CLOSED',
                                title: `Close/Unpublish vacancy '${job.normalizedTitle}'?`,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-stormy-canvas border-t border-stormy-border flex items-center justify-between text-xs text-stormy-muted">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total jobs)
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white border border-stormy-border rounded-md hover:bg-stormy-canvas disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-white border border-stormy-border rounded-md hover:bg-stormy-canvas disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-elevated space-y-4">
            <h3 className="text-base font-bold text-stormy-main">Confirm Action</h3>
            <p className="text-sm text-stormy-muted">{confirmAction.title}</p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={executeStatusChange}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg"
              >
                {actionLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-elevated space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-stormy-border pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stormy-sky bg-stormy-dark px-2 py-0.5 rounded">
                  {selectedJob.source?.name}
                </span>
                <h3 className="text-xl font-bold text-stormy-main mt-1">
                  {selectedJob.normalizedTitle || selectedJob.originalTitle}
                </h3>
                <p className="text-xs text-stormy-muted">
                  {selectedJob.companyName || 'Unknown Employer'} &bull; Ingested: {new Date(selectedJob.firstSeenAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-stormy-muted hover:text-stormy-main"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* AI Classification & Review Box */}
            <div className="p-4 bg-stormy-canvas rounded-xl border border-stormy-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stormy-main flex items-center">
                  <span className="w-2 h-2 rounded-full bg-stormy-sky mr-2" />
                  AI Classification Intelligence
                </span>
                <button
                  onClick={() => handleReclassify(selectedJob.id)}
                  disabled={actionLoading}
                  className="px-2.5 py-1 text-xs font-semibold text-stormy-dark bg-white border border-stormy-border rounded-lg hover:bg-stormy-mist/40 transition-colors"
                >
                  {actionLoading ? 'Classifying...' : 'Re-Run AI Classifier'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-white rounded border border-stormy-border">
                  <span className="text-[10px] text-stormy-muted block">Assigned Category</span>
                  <span className="font-semibold text-stormy-dark">{selectedJob.category?.name || 'Unassigned'}</span>
                </div>
                <div className="p-2 bg-white rounded border border-stormy-border">
                  <span className="text-[10px] text-stormy-muted block">Experience Level</span>
                  <span className="font-semibold text-stormy-dark">{selectedJob.experienceLevel || 'UNSPECIFIED'}</span>
                </div>
                <div className="p-2 bg-white rounded border border-stormy-border">
                  <span className="text-[10px] text-stormy-muted block">Confidence Score</span>
                  <span className="font-bold text-emerald-700">
                    {selectedJob.classificationConfidence ? `${(Number(selectedJob.classificationConfidence) * 100).toFixed(0)}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-2 bg-white rounded border border-stormy-border">
                  <span className="text-[10px] text-stormy-muted block">Review State</span>
                  <span className="font-semibold uppercase text-stormy-dark">{selectedJob.classificationStatus}</span>
                </div>
              </div>

              {selectedJob.classifications?.[0]?.explanation && (
                <div className="p-2.5 bg-white rounded border border-stormy-border text-xs text-stormy-dark">
                  <strong className="text-[11px] text-stormy-muted block mb-0.5">Model Justification:</strong>
                  {selectedJob.classifications[0].explanation}
                </div>
              )}
            </div>

            {/* Source Provided vs Normalized Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-stormy-canvas rounded-xl border border-stormy-border space-y-2">
                <h4 className="font-bold text-stormy-main">Source-Provided Raw Fields</h4>
                <div>
                  <strong className="text-stormy-muted block text-[10px]">Original Title:</strong>
                  <p className="text-stormy-main font-medium">{selectedJob.originalTitle}</p>
                </div>
                <div>
                  <strong className="text-stormy-muted block text-[10px]">Source Fingerprint:</strong>
                  <code className="text-[10px] bg-white p-1 rounded border border-stormy-border block truncate">
                    {selectedJob.fingerprint}
                  </code>
                </div>
                {selectedJob.originalUrl && (
                  <div>
                    <strong className="text-stormy-muted block text-[10px]">Original Posting URL:</strong>
                    <a
                      href={selectedJob.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stormy-sky hover:underline truncate block"
                    >
                      {selectedJob.originalUrl}
                    </a>
                  </div>
                )}
                {selectedJob.applicationUrl && (
                  <div>
                    <strong className="text-stormy-muted block text-[10px]">Application Link:</strong>
                    <a
                      href={selectedJob.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stormy-sky hover:underline truncate block"
                    >
                      {selectedJob.applicationUrl}
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 bg-stormy-canvas rounded-xl border border-stormy-border space-y-2">
                <h4 className="font-bold text-stormy-main">Normalized Platform Fields</h4>
                <div>
                  <strong className="text-stormy-muted block text-[10px]">Normalized Title:</strong>
                  <p className="text-stormy-main font-semibold">{selectedJob.normalizedTitle}</p>
                </div>
                <div>
                  <strong className="text-stormy-muted block text-[10px]">Work Arrangement:</strong>
                  <p className="text-stormy-main">{selectedJob.workArrangement} {selectedJob.isRemote ? '(Remote Allowed)' : ''}</p>
                </div>
                <div>
                  <strong className="text-stormy-muted block text-[10px]">Closing Expiration Date:</strong>
                  <p className="text-stormy-main">
                    {selectedJob.closingDate ? new Date(selectedJob.closingDate).toLocaleDateString() : '30-Day Auto Fallback'}
                  </p>
                </div>
              </div>
            </div>

            {/* Description Excerpt */}
            <div>
              <h4 className="text-xs font-bold text-stormy-main mb-2">Job Description Text</h4>
              <div className="p-4 bg-stormy-canvas rounded-xl border border-stormy-border max-h-48 overflow-y-auto text-xs text-stormy-muted whitespace-pre-wrap leading-relaxed">
                {selectedJob.normalizedDescription || selectedJob.originalDescription}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-stormy-border pt-4">
              <div className="flex items-center space-x-2">
                {selectedJob.status !== 'ACTIVE' ? (
                  <button
                    onClick={() => {
                      setConfirmAction({
                        type: 'STATUS',
                        jobId: selectedJob.id,
                        status: 'ACTIVE',
                        title: `Publish vacancy '${selectedJob.normalizedTitle}'?`,
                      });
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-subtle"
                  >
                    Publish to Public Site
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmAction({
                        type: 'STATUS',
                        jobId: selectedJob.id,
                        status: 'CLOSED',
                        title: `Close vacancy '${selectedJob.normalizedTitle}'?`,
                      });
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-subtle"
                  >
                    Close Vacancy
                  </button>
                )}
                <button
                  onClick={() => {
                    setConfirmAction({
                      type: 'STATUS',
                      jobId: selectedJob.id,
                      status: 'EXPIRED',
                      title: `Manually mark vacancy '${selectedJob.normalizedTitle}' as EXPIRED?`,
                    });
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg"
                >
                  Mark Expired
                </button>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg border border-stormy-border"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
