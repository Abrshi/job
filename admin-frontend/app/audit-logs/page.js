'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiClient.get(`/admin/audit-logs?page=${targetPage}&limit=20`);
      setLogs(res?.data?.logs || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
      setPage(res?.data?.page || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  const toggleExpand = (id) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Administrative Audit Logs</h2>
            <p className="text-sm text-slate-400 mt-1">
              Immutable history of sensitive administrative actions, role assignments, and configuration changes ({total} total events).
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchLogs(page)} loading={loading}>
            Refresh Audit Logs
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* Audit Logs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-4">Timestamp</th>
                  <th className="px-5 py-4">Administrator</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Target Type & ID</th>
                  <th className="px-5 py-4">IP Address</th>
                  <th className="px-5 py-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <svg className="w-5 h-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Querying tamper-evident audit trail...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No administrative audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-white text-xs">{log.adminEmail || log.adminId}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-sky-950 text-sky-400 border border-sky-800">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-300">
                            <div className="font-medium text-slate-200">{log.targetType}</div>
                            {log.targetId && (
                              <div className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                                {log.targetId}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-slate-400">
                            {log.ipAddress || '—'}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {log.details ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(log.id)}
                                className="text-xs text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                              >
                                {isExpanded ? 'Hide' : 'Inspect'}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && log.details && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={6} className="px-8 py-3">
                              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">{totalPages}</span> ({total} events)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
