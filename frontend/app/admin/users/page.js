'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState('');

  // Modals & Action states
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'ROLE' | 'STATUS', user, newRole, newStatus }
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });

      if (search.trim()) params.append('search', search.trim());
      if (role) params.append('role', role);
      if (isActive) params.append('isActive', isActive);
      if (isEmailVerified) params.append('isEmailVerified', isEmailVerified);

      const res = await apiClient.get(`/admin/users?${params.toString()}`);
      setUsers(res?.data?.users || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, role, isActive, isEmailVerified]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const executeUserAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    setActionError(null);

    try {
      if (actionModal.type === 'ROLE') {
        await apiClient.patch(`/admin/users/${actionModal.user.id}/role`, {
          role: actionModal.newRole,
        });
      } else if (actionModal.type === 'STATUS') {
        await apiClient.patch(`/admin/users/${actionModal.user.id}/status`, {
          isActive: actionModal.newStatus,
        });
      }

      setActionModal(null);
      fetchUsers();
    } catch (err) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stormy-main tracking-tight">User Account Management</h2>
          <p className="text-sm text-stormy-muted">
            Manage roles, view verification status, and audit active user sessions ({total} registered).
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 text-sm bg-white border border-stormy-border rounded-lg shadow-subtle focus:outline-none focus:ring-2 focus:ring-stormy-sky w-full sm:w-64"
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
      <div className="p-4 bg-white rounded-xl border border-stormy-border shadow-subtle grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Filter by Role</label>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="EMPLOYER">EMPLOYER</option>
            <option value="CANDIDATE">CANDIDATE</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Account Status</label>
          <select
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Accounts</option>
            <option value="true">Active Only</option>
            <option value="false">Disabled / Suspended</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-stormy-muted mb-1">Email Verification</label>
          <select
            value={isEmailVerified}
            onChange={(e) => { setIsEmailVerified(e.target.value); setPage(1); }}
            className="w-full p-2 bg-stormy-canvas border border-stormy-border rounded-lg text-stormy-main"
          >
            <option value="">All Verification States</option>
            <option value="true">Verified Only</option>
            <option value="false">Unverified</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-stormy-border shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stormy-canvas text-stormy-muted border-b border-stormy-border uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">User Details</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Account State</th>
                <th className="py-3 px-4 font-semibold">Email Verified</th>
                <th className="py-3 px-4 font-semibold">Sessions</th>
                <th className="py-3 px-4 font-semibold">Registered</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stormy-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stormy-muted">
                    <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
                    Loading user accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stormy-muted">
                    No user accounts match the criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = currentAdmin?.userId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-stormy-canvas/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-stormy-dark text-stormy-sky font-bold flex items-center justify-center text-[11px] shrink-0">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stormy-main truncate">
                              {u.email} {isSelf && <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded ml-1">(You)</span>}
                            </p>
                            <p className="text-[11px] text-stormy-muted truncate">
                              {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'No display name'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'EMPLOYER'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-stormy-slate/20 text-stormy-muted'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {u.isEmailVerified ? (
                          <span className="inline-flex items-center text-emerald-700 font-medium text-[11px]">
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="text-stormy-muted text-[11px]">Unverified</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-stormy-muted">
                        <span className="font-medium text-stormy-dark">{u._count?.refreshSessions ?? 0}</span>
                      </td>

                      <td className="py-3 px-4 text-stormy-muted font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded border border-stormy-border"
                        >
                          View
                        </button>

                        <button
                          onClick={() =>
                            setActionModal({
                              type: 'ROLE',
                              user: u,
                              newRole: u.role === 'ADMIN' ? 'EMPLOYER' : 'ADMIN',
                            })
                          }
                          disabled={isSelf}
                          className="px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 disabled:opacity-40"
                          title={isSelf ? 'Cannot modify your own administrative role' : 'Change role'}
                        >
                          Change Role
                        </button>

                        <button
                          onClick={() =>
                            setActionModal({
                              type: 'STATUS',
                              user: u,
                              newStatus: !u.isActive,
                            })
                          }
                          disabled={isSelf}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded border disabled:opacity-40 ${
                            u.isActive
                              ? 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                          title={isSelf ? 'Cannot deactivate your own account' : 'Toggle status'}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
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
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total users)
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

      {/* Role / Status Action Modal with Safeguard Warnings */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-elevated space-y-4">
            <h3 className="text-base font-bold text-stormy-main">
              {actionModal.type === 'ROLE' ? 'Update User Role' : 'Confirm Account Status Change'}
            </h3>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                {actionError}
              </div>
            )}

            {actionModal.type === 'ROLE' ? (
              <div className="space-y-3 text-xs">
                <p className="text-stormy-muted">
                  Change role for <strong>{actionModal.user.email}</strong>:
                </p>
                <select
                  value={actionModal.newRole}
                  onChange={(e) => setActionModal({ ...actionModal, newRole: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main font-semibold"
                >
                  <option value="CANDIDATE">CANDIDATE</option>
                  <option value="EMPLOYER">EMPLOYER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <p className="text-[11px] text-stormy-slate">
                  Server safeguards prevent demoting yourself or removing the last administrator in the system.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-stormy-muted">
                <p>
                  Are you sure you want to {actionModal.newStatus ? 'reactivate' : 'deactivate'} account{' '}
                  <strong>{actionModal.user.email}</strong>?
                </p>
                {!actionModal.newStatus && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                    Deactivating this account will automatically revoke all active authentication sessions.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stormy-border">
              <button
                onClick={() => setActionModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={executeUserAction}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-stormy-border pb-3">
              <h3 className="text-base font-bold text-stormy-main">User Account Profile</h3>
              <button onClick={() => setSelectedUser(null)} className="text-stormy-muted hover:text-stormy-main">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-stormy-muted uppercase font-bold block">Email Address</span>
                <span className="font-semibold text-stormy-main text-sm">{selectedUser.email}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-stormy-muted uppercase font-bold block">Assigned Role</span>
                  <span className="font-semibold text-stormy-dark">{selectedUser.role}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stormy-muted uppercase font-bold block">Account Status</span>
                  <span className="font-semibold text-stormy-dark">{selectedUser.isActive ? 'Active' : 'Disabled'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-stormy-muted uppercase font-bold block">Registered Date</span>
                  <span className="text-stormy-dark">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stormy-muted uppercase font-bold block">Active Sessions</span>
                  <span className="text-stormy-dark">{selectedUser._count?.refreshSessions ?? 0}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-stormy-muted uppercase font-bold block">Last Activity / Login</span>
                <span className="text-stormy-dark">
                  {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'No recorded login'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-stormy-border flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-xs font-semibold text-stormy-dark bg-stormy-canvas hover:bg-stormy-mist/40 rounded-lg border border-stormy-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
