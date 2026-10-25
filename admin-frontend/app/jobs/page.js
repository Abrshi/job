'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modals state
  const [viewingJob, setViewingJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Fetch categories for filtering and edit dropdowns
  useEffect(() => {
    adminApiClient
      .get('/admin/categories')
      .then((res) => {
        setCategories(res?.data?.categories || []);
      })
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  const fetchJobs = async (targetPage = page) => {
    setLoading(true);
    setActionError('');
    try {
      const query = new URLSearchParams({
        page: targetPage.toString(),
        limit: '20',
      });
      if (statusFilter) query.set('status', statusFilter);
      if (categoryFilter) query.set('categoryId', categoryFilter);
      if (search.trim()) query.set('search', search.trim());

      const res = await adminApiClient.get(`/admin/jobs?${query.toString()}`);
      setJobs(res?.data?.jobs || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
      setPage(res?.data?.page || 1);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to load jobs:', err);
      setActionError(err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
  }, [statusFilter, categoryFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchJobs(1);
  };

  // Bulk selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(jobs.map((j) => j.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Apply status '${newStatus}' to ${selectedIds.size} selected jobs?`)) return;

    setBulkLoading(true);
    try {
      await adminApiClient.post('/admin/jobs/bulk-status', {
        ids: Array.from(selectedIds),
        status: newStatus,
      });
      await fetchJobs();
    } catch (err) {
      alert(err.message || 'Failed to update selected jobs');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected jobs from the database? This cannot be undone.`)) return;

    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      for (const id of ids) {
        await adminApiClient.delete(`/admin/jobs/${id}`);
      }
      await fetchJobs();
    } catch (err) {
      alert(err.message || 'Error occurred while deleting some jobs');
      fetchJobs();
    } finally {
      setBulkLoading(false);
    }
  };

  // Single job actions
  const handleStatusUpdate = async (jobId, newStatus) => {
    try {
      await adminApiClient.patch(`/admin/jobs/${jobId}/status`, { status: newStatus });
      fetchJobs();
    } catch (err) {
      alert(err.message || 'Failed to update job status');
    }
  };

  const handleReclassify = async (jobId) => {
    try {
      await adminApiClient.post(`/admin/jobs/${jobId}/classify`);
      fetchJobs();
    } catch (err) {
      alert(err.message || 'Failed to reclassify job');
    }
  };

  const handleDeleteJob = async (job) => {
    if (!confirm(`Are you sure you want to delete "${job.title || job.normalizedTitle}"?`)) return;
    try {
      await adminApiClient.delete(`/admin/jobs/${job.id}`);
      fetchJobs();
    } catch (err) {
      alert(err.message || 'Failed to delete job');
    }
  };

  // Open Edit Modal
  const openEditModal = (job) => {
    setEditingJob(job);
    setEditFormData({
      title: job.normalizedTitle || job.title || '',
      companyName: job.companyName || '',
      city: job.city || '',
      country: job.country || '',
      workArrangement: job.workArrangement || '',
      employmentType: job.employmentType || '',
      experienceLevel: job.experienceLevel || '',
      salaryMin: job.salaryMin || '',
      salaryMax: job.salaryMax || '',
      salaryCurrency: job.salaryCurrency || 'USD',
      status: job.status || 'ACTIVE',
      categoryId: job.categoryId || '',
      applicationUrl: job.applicationUrl || '',
      description: job.normalizedDescription || job.originalDescription || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingJob) return;

    setSaveLoading(true);
    try {
      const payload = {
        title: editFormData.title,
        companyName: editFormData.companyName,
        city: editFormData.city || null,
        country: editFormData.country || null,
        workArrangement: editFormData.workArrangement || null,
        employmentType: editFormData.employmentType || null,
        experienceLevel: editFormData.experienceLevel || null,
        salaryMin: editFormData.salaryMin ? Number(editFormData.salaryMin) : null,
        salaryMax: editFormData.salaryMax ? Number(editFormData.salaryMax) : null,
        salaryCurrency: editFormData.salaryCurrency || 'USD',
        status: editFormData.status,
        categoryId: editFormData.categoryId || null,
        applicationUrl: editFormData.applicationUrl || null,
        description: editFormData.description,
      };

      await adminApiClient.patch(`/admin/jobs/${editingJob.id}`, payload);
      setEditingJob(null);
      fetchJobs();
    } catch (err) {
      alert(err.message || 'Failed to save job changes');
    } finally {
      setSaveLoading(false);
    }
  };

  // Open View Modal (fetches full job details with classifications)
  const openViewModal = async (job) => {
    try {
      const res = await adminApiClient.get(`/admin/jobs/${job.id}`);
      setViewingJob(res?.data?.job || job);
    } catch (err) {
      setViewingJob(job);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Job Moderation & Pipeline</h2>
            <p className="text-sm text-slate-400 mt-1">
              Inspect scraped vacancies, edit posting details, moderate taxonomy classifications, and manage lifecycle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
              {total.toLocaleString()} total vacancies
            </span>
            <Button variant="secondary" size="sm" onClick={() => fetchJobs()} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-card">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Search by job title, company, or external ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-400"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-400 max-w-[200px]"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <Button type="submit" variant="primary" size="md">
                Search
              </Button>
            </div>
          </form>
        </div>

        {/* Bulk Actions Floating Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-sky-950/80 border border-sky-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-sky-200">
                {selectedIds.size} job{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-sky-400 hover:text-sky-300 underline cursor-pointer"
              >
                Deselect all
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('ACTIVE')}
                disabled={bulkLoading}
              >
                Set Active
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('ARCHIVED')}
                disabled={bulkLoading}
              >
                Set Archived
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusChange('EXPIRED')}
                disabled={bulkLoading}
              >
                Set Expired
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkLoading}
              >
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Jobs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={jobs.length > 0 && selectedIds.size === jobs.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-400 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-4">Title & Company</th>
                  <th className="px-4 py-4">Location & Work</th>
                  <th className="px-4 py-4">Source</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <svg className="w-5 h-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Querying vacancies from shared database...</span>
                      </div>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No vacancies found matching current filter.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const isSelected = selectedIds.has(job.id);
                    return (
                      <tr
                        key={job.id}
                        className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-sky-950/20' : ''}`}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(job.id)}
                            className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-400 cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white hover:text-sky-300 transition-colors cursor-pointer" onClick={() => openViewModal(job)}>
                            {job.normalizedTitle || job.originalTitle}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {job.companyName || 'Unknown Company'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-300">
                          <div>{[job.city, job.country].filter(Boolean).join(', ') || 'Unspecified'}</div>
                          {job.workArrangement && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded">
                              {job.workArrangement}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            {job.source?.name || 'Direct'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                              job.status === 'ACTIVE'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : job.status === 'DRAFT'
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : job.status === 'EXPIRED'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-300">
                          {job.category?.name || <span className="text-slate-500">Unclassified</span>}
                        </td>
                        <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewModal(job)}
                            className="text-xs text-sky-400 hover:text-sky-300"
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(job)}
                            className="text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReclassify(job.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                            title="Run automated classification against taxonomy"
                          >
                            Classify
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJob(job)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">{totalPages}</span> ({total} items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => fetchJobs(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => fetchJobs(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* View Job Modal */}
        {viewingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {viewingJob.normalizedTitle || viewingJob.originalTitle}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{viewingJob.companyName || 'Unknown Company'}</span>
                    <span>•</span>
                    <span>Source: {viewingJob.source?.name || 'Direct'}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-500">ID: {viewingJob.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingJob(null)}
                  className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Status & Key Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <span className="font-bold text-white uppercase">{viewingJob.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Category</span>
                  <span className="font-semibold text-sky-400">{viewingJob.category?.name || 'Unclassified'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Arrangement</span>
                  <span className="font-semibold text-slate-200">{viewingJob.workArrangement || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Experience Level</span>
                  <span className="font-semibold text-slate-200">{viewingJob.experienceLevel || 'N/A'}</span>
                </div>
              </div>

              {/* Compensation & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block font-semibold mb-1">Location</span>
                  <span className="text-slate-200">
                    {[viewingJob.city, viewingJob.country].filter(Boolean).join(', ') || 'Not specified'}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block font-semibold mb-1">Salary Range</span>
                  <span className="text-slate-200">
                    {viewingJob.salaryMin || viewingJob.salaryMax
                      ? `${viewingJob.salaryCurrency || 'USD'} ${viewingJob.salaryMin?.toLocaleString() || '0'} - ${
                          viewingJob.salaryMax?.toLocaleString() || 'N/A'
                        }`
                      : 'Not disclosed'}
                  </span>
                </div>
              </div>

              {/* URLs */}
              <div className="space-y-2 text-xs">
                {viewingJob.applicationUrl && (
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Application Link:</span>
                    <a
                      href={viewingJob.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline break-all"
                    >
                      {viewingJob.applicationUrl}
                    </a>
                  </div>
                )}
                {viewingJob.originalUrl && (
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Original Scraped URL:</span>
                    <a
                      href={viewingJob.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-300 underline break-all"
                    >
                      {viewingJob.originalUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Description</h4>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
                  {viewingJob.normalizedDescription || viewingJob.originalDescription || 'No description provided.'}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = viewingJob;
                    setViewingJob(null);
                    openEditModal(target);
                  }}
                >
                  Edit Job
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setViewingJob(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Job Modal */}
        {editingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Edit Job Posting</h3>
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Job Title *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.title}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={editFormData.companyName}
                      onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                    <select
                      value={editFormData.categoryId}
                      onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">(None / Unclassified)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                    <input
                      type="text"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Country</label>
                    <input
                      type="text"
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Work Arrangement</label>
                    <select
                      value={editFormData.workArrangement}
                      onChange={(e) => setEditFormData({ ...editFormData, workArrangement: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">Unspecified</option>
                      <option value="REMOTE">REMOTE</option>
                      <option value="ONSITE">ONSITE</option>
                      <option value="HYBRID">HYBRID</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Employment Type</label>
                    <select
                      value={editFormData.employmentType}
                      onChange={(e) => setEditFormData({ ...editFormData, employmentType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">Unspecified</option>
                      <option value="FULL_TIME">FULL_TIME</option>
                      <option value="PART_TIME">PART_TIME</option>
                      <option value="CONTRACT">CONTRACT</option>
                      <option value="INTERNSHIP">INTERNSHIP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Experience Level</label>
                    <select
                      value={editFormData.experienceLevel}
                      onChange={(e) => setEditFormData({ ...editFormData, experienceLevel: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">Unspecified</option>
                      <option value="ENTRY">ENTRY</option>
                      <option value="MID">MID</option>
                      <option value="SENIOR">SENIOR</option>
                      <option value="LEAD">LEAD</option>
                      <option value="EXECUTIVE">EXECUTIVE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Status *</label>
                    <select
                      required
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="ARCHIVED">ARCHIVED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Min Salary</label>
                    <input
                      type="number"
                      value={editFormData.salaryMin}
                      onChange={(e) => setEditFormData({ ...editFormData, salaryMin: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Max Salary</label>
                    <input
                      type="number"
                      value={editFormData.salaryMax}
                      onChange={(e) => setEditFormData({ ...editFormData, salaryMax: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Application URL</label>
                    <input
                      type="url"
                      value={editFormData.applicationUrl}
                      onChange={(e) => setEditFormData({ ...editFormData, applicationUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                    <textarea
                      rows={5}
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingJob(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={saveLoading}>
                    Save Changes
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
