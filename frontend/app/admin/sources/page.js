'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export default function AdminSourcesPage() {
  const [sources, setSources] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Manual Trigger & Action state
  const [runningId, setRunningId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Edit / Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'API',
    endpointUrl: '',
    pollingInterval: 60,
    isActive: false,
    headersJson: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Runs history drawer
  const [selectedSourceRuns, setSelectedSourceRuns] = useState(null);
  const [runsLoading, setRunsLoading] = useState(false);

  async function loadSourcesAndRuns() {
    setLoading(true);
    setError(null);
    try {
      const [srcRes, runsRes] = await Promise.all([
        apiClient.get('/admin/sources'),
        apiClient.get('/admin/sources/runs'),
      ]);
      setSources(srcRes?.data?.sources || []);
      setRuns(runsRes?.data?.runs || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch job sources.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSourcesAndRuns();
  }, []);

  const handleManualRun = async (sourceId, sourceName) => {
    setRunningId(sourceId);
    setActionMessage(null);
    try {
      const res = await apiClient.post(`/admin/sources/${sourceId}/run`);
      const run = res?.data?.run;
      if (run?.status === 'SUCCESS') {
        setActionMessage({
          type: 'success',
          text: `Run completed successfully for ${sourceName}: ${run.recordsFetched} fetched, ${run.jobsCreated} created, ${run.jobsUpdated} updated.`,
        });
      } else {
        setActionMessage({
          type: 'warning',
          text: `Run completed with state '${run?.status}' for ${sourceName}: ${run?.errorSummary || 'Source requires authentication credentials.'}`,
        });
      }
      loadSourcesAndRuns();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: `Run failed for ${sourceName}: ${err.message}`,
      });
    } finally {
      setRunningId(null);
    }
  };

  const handleToggleActive = async (source) => {
    try {
      await apiClient.patch(`/admin/sources/${source.id}`, {
        isActive: !source.isActive,
      });
      loadSourcesAndRuns();
    } catch (err) {
      alert(`Failed to toggle status: ${err.message}`);
    }
  };

  const handleViewRuns = async (source) => {
    setRunsLoading(true);
    setSelectedSourceRuns(source);
    try {
      const res = await apiClient.get(`/admin/sources/${source.id}/runs`);
      setRuns(res?.data?.runs || []);
    } catch (err) {
      alert(`Failed to load runs: ${err.message}`);
    } finally {
      setRunsLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      slug: '',
      type: 'API',
      endpointUrl: '',
      pollingInterval: 60,
      isActive: false,
      headersJson: '',
    });
    setFormError(null);
    setEditingSource(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (source) => {
    setFormData({
      name: source.name,
      slug: source.slug,
      type: source.type || 'API',
      endpointUrl: source.endpointUrl,
      pollingInterval: source.pollingInterval,
      isActive: source.isActive,
      headersJson: '',
    });
    setFormError(null);
    setEditingSource(source);
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      let parsedHeaders = undefined;
      if (formData.headersJson.trim()) {
        try {
          parsedHeaders = JSON.parse(formData.headersJson);
        } catch {
          throw new Error('Headers must be valid JSON format (e.g. {"Authorization": "Bearer ..."})');
        }
      }

      if (editingSource) {
        // Update existing source
        await apiClient.patch(`/admin/sources/${editingSource.id}`, {
          name: formData.name,
          endpointUrl: formData.endpointUrl,
          pollingInterval: Number(formData.pollingInterval),
          isActive: formData.isActive,
          ...(parsedHeaders ? { headers: parsedHeaders } : {}),
        });
      } else {
        // Create new source
        await apiClient.post('/admin/sources', {
          name: formData.name,
          slug: formData.slug,
          type: formData.type,
          endpointUrl: formData.endpointUrl,
          pollingInterval: Number(formData.pollingInterval),
          isActive: formData.isActive,
          ...(parsedHeaders ? { headers: parsedHeaders } : {}),
        });
      }

      setIsAddModalOpen(false);
      loadSourcesAndRuns();
    } catch (err) {
      setFormError(err.message || 'Failed to save source.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stormy-main tracking-tight">Job Sources & Scheduler Controls</h2>
          <p className="text-sm text-stormy-muted">
            Configure automated polling intervals, trigger manual collection, and inspect execution health.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Custom Job Source
        </button>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : actionMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="ml-4 font-bold text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Afriwork Status & Findings Banner */}
      <div className="p-5 bg-white rounded-2xl border border-stormy-border shadow-subtle space-y-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <h3 className="text-sm font-bold text-stormy-main">Afriwork Ingestion Adapter Status</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800">
            Verified / Auth-Protected
          </span>
        </div>
        <p className="text-xs text-stormy-muted leading-relaxed">
          The Afriwork GraphQL endpoint (<code className="px-1.5 py-0.5 bg-stormy-canvas rounded text-stormy-dark">https://api.afriworket.com/v1/graphql</code>) uses a Hasura authentication hook. Anonymous collection is rejected with HTTP 200/401 <code className="text-red-600">access-denied</code>. The adapter is fully implemented with automated fingerprint deduplication, normalization, and offline test fixtures. Live collection remains disabled by default (<code className="font-semibold text-stormy-dark">isActive: false</code>) until authorized access credentials are added to the source headers.
        </p>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-stormy-muted">
            <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
            Loading job source providers...
          </div>
        ) : (
          sources.map((source) => {
            const isRunning = runningId === source.id;
            return (
              <div
                key={source.id}
                className="bg-white rounded-2xl border border-stormy-border p-6 shadow-subtle flex flex-col justify-between space-y-5"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-lg font-bold text-stormy-main">{source.name}</h4>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stormy-canvas border border-stormy-border text-stormy-muted">
                          {source.type || 'API'}
                        </span>
                      </div>
                      <p className="text-xs text-stormy-slate mt-0.5 font-mono">{source.slug}</p>
                    </div>

                    <button
                      onClick={() => handleToggleActive(source)}
                      className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-full transition-colors cursor-pointer ${
                        source.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-stormy-canvas text-stormy-muted hover:bg-stormy-border border border-stormy-border'
                      }`}
                    >
                      {source.isActive ? 'Active (Polling)' : 'Disabled'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="p-2.5 bg-stormy-canvas rounded-lg border border-stormy-border">
                      <span className="text-[10px] text-stormy-muted block">Polling Interval</span>
                      <span className="font-semibold text-stormy-dark">Every {source.pollingInterval} mins</span>
                    </div>
                    <div className="p-2.5 bg-stormy-canvas rounded-lg border border-stormy-border">
                      <span className="text-[10px] text-stormy-muted block">Next Scheduled Run</span>
                      <span className="font-semibold text-stormy-dark">
                        {source.nextRunAt ? new Date(source.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'On Demand'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-stormy-muted truncate">
                    <strong>Endpoint:</strong> <span className="font-mono">{source.endpointUrl}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-stormy-border pt-4">
                  <div className="space-x-2">
                    <button
                      onClick={() => openEditModal(source)}
                      className="px-3 py-1.5 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg border border-stormy-border transition-colors cursor-pointer"
                    >
                      Edit Config
                    </button>
                    <button
                      onClick={() => handleViewRuns(source)}
                      className="px-3 py-1.5 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg border border-stormy-border transition-colors cursor-pointer"
                    >
                      Runs History
                    </button>
                  </div>

                  <button
                    onClick={() => handleManualRun(source.id, source.name)}
                    disabled={isRunning}
                    className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-3.5 h-3.5 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Executing...
                      </>
                    ) : (
                      'Trigger Run Now'
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Historical Collection Runs Table */}
      <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stormy-main">
              {selectedSourceRuns ? `Runs History: ${selectedSourceRuns.name}` : 'Global Collection Runs Log'}
            </h3>
            <p className="text-xs text-stormy-muted">Audit log of execution duration, fetched vacancies, and error diagnostics</p>
          </div>
          {selectedSourceRuns && (
            <button
              onClick={() => { setSelectedSourceRuns(null); loadSourcesAndRuns(); }}
              className="text-xs font-semibold text-stormy-sky hover:underline"
            >
              Show All Sources
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Source</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Started</th>
                <th className="py-2.5 px-3 font-semibold">Finished</th>
                <th className="py-2.5 px-3 font-semibold">Fetched</th>
                <th className="py-2.5 px-3 font-semibold">Created</th>
                <th className="py-2.5 px-3 font-semibold">Updated</th>
                <th className="py-2.5 px-3 font-semibold">Diagnostics / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stormy-border">
              {runsLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stormy-muted">
                    Loading runs history...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stormy-muted">
                    No runs recorded yet.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="hover:bg-stormy-canvas/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-stormy-main">
                      {run.source?.name || 'Afriwork'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          run.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : run.status === 'RUNNING'
                            ? 'bg-sky-100 text-sky-800 animate-pulse'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-stormy-muted font-mono text-[11px]">
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-stormy-muted font-mono text-[11px]">
                      {run.finishedAt ? new Date(run.finishedAt).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-stormy-main">{run.recordsFetched}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">{run.jobsCreated}</td>
                    <td className="py-2.5 px-3 text-stormy-slate">{run.jobsUpdated}</td>
                    <td className="py-2.5 px-3 text-stormy-muted max-w-[220px] truncate" title={run.errorSummary || 'None'}>
                      {run.errorSummary ? (
                        <span className="text-red-600 font-mono text-[10px]">{run.errorSummary}</span>
                      ) : (
                        <span className="text-emerald-700">Clean execution</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Source Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-elevated space-y-5">
            <div className="flex items-start justify-between border-b border-stormy-border pb-3">
              <h3 className="text-lg font-bold text-stormy-main">
                {editingSource ? `Edit Source: ${editingSource.name}` : 'Configure New Job Source'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-stormy-muted hover:text-stormy-main">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stormy-main mb-1">Provider Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Afriwork, Ethiojobs, Shega"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              {!editingSource && (
                <div>
                  <label className="block font-semibold text-stormy-main mb-1">Unique Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ethiojobs (lowercase alphanumeric, dashes)"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-stormy-main mb-1">Endpoint URL (SSRF Protected) *</label>
                <input
                  type="url"
                  required
                  placeholder="https://api.example.com/v1/jobs"
                  value={formData.endpointUrl}
                  onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
                <span className="text-[10px] text-stormy-muted mt-0.5 block">
                  Private IPs, loopback, and cloud metadata URLs are strictly blocked.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stormy-main mb-1">Polling Interval (Minutes) *</label>
                  <input
                    type="number"
                    min="5"
                    max="10080"
                    required
                    value={formData.pollingInterval}
                    onChange={(e) => setFormData({ ...formData, pollingInterval: e.target.value })}
                    className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stormy-main mb-1">Source Ingestion Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                  >
                    <option value="API">API (REST / GraphQL)</option>
                    <option value="RSS">RSS Feed</option>
                    <option value="SCRAPER">Permitted Scraper</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stormy-main mb-1">
                  Sensitive Auth Headers JSON (Optional)
                </label>
                <textarea
                  rows="2"
                  placeholder='{"Authorization": "Bearer YOUR_ACCESS_TOKEN"}'
                  value={formData.headersJson}
                  onChange={(e) => setFormData({ ...formData, headersJson: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main font-mono text-[11px] focus:ring-2 focus:ring-stormy-sky"
                />
                <span className="text-[10px] text-stormy-muted block">
                  Headers are stored securely in MySQL and redacted from public API outputs.
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-stormy-sky rounded border-stormy-border"
                />
                <label htmlFor="isActive" className="text-xs text-stormy-main font-medium cursor-pointer">
                  Enable automated scheduler polling for this source
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stormy-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
