'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

export default function AdminUsersPage() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'activity'

  // Users state
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'CANDIDATE',
    isActive: true,
  });
  const [createLoading, setCreateLoading] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const [dossierUser, setDossierUser] = useState(null);
  const [dossierData, setDossierData] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierTab, setDossierTab] = useState('applications'); // 'applications' | 'saved' | 'documents' | 'searches'

  // Global Activity Stream state
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Load users
  const fetchUsers = async (targetPage = page) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: targetPage.toString(),
        limit: '20',
      });
      if (roleFilter) query.set('role', roleFilter);
      if (search.trim()) query.set('search', search.trim());

      const res = await adminApiClient.get(`/admin/users?${query.toString()}`);
      setUsers(res?.data?.users || []);
      setTotal(res?.data?.total || 0);
      setTotalPages(res?.data?.totalPages || 1);
      setPage(res?.data?.page || 1);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load global activity stream
  const fetchGlobalActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await adminApiClient.get('/admin/activity?limit=50');
      setActivities(res?.data?.activities || []);
    } catch (err) {
      console.error('Failed to load platform activities:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(1);
    } else {
      fetchGlobalActivity();
    }
  }, [activeTab, roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  // Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await adminApiClient.post('/admin/users', createFormData);
      setIsCreateModalOpen(false);
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'CANDIDATE',
        isActive: true,
      });
      fetchUsers(1);
    } catch (err) {
      alert(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // Open Edit User
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'CANDIDATE',
      isActive: user.isActive !== undefined ? user.isActive : true,
      password: '',
    });
  };

  // Save Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    try {
      const payload = {
        firstName: editFormData.firstName || null,
        lastName: editFormData.lastName || null,
        email: editFormData.email,
        role: editFormData.role,
        isActive: editFormData.isActive,
      };
      if (editFormData.password && editFormData.password.trim()) {
        payload.password = editFormData.password.trim();
      }

      await adminApiClient.patch(`/admin/users/${editingUser.id}`, payload);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (user) => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    if (!confirm(`Are you sure you want to permanently delete user account "${fullName}" (${user.email})?`)) {
      return;
    }
    try {
      await adminApiClient.delete(`/admin/users/${user.id}`);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  // Quick Role Change
  const handleRoleChange = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      await adminApiClient.patch(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user role');
    }
  };

  // Quick Status Toggle
  const handleStatusToggle = async (user) => {
    const newStatus = user.isActive ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Change user account status to ${newStatus}?`)) return;
    try {
      await adminApiClient.patch(`/admin/users/${user.id}/status`, { status: newStatus });
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    }
  };

  // Open User Activity Dossier
  const openDossier = async (user) => {
    setDossierUser(user);
    setDossierData(null);
    setDossierLoading(true);
    setDossierTab('applications');
    try {
      const res = await adminApiClient.get(`/admin/users/${user.id}/activity`);
      setDossierData(res?.data || null);
    } catch (err) {
      alert(err.message || 'Failed to load user activity dossier');
    } finally {
      setDossierLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">User Governance & Activities</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage platform accounts, inspect user engagement dossiers, and monitor live user activity events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="font-bold"
            >
              + Create User
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (activeTab === 'users' ? fetchUsers() : fetchGlobalActivity())}
              loading={loading || activityLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Registered Users ({total.toLocaleString()})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Platform Activity Stream
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: USERS LIST & GOVERNANCE                                */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-card">
              <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-400"
                  >
                    <option value="">All Roles</option>
                    <option value="CANDIDATE">CANDIDATE (Seeker)</option>
                    <option value="EMPLOYER">EMPLOYER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>

                  <Button type="submit" variant="primary" size="md">
                    Search
                  </Button>
                </div>
              </form>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-4 py-4">Role</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Activity Stats</th>
                      <th className="px-4 py-4">Registered</th>
                      <th className="px-6 py-4 text-right">Actions</th>
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
                            <span>Loading user accounts...</span>
                          </div>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          No users found matching current criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed User';
                        const isActive = u.isActive !== undefined ? u.isActive : true;

                        return (
                          <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{fullName}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{u.email}</div>
                              {u.profile?.city && (
                                <div className="text-[11px] text-slate-500">
                                  {[u.profile.city, u.profile.country].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                  u.role === 'ADMIN'
                                    ? 'bg-sky-950 text-sky-400 border border-sky-800'
                                    : u.role === 'EMPLOYER'
                                    ? 'bg-purple-950 text-purple-400 border border-purple-800'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                                  isActive
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                                }`}
                              >
                                {isActive ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs text-slate-400">
                              <div className="flex items-center gap-2 text-[11px]">
                                <span title="Applications submitted" className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800">
                                  📝 {u._count?.applications || 0}
                                </span>
                                <span title="Saved jobs" className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800">
                                  ⭐ {u._count?.savedJobs || 0}
                                </span>
                                <span title="Uploaded documents" className="px-1.5 py-0.5 bg-slate-950 rounded border border-slate-800">
                                  📄 {u._count?.documents || 0}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-slate-400">
                              <div>{new Date(u.createdAt).toLocaleDateString()}</div>
                              {u.lastLoginAt && (
                                <div className="text-[10px] text-slate-500">
                                  Last: {new Date(u.lastLoginAt).toLocaleDateString()}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDossier(u)}
                                className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
                                title="Inspect user activities, applications, documents"
                              >
                                Activity
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEditModal(u)}
                                className="text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusToggle(u)}
                                className={`text-xs ${isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                              >
                                {isActive ? 'Suspend' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(u)}
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

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
                <div>
                  Showing page <span className="font-semibold text-slate-200">{page}</span> of{' '}
                  <span className="font-semibold text-slate-200">{totalPages}</span> ({total} accounts)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => fetchUsers(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => fetchUsers(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: GLOBAL ACTIVITY STREAM                                 */}
        {/* ============================================================== */}
        {activeTab === 'activity' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-card space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Live Platform Activity Stream</h3>
              <p className="text-xs text-slate-400 mt-1">
                Real-time chronological events across user registrations, job applications, and resume uploads.
              </p>
            </div>

            {activityLoading ? (
              <div className="py-12 text-center text-slate-500">
                <div className="inline-flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Loading recent activity events...</span>
                </div>
              </div>
            ) : activities.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No recent activity events recorded on this environment yet.
              </div>
            ) : (
              <div className="relative border-l border-slate-800 ml-4 space-y-6">
                {activities.map((ev) => (
                  <div key={ev.id} className="relative pl-6">
                    {/* Bullet marker */}
                    <span
                      className={`absolute -left-2.5 top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                        ev.type === 'JOB_APPLICATION'
                          ? 'bg-sky-950 border-sky-600 text-sky-400'
                          : ev.type === 'USER_REGISTERED'
                          ? 'bg-emerald-950 border-emerald-600 text-emerald-400'
                          : 'bg-purple-950 border-purple-600 text-purple-400'
                      }`}
                    >
                      {ev.type === 'JOB_APPLICATION' ? '📝' : ev.type === 'USER_REGISTERED' ? '👤' : '📄'}
                    </span>

                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="font-semibold text-white text-sm">{ev.title}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(ev.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{ev.subtitle}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-slate-300 font-medium">User: {ev.user?.name || ev.user?.email}</span>
                        <span className="text-slate-500 font-mono text-[11px]">({ev.user?.email})</span>
                        {ev.status && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-900 text-slate-300 border border-slate-700">
                            {ev.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: CREATE USER                                            */}
        {/* ============================================================== */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Create New User Account</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                    <input
                      type="text"
                      value={createFormData.firstName}
                      onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={createFormData.lastName}
                      onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Role</label>
                    <select
                      value={createFormData.role}
                      onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="CANDIDATE">CANDIDATE (Seeker)</option>
                      <option value="EMPLOYER">EMPLOYER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Account State</label>
                    <select
                      value={createFormData.isActive ? 'true' : 'false'}
                      onChange={(e) => setCreateFormData({ ...createFormData, isActive: e.target.value === 'true' })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="true">Active</option>
                      <option value="false">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={createLoading}>
                    Create Account
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: EDIT USER                                              */}
        {/* ============================================================== */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white">Edit User Account</h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                    <input
                      type="text"
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                    <select
                      value={editFormData.role}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="CANDIDATE">CANDIDATE (Seeker)</option>
                      <option value="EMPLOYER">EMPLOYER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                    <select
                      value={editFormData.isActive ? 'true' : 'false'}
                      onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'true' })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="true">Active</option>
                      <option value="false">Suspended</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    New Password <span className="text-slate-500 font-normal">(leave blank to keep unchanged)</span>
                  </label>
                  <input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Leave empty to preserve existing password"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={editLoading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: USER ACTIVITY DOSSIER                                   */}
        {/* ============================================================== */}
        {dossierUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">
                      {[dossierUser.firstName, dossierUser.lastName].filter(Boolean).join(' ') || 'User Activity'}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-sky-950 text-sky-400 border border-sky-800">
                      {dossierUser.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {dossierUser.email} • ID: <span className="font-mono text-slate-500">{dossierUser.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDossierUser(null)}
                  className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {dossierLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <svg className="w-5 h-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Compiling user activity dossier...</span>
                  </div>
                </div>
              ) : dossierData ? (
                <div className="space-y-6">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-xs text-slate-500 block">Applications</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        {dossierData.activitySummary?.totalApplications || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-xs text-slate-500 block">Saved Jobs</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        {dossierData.activitySummary?.totalSavedJobs || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-xs text-slate-500 block">Documents (CVs)</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        {dossierData.activitySummary?.totalDocuments || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                      <span className="text-xs text-slate-500 block">Saved Searches</span>
                      <span className="text-xl font-bold text-white mt-1 block">
                        {dossierData.activitySummary?.totalSavedSearches || 0}
                      </span>
                    </div>
                  </div>

                  {/* Subtabs */}
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setDossierTab('applications')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        dossierTab === 'applications'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Applications ({dossierData.applications?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierTab('saved')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        dossierTab === 'saved'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Saved Jobs ({dossierData.savedJobs?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierTab('documents')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        dossierTab === 'documents'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Uploaded Documents ({dossierData.documents?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDossierTab('searches')}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        dossierTab === 'searches'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Search Alerts ({dossierData.savedSearches?.length || 0})
                    </button>
                  </div>

                  {/* Subtab Content: Applications */}
                  {dossierTab === 'applications' && (
                    <div className="space-y-3">
                      {dossierData.applications?.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">No applications recorded for this user.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                              <tr>
                                <th className="px-3 py-2">Job Title</th>
                                <th className="px-3 py-2">Company</th>
                                <th className="px-3 py-2">Applied Date</th>
                                <th className="px-3 py-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {dossierData.applications.map((app) => (
                                <tr key={app.id}>
                                  <td className="px-3 py-2 font-semibold text-white">
                                    {app.job?.normalizedTitle || 'Application'}
                                  </td>
                                  <td className="px-3 py-2">{app.job?.companyName || 'N/A'}</td>
                                  <td className="px-3 py-2 text-slate-400">{new Date(app.appliedAt).toLocaleDateString()}</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                                      {app.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtab Content: Saved Jobs */}
                  {dossierTab === 'saved' && (
                    <div className="space-y-3">
                      {dossierData.savedJobs?.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">No saved jobs.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                              <tr>
                                <th className="px-3 py-2">Job Title</th>
                                <th className="px-3 py-2">Company</th>
                                <th className="px-3 py-2 text-right">Saved Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {dossierData.savedJobs.map((sj) => (
                                <tr key={sj.id}>
                                  <td className="px-3 py-2 font-semibold text-white">
                                    {sj.job?.normalizedTitle || 'Saved Job'}
                                  </td>
                                  <td className="px-3 py-2">{sj.job?.companyName || 'N/A'}</td>
                                  <td className="px-3 py-2 text-right text-slate-400">
                                    {new Date(sj.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtab Content: Documents */}
                  {dossierTab === 'documents' && (
                    <div className="space-y-3">
                      {dossierData.documents?.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">No documents uploaded.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                              <tr>
                                <th className="px-3 py-2">File Name</th>
                                <th className="px-3 py-2">Size</th>
                                <th className="px-3 py-2">Processing</th>
                                <th className="px-3 py-2 text-right">Uploaded</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {dossierData.documents.map((doc) => (
                                <tr key={doc.id}>
                                  <td className="px-3 py-2 font-mono text-white">{doc.originalFilename}</td>
                                  <td className="px-3 py-2 text-slate-400">
                                    {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                                      {doc.processingStatus}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-400">
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtab Content: Searches */}
                  {dossierTab === 'searches' && (
                    <div className="space-y-3">
                      {dossierData.savedSearches?.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">No saved search alerts configured.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                              <tr>
                                <th className="px-3 py-2">Search Name</th>
                                <th className="px-3 py-2">Keywords / Location</th>
                                <th className="px-3 py-2">Frequency</th>
                                <th className="px-3 py-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {dossierData.savedSearches.map((s) => (
                                <tr key={s.id}>
                                  <td className="px-3 py-2 font-semibold text-white">{s.name}</td>
                                  <td className="px-3 py-2 text-slate-400">
                                    {[s.keywords, s.location].filter(Boolean).join(' in ') || 'All'}
                                  </td>
                                  <td className="px-3 py-2 text-slate-400 uppercase">{s.frequency}</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                                      {s.isActive ? 'Active' : 'Paused'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Footer */}
              <div className="flex items-center justify-end pt-4 border-t border-slate-800">
                <Button variant="secondary" size="sm" onClick={() => setDossierUser(null)}>
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
