'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function AdminDiscoveryPage() {
  const [activeTab, setActiveTab] = useState('registry'); // 'registry' | 'gaps' | 'intake' | 'companies' | 'compliance'
  const [stats, setStats] = useState(null);
  const [searches, setSearches] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [gaps, setGaps] = useState([]);
  const [references, setReferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertState, setAlertState] = useState(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planMaxPerCat, setPlanMaxPerCat] = useState(6);
  const [planDryRun, setPlanDryRun] = useState(true);
  const [planIncludeRemote, setPlanIncludeRemote] = useState(true);
  const [planIncludeCities, setPlanIncludeCities] = useState(true);
  const [planResult, setPlanResult] = useState(null);
  const [planningLoading, setPlanningLoading] = useState(false);

  // Intake Modal
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState('');
  const [intakeTitle, setIntakeTitle] = useState('');
  const [intakeCompany, setIntakeCompany] = useState('');
  const [intakeLocation, setIntakeLocation] = useState('Addis Ababa');
  const [intakeArrangement, setIntakeArrangement] = useState('ON_SITE');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  // LinkedIn Companies
  const [companies, setCompanies] = useState([]);
  const [companiesPagination, setCompaniesPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('');
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    name: '',
    industry: '',
    location: 'Ethiopia',
    linkedinUrl: '',
    notes: '',
  });
  const [companySubmitting, setCompanySubmitting] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await adminApiClient.get('/admin/discovery/stats');
      setStats(res?.data || null);
    } catch (err) {
      console.error('Failed to load discovery stats:', err);
    }
  };

  const fetchSearches = async (page = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', '20');
      if (filterCategory) query.set('categorySlug', filterCategory);
      if (filterStatus) query.set('status', filterStatus);
      if (searchQuery) query.set('search', searchQuery);

      const res = await adminApiClient.get(`/admin/discovery/searches?${query.toString()}`);
      setSearches(res?.data?.searches || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load searches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGaps = async () => {
    try {
      const res = await adminApiClient.get('/admin/discovery/gaps');
      setGaps(res?.data?.gaps || []);
    } catch (err) {
      console.error('Failed to load coverage gaps:', err);
    }
  };

  const fetchReferences = async () => {
    try {
      const res = await adminApiClient.get('/admin/discovery/references');
      setReferences(res?.data?.references || []);
    } catch (err) {
      console.error('Failed to load discovery references:', err);
    }
  };

  const fetchCompanies = async (page = 1) => {
    setCompaniesLoading(true);
    try {
      const query = new URLSearchParams();
      query.set('page', String(page));
      query.set('limit', '20');
      if (companySearch) query.set('search', companySearch);
      if (companyStatusFilter) query.set('status', companyStatusFilter);

      const res = await adminApiClient.get(`/admin/discovery/companies?${query.toString()}`);
      setCompanies(res?.data?.companies || []);
      setCompaniesPagination(res?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load tracked companies:', err);
    } finally {
      setCompaniesLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSearches(1);
    fetchGaps();
    fetchReferences();
    fetchCompanies(1);
  }, []);

  useEffect(() => {
    if (activeTab === 'registry') {
      fetchSearches(1);
    } else if (activeTab === 'gaps') {
      fetchGaps();
    } else if (activeTab === 'intake') {
      fetchReferences();
    } else if (activeTab === 'companies') {
      fetchCompanies(1);
    }
  }, [activeTab, filterCategory, filterStatus, companyStatusFilter]);

  const handleGeneratePlan = async () => {
    setPlanningLoading(true);
    setAlertState(null);
    try {
      const payload = {
        dryRun: planDryRun,
        maxPerCategory: planMaxPerCat,
        includeRemote: planIncludeRemote,
        includeCities: planIncludeCities,
        includeLocalTerms: true,
      };
      const res = await adminApiClient.post('/admin/discovery/plan', payload);
      setPlanResult(res?.data || null);

      if (!planDryRun) {
        setAlertState({ type: 'success', message: `Plan applied: ${res?.data?.created || 0} new searches created!` });
        fetchStats();
        fetchSearches(1);
        setShowPlanModal(false);
      }
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Failed to generate plan' });
    } finally {
      setPlanningLoading(false);
    }
  };

  const handleRunAdaptiveOptimization = async () => {
    setActionLoading(true);
    setAlertState(null);
    try {
      const res = await adminApiClient.post('/admin/discovery/adaptive-optimize', {});
      const data = res?.data || {};
      setAlertState({
        type: 'success',
        message: `Adaptive Optimization Completed: Identified ${data.gapsIdentified || 0} gaps and created ${data.newSearchesCreated || 0} targeted queries.`,
      });
      fetchStats();
      fetchGaps();
      fetchSearches(1);
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Optimization failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await adminApiClient.patch(`/admin/discovery/searches/${id}/status`, { status: nextStatus });
      setSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s))
      );
      fetchStats();
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Failed to update status' });
    }
  };

  const handleRunSearch = async (id) => {
    setActionLoading(true);
    try {
      const res = await adminApiClient.post(`/admin/discovery/searches/${id}/run`, {});
      setAlertState({
        type: 'success',
        message: `Search executed successfully: ${res?.data?.resultsCount || 0} matching references identified.`,
      });
      fetchSearches(pagination.page);
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Search execution failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!intakeUrl) return;
    setIntakeSubmitting(true);
    setAlertState(null);
    try {
      const payload = {
        url: intakeUrl,
        title: intakeTitle,
        companyName: intakeCompany,
        location: intakeLocation,
        workArrangement: intakeArrangement,
        notes: intakeNotes,
      };
      const res = await adminApiClient.post('/admin/discovery/references', payload);
      setAlertState({
        type: res?.data?.isDuplicate ? 'warning' : 'success',
        message: res?.data?.message || 'Job reference processed',
      });
      setIntakeUrl('');
      setIntakeTitle('');
      setIntakeCompany('');
      setIntakeNotes('');
      setShowIntakeModal(false);
      fetchReferences();
      fetchStats();
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Intake failed' });
    } finally {
      setIntakeSubmitting(false);
    }
  };

  const handleReviewReference = async (id, action) => {
    setActionLoading(true);
    try {
      const res = await adminApiClient.post(`/admin/discovery/references/${id}/review`, { action });
      setAlertState({ type: 'success', message: res?.data?.message || `Reference ${action}ED` });
      fetchReferences();
      fetchStats();
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Review failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompany.name.trim()) return;
    setCompanySubmitting(true);
    setAlertState(null);
    try {
      await adminApiClient.post('/admin/discovery/companies', newCompany);
      setAlertState({ type: 'success', message: `Company '${newCompany.name}' registered to LinkedIn directory!` });
      setShowCompanyModal(false);
      setNewCompany({ name: '', industry: '', location: 'Ethiopia', linkedinUrl: '', notes: '' });
      fetchCompanies(1);
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Failed to register company' });
    } finally {
      setCompanySubmitting(false);
    }
  };

  const handleToggleCompanyStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await adminApiClient.patch(`/admin/discovery/companies/${id}/status`, { status: nextStatus });
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
      );
      setAlertState({ type: 'success', message: `Company status changed to ${nextStatus}` });
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Failed to update company status' });
    }
  };

  const handleDeleteCompany = async (id, name) => {
    if (!confirm(`Are you sure you want to delete '${name}' from tracked companies?`)) return;
    try {
      await adminApiClient.delete(`/admin/discovery/companies/${id}`);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setAlertState({ type: 'success', message: `Company '${name}' deleted successfully.` });
    } catch (err) {
      setAlertState({ type: 'error', message: err.message || 'Failed to delete company' });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">AI Discovery &amp; Coverage Engine</h2>
            <p className="text-sm text-slate-400 mt-1">
              Maximize job discovery across all 20 professional categories in Ethiopia and international remote opportunities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={handleRunAdaptiveOptimization}
              loading={actionLoading}
            >
              Adaptive Optimization
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowCompanyModal(true)}>
              + Track Company
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowIntakeModal(true)}>
              + Capture Job URL
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowPlanModal(true)}>
              + AI Search Planner
            </Button>
          </div>
        </div>

        {alertState && (
          <Alert
            type={alertState.type}
            message={alertState.message}
            onClose={() => setAlertState(null)}
          />
        )}

        {/* Telemetry Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Total Searches</span>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalSearches}</p>
              <span className="text-[11px] text-sky-400">{stats.activeSearches} active</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Coverage Health</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.coverageHealthPercentage}%</p>
              <span className="text-[11px] text-slate-400">{stats.coveredCategoriesCount} / {stats.categoriesCount} categories</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Weak Categories</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">{stats.weakCategoriesCount}</p>
              <span className="text-[11px] text-amber-500/80">needs AI expansion</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Total Yield</span>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalDiscovered.toLocaleString()}</p>
              <span className="text-[11px] text-emerald-400">+{stats.newJobsFound} new</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Duplicate Rate</span>
              <p className="text-2xl font-bold text-white mt-1">{stats.overallDuplicateRate}%</p>
              <span className="text-[11px] text-slate-400">{stats.duplicatesFound} filtered</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Pending Intake</span>
              <p className="text-2xl font-bold text-sky-400 mt-1">{stats.pendingIntakeReferences}</p>
              <span className="text-[11px] text-slate-400">awaiting review</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'registry' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Search Registry ({pagination.total})
            {activeTab === 'registry' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('gaps')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'gaps' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Category Coverage &amp; Gaps ({gaps.length})
            {activeTab === 'gaps' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('intake')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'intake' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            LinkedIn &amp; Intake Review ({references.length})
            {activeTab === 'intake' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'companies' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            LinkedIn Companies ({companiesPagination.total})
            {activeTab === 'companies' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer ${
              activeTab === 'compliance' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Compliance &amp; Boundaries
            {activeTab === 'compliance' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1: Search Registry */}
        {activeTab === 'registry' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
              <input
                type="text"
                placeholder="Search queries, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSearches(1)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-64"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="DISABLED">Disabled</option>
              </select>
              <Button variant="secondary" size="sm" onClick={() => fetchSearches(1)}>
                Filter
              </Button>
            </div>

            {/* Searches Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Search Query</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Yield (Total / New)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {searches.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          {loading ? 'Loading searches...' : 'No discovery searches found. Generate a plan with AI to begin.'}
                        </td>
                      </tr>
                    ) : (
                      searches.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">{s.queryText}</span>
                            {s.metadata?.linkedinSearchUrl && (
                              <div className="mt-0.5">
                                <a
                                  href={s.metadata.linkedinSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  LinkedIn Discovery Link &rarr;
                                </a>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700 text-slate-200">
                              {s.categorySlug}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-slate-300">{s.targetLocation || 'Ethiopia'}</span>
                            <span className="block text-[11px] text-slate-500">{s.workArrangement || 'ANY'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-bold text-amber-400">P{s.priority}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="text-white font-semibold">{s.totalResults}</span> total /{' '}
                            <span className="text-emerald-400 font-semibold">+{s.newJobsFound}</span> new
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleRunSearch(s.id)}
                              className="text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                            >
                              Run Now
                            </button>
                            <button
                              onClick={() => handleToggleStatus(s.id, s.status)}
                              className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
                            >
                              {s.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <div className="space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchSearches(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchSearches(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Coverage Gaps */}
        {activeTab === 'gaps' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gaps.map((gap) => (
                <div
                  key={gap.categorySlug}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-white text-base">{gap.categoryName}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          gap.status === 'ADEQUATE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : gap.status === 'MODERATE'
                            ? 'bg-sky-950 text-sky-400 border border-sky-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {gap.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-1 mt-3">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Coverage Score</span>
                        <span className="font-bold text-white">{gap.coverageScore}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            gap.coverageScore >= 60
                              ? 'bg-emerald-500'
                              : gap.coverageScore >= 30
                              ? 'bg-sky-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${gap.coverageScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 block">Active Queries</span>
                        <span className="font-bold text-white text-sm">{gap.activeSearchCount}</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 block">Catalog Jobs</span>
                        <span className="font-bold text-emerald-400 text-sm">{gap.totalDiscoveredCount}</span>
                      </div>
                    </div>

                    {gap.suggestedQueries && gap.suggestedQueries.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] text-slate-500 block mb-1">Targeted Suggestions:</span>
                        <ul className="text-xs text-slate-400 space-y-1">
                          {gap.suggestedQueries.slice(0, 2).map((sq, i) => (
                            <li key={i} className="truncate">• {sq}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LinkedIn & Intake Review */}
        {activeTab === 'intake' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div>
                <h3 className="font-bold text-white">Discovered Job Intake</h3>
                <p className="text-xs text-slate-400">
                  Review and accept manually discovered or alert-captured job postings from LinkedIn and direct employer portals.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowIntakeModal(true)}>
                + Register New URL
              </Button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Posting Details</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Captured</th>
                    <th className="py-3 px-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {references.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        No intake references currently pending review.
                      </td>
                    </tr>
                  ) : (
                    references.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{r.title || 'Untitled Opportunity'}</span>
                          <span className="text-xs text-slate-400">{r.companyName || 'Unknown Employer'}</span>
                          <a
                            href={r.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-sky-400 hover:underline block truncate max-w-sm mt-0.5"
                          >
                            {r.originalUrl} &rarr;
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 border border-slate-700 text-slate-300">
                            {r.sourceSlug}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs">{r.location || 'Addis Ababa'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              r.status === 'INGESTED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : r.status === 'REJECTED'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(r.capturedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {r.status === 'PENDING_REVIEW' && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleReviewReference(r.id, 'ACCEPT')}
                                loading={actionLoading}
                              >
                                Accept &amp; Ingest
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReviewReference(r.id, 'REJECT')}
                                loading={actionLoading}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {r.status === 'INGESTED' && (
                            <span className="text-xs text-emerald-400 font-medium">Ingested into Job Catalog</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LinkedIn Companies Directory */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Filter by company name, industry..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchCompanies(1)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-72"
                />
                <select
                  value={companyStatusFilter}
                  onChange={(e) => setCompanyStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="WATCHED">Watched</option>
                  <option value="PAUSED">Paused</option>
                </select>
                <Button variant="secondary" size="sm" onClick={() => fetchCompanies(1)}>
                  Filter
                </Button>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowCompanyModal(true)}>
                + Register New Company
              </Button>
            </div>

            {/* Companies Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">Industry / Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Jobs Found</th>
                      <th className="py-3 px-4">Last Discovered</th>
                      <th className="py-3 px-4">1-Click LinkedIn Search</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {companies.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">
                          {companiesLoading
                            ? 'Loading tracked LinkedIn companies...'
                            : 'No companies tracked yet. Register a company or capture a job posting to auto-track.'}
                        </td>
                      </tr>
                    ) : (
                      companies.map((comp) => (
                        <tr key={comp.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{comp.name}</div>
                            {comp.notes && (
                              <div className="text-xs text-slate-400 truncate max-w-xs">{comp.notes}</div>
                            )}
                            {comp.linkedinUrl && (
                              <a
                                href={comp.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-sky-400 hover:underline block mt-0.5"
                              >
                                LinkedIn Profile ↗
                              </a>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs font-medium text-slate-200">
                              {comp.industry || 'General Industry'}
                            </div>
                            <div className="text-xs text-slate-400">{comp.location || 'Ethiopia'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                comp.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : comp.status === 'WATCHED'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}
                            >
                              {comp.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold text-white">
                              {comp.jobCount || 0} jobs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400">
                            {comp.lastJobSeenAt
                              ? new Date(comp.lastJobSeenAt).toLocaleDateString()
                              : 'No jobs yet'}
                          </td>
                          <td className="py-3 px-4">
                            {comp.searchUrl ? (
                              <a
                                href={comp.searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-medium transition-colors"
                                title="Opens LinkedIn Job Search pre-filtered to the past 7 days (f_TPR=r604800)"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                </svg>
                                <span>Search Jobs (Past 7 Days) ↗</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">N/A</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleToggleCompanyStatus(comp.id, comp.status)}
                              className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
                            >
                              {comp.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteCompany(comp.id, comp.name)}
                              className="text-xs text-rose-400 hover:text-rose-300 transition-colors underline cursor-pointer ml-2"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {companiesPagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-800 text-xs text-slate-400">
                  <span>
                    Showing {companies.length} of {companiesPagination.total} tracked companies
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={companiesPagination.page <= 1}
                      onClick={() => fetchCompanies(companiesPagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="self-center px-2">
                      Page {companiesPagination.page} of {companiesPagination.totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={companiesPagination.page >= companiesPagination.totalPages}
                      onClick={() => fetchCompanies(companiesPagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Compliance & Boundaries */}
        {activeTab === 'compliance' && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Compliance Architecture &amp; Permitted Access Standards</h3>
            <p className="text-sm text-slate-300">
              The AI-Powered Discovery System operates under strict compliance boundaries regarding external platforms:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-emerald-400 font-semibold text-sm">Permitted Operations</span>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Direct ingestion via official APIs (Afriwork, HaHuJobs, Ethiojobs).</li>
                  <li>Automated search query generation &amp; verified discovery URL generation.</li>
                  <li>Admin intake portal for capturing, validating, and canonicalizing discovered URLs.</li>
                  <li>Automatic SHA256 URL hash deduplication and tracking parameter stripping.</li>
                  <li>Full preservation of original application URLs and source attribution.</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-rose-400 font-semibold text-sm">Strictly Prohibited &amp; Avoided</span>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>No unauthorized headless browser scraping of LinkedIn or session-token hijacking.</li>
                  <li>No proxy rotation or CAPTCHA circumvention.</li>
                  <li>No redistribution of copyrighted full descriptions without authorization.</li>
                  <li>No fabrication of missing salaries, locations, or application links.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Generate Plan */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-elevated">
              <h3 className="text-lg font-bold text-white">AI Search Plan Generator</h3>
              <p className="text-xs text-slate-400">
                Leverage Google Gemini AI to plan discovery queries across all 20 professional categories in Ethiopia.
              </p>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Max Queries Per Category
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    value={planMaxPerCat}
                    onChange={(e) => setPlanMaxPerCat(parseInt(e.target.value, 10) || 6)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remoteCheck"
                    checked={planIncludeRemote}
                    onChange={(e) => setPlanIncludeRemote(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="remoteCheck" className="text-xs text-slate-300">
                    Include International Remote queries open to Ethiopians
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="citiesCheck"
                    checked={planIncludeCities}
                    onChange={(e) => setPlanIncludeCities(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="citiesCheck" className="text-xs text-slate-300">
                    Include Regional Ethiopian Cities (Addis Ababa, Hawassa, Bahir Dar, etc.)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="dryRunCheck"
                    checked={planDryRun}
                    onChange={(e) => setPlanDryRun(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="dryRunCheck" className="text-xs text-slate-300 font-semibold text-amber-400">
                    Dry-Run Mode (Preview queries without saving)
                  </label>
                </div>
              </div>

              {planResult && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-h-48 overflow-y-auto text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-emerald-400 block mb-1">
                    Generated {planResult.totalGenerated} Queries:
                  </span>
                  {planResult.searches?.slice(0, 10).map((s, idx) => (
                    <div key={idx} className="truncate">• {s.queryText} ({s.categorySlug})</div>
                  ))}
                  {planResult.totalGenerated > 10 && (
                    <span className="text-slate-500 italic block">...and {planResult.totalGenerated - 10} more</span>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="secondary" size="md" onClick={() => setShowPlanModal(false)}>
                  Close
                </Button>
                <Button variant="primary" size="md" onClick={handleGeneratePlan} loading={planningLoading}>
                  {planDryRun ? 'Preview Search Plan' : 'Generate & Save Plan'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Register Intake URL */}
        {showIntakeModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-elevated">
              <h3 className="text-lg font-bold text-white">Capture Discovered Job URL</h3>
              <p className="text-xs text-slate-400">
                Register a job posting URL from LinkedIn or direct company portal for canonicalization and review.
              </p>

              <form onSubmit={handleIntakeSubmit} className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Job URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.linkedin.com/jobs/view/123456789"
                    value={intakeUrl}
                    onChange={(e) => setIntakeUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 placeholder-slate-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Accountant"
                      value={intakeTitle}
                      onChange={(e) => setIntakeTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Commercial Bank of Ethiopia"
                      value={intakeCompany}
                      onChange={(e) => setIntakeCompany(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Location</label>
                    <input
                      type="text"
                      value={intakeLocation}
                      onChange={(e) => setIntakeLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Work Arrangement</label>
                    <select
                      value={intakeArrangement}
                      onChange={(e) => setIntakeArrangement(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100"
                    >
                      <option value="ON_SITE">On-site</option>
                      <option value="HYBRID">Hybrid</option>
                      <option value="REMOTE">Remote</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Notes / Context</label>
                  <textarea
                    rows={2}
                    placeholder="Discovered via LinkedIn search for IT vacancies in Addis Ababa"
                    value={intakeNotes}
                    onChange={(e) => setIntakeNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <Button variant="secondary" size="md" type="button" onClick={() => setShowIntakeModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit" loading={intakeSubmitting}>
                    Register Reference
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Register New Tracked Company */}
        {showCompanyModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-elevated">
              <h3 className="text-lg font-bold text-white">Track Company on LinkedIn</h3>
              <p className="text-xs text-slate-400">
                Register an Ethiopian or international employer to generate pre-filtered 7-day job discovery queries and track hiring trends.
              </p>

              <form onSubmit={handleCreateCompany} className="space-y-3 text-sm">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Safaricom Ethiopia, Commercial Bank of Ethiopia, Ethio Telecom"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Industry</label>
                    <input
                      type="text"
                      placeholder="e.g. Telecommunications, Banking"
                      value={newCompany.industry}
                      onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Ethiopia, Addis Ababa"
                      value={newCompany.location}
                      onChange={(e) => setNewCompany({ ...newCompany, location: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">LinkedIn Profile / Company URL</label>
                  <input
                    type="url"
                    placeholder="https://www.linkedin.com/company/safaricom-ethiopia"
                    value={newCompany.linkedinUrl}
                    onChange={(e) => setNewCompany({ ...newCompany, linkedinUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Frequent hiring in software, network engineering, and finance."
                    value={newCompany.notes}
                    onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <Button variant="secondary" size="md" type="button" onClick={() => setShowCompanyModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="md" type="submit" loading={companySubmitting}>
                    Save Company
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

