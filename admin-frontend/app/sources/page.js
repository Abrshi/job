'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function AdminSourcesPage() {
  const [activeTab, setActiveTab] = useState('sources'); // 'sources' | 'triggers'
  const [sources, setSources] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [triggeringId, setTriggeringId] = useState(null);
  const [filterSourceId, setFilterSourceId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [selectedError, setSelectedError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'API',
    endpointUrl: '',
    pollingInterval: 60,
    isActive: true,
    headers: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await adminApiClient.get('/admin/sources');
      setSources(res?.data?.sources || []);
    } catch (err) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterSourceId) query.set('sourceId', filterSourceId);
      if (filterStatus) query.set('status', filterStatus);
      query.set('limit', '50');

      const res = await adminApiClient.get(`/admin/sources/runs?${query.toString()}`);
      setRuns(res?.data?.runs || []);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (activeTab === 'triggers') {
      fetchRuns();
    }
  }, [activeTab, filterSourceId, filterStatus]);

  const handleTriggerRun = async (sourceId) => {
    setTriggeringId(sourceId);
    try {
      await adminApiClient.post(`/admin/sources/${sourceId}/run`);
      alert('Ingestion run triggered successfully.');
      fetchSources();
      if (activeTab === 'triggers') fetchRuns();
    } catch (err) {
      alert(err.message || 'Failed to trigger ingestion run');
    } finally {
      setTriggeringId(null);
    }
  };

  const handleToggleActive = async (source) => {
    try {
      await adminApiClient.patch(`/admin/sources/${source.id}`, {
        isActive: !source.isActive,
      });
      fetchSources();
    } catch (err) {
      alert(err.message || 'Failed to toggle source active state');
    }
  };

  const handleDeleteSource = async (source) => {
    if (!confirm(`Are you sure you want to delete job source "${source.name}"? This cannot be undone.`)) return;
    try {
      await adminApiClient.delete(`/admin/sources/${source.id}`);
      fetchSources();
    } catch (err) {
      alert(err.message || 'Failed to delete source');
    }
  };

  const handleOpenAddModal = () => {
    setEditingSource(null);
    setFormData({
      name: '',
      slug: '',
      type: 'API',
      endpointUrl: '',
      pollingInterval: 60,
      isActive: true,
      headers: '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (source) => {
    setEditingSource(source);
    setFormData({
      name: source.name || '',
      slug: source.slug || '',
      type: source.type || 'API',
      endpointUrl: source.endpointUrl || '',
      pollingInterval: source.pollingInterval || 60,
      isActive: source.isActive ?? true,
      headers: source.headers ? JSON.stringify(source.headers, null, 2) : '',
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      let parsedHeaders = undefined;
      if (formData.headers && formData.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(formData.headers);
        } catch {
          throw new Error('Headers must be a valid JSON object');
        }
      }

      if (editingSource) {
        // Update existing
        await adminApiClient.patch(`/admin/sources/${editingSource.id}`, {
          name: formData.name.trim(),
          endpointUrl: formData.endpointUrl.trim(),
          pollingInterval: Number(formData.pollingInterval),
          isActive: formData.isActive,
          headers: parsedHeaders,
        });
      } else {
        // Create new
        const autoSlug = formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        await adminApiClient.post('/admin/sources', {
          name: formData.name.trim(),
          slug: autoSlug,
          type: formData.type,
          endpointUrl: formData.endpointUrl.trim(),
          pollingInterval: Number(formData.pollingInterval),
          isActive: formData.isActive,
          headers: parsedHeaders,
        });
      }

      setShowAddModal(false);
      fetchSources();
    } catch (err) {
      setFormError(err.message || 'Failed to save job source');
    } finally {
      setFormSubmitting(false);
    }
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return 'Running...';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Job Aggregation Engine</h2>
            <p className="text-sm text-slate-400 mt-1">
              Configure scraping platforms, monitor execution timing for each fetch trigger, and register new job sites.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" onClick={handleOpenAddModal}>
              + Add New Job Site
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => (activeTab === 'sources' ? fetchSources() : fetchRuns())}
              loading={loading || runsLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'sources' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Configured Sources ({sources.length})
            {activeTab === 'sources' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('triggers')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'triggers' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Fetch Triggers &amp; Timing Logs
            {activeTab === 'triggers' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: Configured Sources */}
        {activeTab === 'sources' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sources.map((s) => (
              <div
                key={s.id}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-card flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">{s.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700">
                        {s.type}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.isActive
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-mono truncate">{s.endpointUrl}</p>

                  <div className="mt-4 text-xs text-slate-300 space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Polling Interval:</span>
                      <span className="font-semibold text-white">{s.pollingInterval || 60}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Trigger:</span>
                      <span className="text-slate-200">
                        {s.lastRunAt ? new Date(s.lastRunAt).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Next Scheduled:</span>
                      <span className="text-sky-300">
                        {s.nextRunAt ? new Date(s.nextRunAt).toLocaleTimeString() : 'Dynamic'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs font-bold"
                    loading={triggeringId === s.id}
                    onClick={() => handleTriggerRun(s.id)}
                  >
                    Run Ingest Now &rarr;
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleOpenEditModal(s)}
                    >
                      Edit Config
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleToggleActive(s)}
                    >
                      {s.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-rose-400 hover:text-rose-300"
                      onClick={() => handleDeleteSource(s)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: Trigger Runs & Timing History */}
        {activeTab === 'triggers' && (
          <div className="space-y-4">
            {/* Run Filters */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Filter Triggers:
              </span>
              <select
                value={filterSourceId}
                onChange={(e) => setFilterSourceId(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
              >
                <option value="">All Platforms</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
              >
                <option value="">All Outcomes</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="RUNNING">RUNNING</option>
                <option value="FAILED">FAILED</option>
                <option value="PARTIAL_SUCCESS">PARTIAL_SUCCESS</option>
              </select>

              <div className="ml-auto text-xs text-slate-400">
                Displaying last {runs.length} trigger events
              </div>
            </div>

            {/* Triggers Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Platform</th>
                      <th className="px-6 py-4">Trigger Time</th>
                      <th className="px-6 py-4">Execution Timing</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Volume (Fetched / New / Updated)</th>
                      <th className="px-6 py-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {runsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                          Loading trigger records...
                        </td>
                      </tr>
                    ) : runs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                          No trigger history recorded yet. Click &quot;Run Ingest Now&quot; on any source to trigger a run.
                        </td>
                      </tr>
                    ) : (
                      runs.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{run.source?.name || 'Unknown'}</div>
                            <span className="text-[10px] font-mono text-slate-400">{run.source?.slug}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-300">
                            <div>{new Date(run.startedAt).toLocaleTimeString()}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(run.startedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                run.durationMs !== null
                                  ? run.durationMs < 3000
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                    : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                  : 'bg-sky-950/60 text-sky-400 animate-pulse'
                              }`}
                            >
                              {formatDuration(run.durationMs)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
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
                          <td className="px-6 py-4 text-xs font-mono">
                            <span className="text-white font-bold">{run.recordsFetched}</span> fetched &bull;{' '}
                            <span className="text-emerald-400 font-bold">+{run.jobsCreated}</span> new &bull;{' '}
                            <span className="text-sky-400">{run.jobsUpdated}</span> updated
                          </td>
                          <td className="px-6 py-4 text-right">
                            {run.errorSummary ? (
                              <button
                                onClick={() => setSelectedError(run.errorSummary)}
                                className="text-xs text-rose-400 hover:underline cursor-pointer"
                              >
                                View Error
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">Clean</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add / Edit Job Site */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-elevated space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">
                  {editingSource ? `Edit Source: ${editingSource.name}` : 'Register New Job Site / Platform'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {formError && <Alert variant="danger">{formError}</Alert>}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Platform / Site Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. RemoteOK Jobs, LinkedIn Tech"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                  />
                </div>

                {!editingSource && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Slug Identifier (auto-derived if blank)
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="e.g. remoteok-jobs"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Ingestion Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      disabled={!!editingSource}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="API">API / GraphQL</option>
                      <option value="RSS">RSS Feed</option>
                      <option value="SCRAPER">Web Scraper</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Polling Interval (mins) *
                    </label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={10080}
                      value={formData.pollingInterval}
                      onChange={(e) => setFormData({ ...formData, pollingInterval: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Endpoint / Feed URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={formData.endpointUrl}
                    onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                    placeholder="https://remoteok.com/api"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Custom Headers (Optional JSON e.g. Auth Tokens)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.headers}
                    onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                    placeholder='{ "Authorization": "Bearer token" }'
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-400 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-sky-400 focus:ring-sky-400"
                  />
                  <label htmlFor="isActiveToggle" className="text-xs text-slate-300 cursor-pointer">
                    Enable automated background polling immediately
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" loading={formSubmitting}>
                    {editingSource ? 'Save Changes' : 'Register Source'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Run Error */}
        {selectedError && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-elevated space-y-4">
              <h3 className="text-base font-bold text-rose-400">Trigger Error Summary</h3>
              <pre className="p-3 bg-slate-950 rounded-lg text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {selectedError}
              </pre>
              <div className="text-right">
                <Button variant="secondary" size="sm" onClick={() => setSelectedError(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
