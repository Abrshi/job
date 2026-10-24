'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/admin/audit-logs?page=${page}&limit=20`);
      setLogs(res?.data?.logs || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-stormy-main tracking-tight">Administrative Audit Logs</h2>
        <p className="text-sm text-stormy-muted">
          Immutable history of sensitive administrative actions, role modifications, and configuration changes ({total} recorded events).
        </p>
      </div>

      {error && (
        <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Administrator</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Target</th>
                <th className="py-3 px-4 font-semibold">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stormy-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stormy-muted">
                    <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stormy-muted">
                    No administrative audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-stormy-canvas/40 transition-colors">
                    <td className="py-3 px-4 text-stormy-muted font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stormy-main">
                      {log.adminEmail}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stormy-canvas border border-stormy-border text-stormy-dark">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-stormy-muted font-medium">
                        {log.targetType} {log.targetId ? `(${log.targetId.slice(0, 8)}...)` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stormy-dark font-mono text-[10px] max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-stormy-canvas border-t border-stormy-border flex items-center justify-between text-xs text-stormy-muted">
          <span>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total logs)
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
    </div>
  );
}
