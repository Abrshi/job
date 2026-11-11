'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function TelegramDashboardPage() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' | 'messages' | 'deliveries' | 'publisher' | 'diagnostics'
  
  // Data States
  const [globalStatus, setGlobalStatus] = useState(null);
  const [channels, setChannels] = useState([]);
  const [channelsTotal, setChannelsTotal] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesTotal, setDeliveriesTotal] = useState(0);
  const [publisherStats, setPublisherStats] = useState(null);

  // Loading States
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters & Pagination
  const [channelSearch, setChannelSearch] = useState('');
  const [channelStatusFilter, setChannelStatusFilter] = useState('all');
  const [messageChannelFilter, setMessageChannelFilter] = useState('');
  const [messageStatusFilter, setMessageStatusFilter] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messagePage, setMessagePage] = useState(1);

  // Alerts & Notifications
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }

  // Modals State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [verifyingChannel, setVerifyingChannel] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [confirmToggleWorkerModal, setConfirmToggleWorkerModal] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [deletingChannel, setDeletingChannel] = useState(false);

  // Channel Registration Form State
  const [registerForm, setRegisterForm] = useState({
    identifier: '',
    title: '',
    telegramChannelId: '',
    authorizationRecord: '',
    explicitConsentConfirmation: false,
    isActive: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // =========================================================================
  // API Fetchers
  // =========================================================================

  const fetchGlobalStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await adminApiClient.get('/admin/telegram/status');
      setGlobalStatus(res?.data || null);
    } catch (err) {
      console.error('Failed to load global Telegram status:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const query = new URLSearchParams();
      if (channelSearch.trim()) query.set('search', channelSearch.trim());
      if (channelStatusFilter !== 'all') query.set('status', channelStatusFilter);
      query.set('limit', '100');

      const res = await adminApiClient.get(`/admin/telegram/channels?${query.toString()}`);
      setChannels(res?.data?.channels || []);
      setChannelsTotal(res?.data?.total || 0);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, [channelSearch, channelStatusFilter]);

  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const query = new URLSearchParams();
      if (messageChannelFilter) query.set('channelId', messageChannelFilter);
      if (messageStatusFilter) query.set('status', messageStatusFilter);
      if (messageSearch.trim()) query.set('search', messageSearch.trim());
      query.set('page', String(messagePage));
      query.set('limit', '30');

      const res = await adminApiClient.get(`/admin/telegram/messages?${query.toString()}`);
      setMessages(res?.data?.messages || []);
      setMessagesTotal(res?.data?.total || 0);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [messageChannelFilter, messageStatusFilter, messageSearch, messagePage]);

  const fetchDeliveries = useCallback(async () => {
    setLoadingDeliveries(true);
    try {
      const res = await adminApiClient.get('/admin/telegram/deliveries?limit=50');
      setDeliveries(res?.data?.failedDeliveries || []);
      setDeliveriesTotal(res?.data?.totalFailed || 0);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, []);

  const fetchPublisherStats = useCallback(async () => {
    try {
      const res = await adminApiClient.get('/admin/telegram/stats');
      setPublisherStats(res?.data || null);
    } catch (err) {
      console.error('Failed to load publisher stats:', err);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchGlobalStatus();
    fetchChannels();
    fetchPublisherStats();
  }, [fetchGlobalStatus, fetchChannels, fetchPublisherStats]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'messages') fetchMessages();
    if (activeTab === 'deliveries') fetchDeliveries();
  }, [activeTab, fetchMessages, fetchDeliveries]);

  // =========================================================================
  // Actions
  // =========================================================================

  const handleSyncWorker = async () => {
    setActionLoadingId('sync');
    setNotice(null);
    try {
      await adminApiClient.post('/admin/telegram/channels/sync');
      setNotice({ type: 'success', message: 'Signal sent! Worker synchronized channel configurations.' });
      await fetchGlobalStatus();
      await fetchChannels();
    } catch (err) {
      setNotice({ type: 'error', message: `Sync failed: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleWorker = async () => {
    if (!globalStatus) return;
    const currentListening = globalStatus.worker?.isListening;
    setActionLoadingId('toggle-worker');
    setNotice(null);
    try {
      await adminApiClient.post('/admin/telegram/worker/toggle', {
        active: !currentListening,
        confirmation: true,
      });
      setNotice({
        type: 'success',
        message: currentListening ? 'Worker listening paused.' : 'Worker listening resumed.',
      });
      setConfirmToggleWorkerModal(false);
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Failed to toggle worker: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleActivateChannel = async (id, title) => {
    setActionLoadingId(id);
    try {
      await adminApiClient.post(`/admin/telegram/channels/${id}/activate`);
      setNotice({ type: 'success', message: `Channel '${title}' activated for listening.` });
      await fetchChannels();
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Failed to activate: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePauseChannel = async (id, title) => {
    setActionLoadingId(id);
    try {
      await adminApiClient.post(`/admin/telegram/channels/${id}/pause`);
      setNotice({ type: 'success', message: `Channel '${title}' paused.` });
      await fetchChannels();
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Failed to pause: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeactivateChannel = async (id, title) => {
    if (!confirm(`Are you sure you want to deactivate and revoke authorization for channel "${title}"?`)) {
      return;
    }
    setActionLoadingId(id);
    try {
      await adminApiClient.post(`/admin/telegram/channels/${id}/deactivate`);
      setNotice({ type: 'success', message: `Channel '${title}' deactivated.` });
      await fetchChannels();
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Failed to deactivate: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = (channel) => {
    setChannelToDelete(channel);
  };

  const handleExecuteDelete = async () => {
    if (!channelToDelete) return;
    setDeletingChannel(true);
    setActionLoadingId(`delete-${channelToDelete.id}`);
    try {
      await adminApiClient.delete(`/admin/telegram/channels/${channelToDelete.id}`);
      setNotice({ type: 'success', message: `Channel '${channelToDelete.title}' deleted successfully.` });
      setChannelToDelete(null);
      await fetchChannels();
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Failed to delete channel: ${err.message}` });
    } finally {
      setDeletingChannel(false);
      setActionLoadingId(null);
    }
  };

  const handleVerifyChannel = async (channel) => {
    setVerifyingChannel(channel);
    setVerificationResult(null);
    setActionLoadingId(`verify-${channel.id}`);
    try {
      const res = await adminApiClient.post(`/admin/telegram/channels/${channel.id}/verify`);
      setVerificationResult(res?.data || null);
    } catch (err) {
      setVerificationResult({ accessible: false, message: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetryDelivery = async (id) => {
    setActionLoadingId(`retry-${id}`);
    try {
      await adminApiClient.post(`/admin/telegram/deliveries/${id}/retry`);
      setNotice({ type: 'success', message: 'Delivery re-queued for processing.' });
      await fetchDeliveries();
      await fetchGlobalStatus();
    } catch (err) {
      setNotice({ type: 'error', message: `Retry failed: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRegisterModal = () => {
    setRegisterForm({
      identifier: '',
      title: '',
      telegramChannelId: '',
      authorizationRecord: '',
      explicitConsentConfirmation: false,
      isActive: true,
    });
    setFormError(null);
    setEditingChannel(null);
    setShowRegisterModal(true);
  };

  const handleOpenEditModal = (channel) => {
    setEditingChannel(channel);
    setRegisterForm({
      identifier: channel.username ? `@${channel.username}` : channel.telegramChannelId,
      title: channel.title,
      telegramChannelId: channel.telegramChannelId,
      authorizationRecord: channel.authorizationRecord || '',
      explicitConsentConfirmation: true,
      isActive: channel.isActive,
    });
    setFormError(null);
    setShowRegisterModal(true);
  };

  const handleSubmitChannelForm = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!registerForm.explicitConsentConfirmation && !editingChannel) {
      setFormError('You must explicitly certify that the channel owner has authorized ingestion.');
      return;
    }

    if (!registerForm.authorizationRecord || registerForm.authorizationRecord.trim().length < 10) {
      setFormError('Authorization reference evidence must be at least 10 characters (e.g. written agreement ref, contract ID).');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingChannel) {
        await adminApiClient.patch(`/admin/telegram/channels/${editingChannel.id}`, {
          title: registerForm.title,
          username: registerForm.identifier.replace(/^@/, '').trim(),
          authorizationRecord: registerForm.authorizationRecord,
          isActive: registerForm.isActive,
        });
        setNotice({ type: 'success', message: `Channel '${registerForm.title}' updated successfully.` });
      } else {
        await adminApiClient.post('/admin/telegram/channels', {
          identifier: registerForm.identifier.trim(),
          title: registerForm.title.trim() || undefined,
          telegramChannelId: registerForm.telegramChannelId.trim() || undefined,
          authorizationRecord: registerForm.authorizationRecord.trim(),
          explicitConsentConfirmation: registerForm.explicitConsentConfirmation,
          isActive: registerForm.isActive,
        });
        setNotice({ type: 'success', message: 'Authorized Telegram channel registered and synced with worker.' });
      }

      setShowRegisterModal(false);
      await fetchChannels();
      await fetchGlobalStatus();
    } catch (err) {
      setFormError(err.message || 'Failed to save channel');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Helper formatting
  const formatTime = (iso) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'Offline';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* =================================================================== */}
        {/* TOP COMMAND CENTER HEADER & TELEMETRY                                */}
        {/* =================================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                    Telegram Ingestion Command Center
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      Independent Service
                    </span>
                  </h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Real-time GramJS MTProto worker, authorized channel registry, and lossless job aggregation.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchGlobalStatus}
                loading={loadingStatus}
                className="text-slate-300"
              >
                Refresh Telemetry
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSyncWorker}
                loading={actionLoadingId === 'sync'}
                className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
              >
                Sync Worker Channels
              </Button>

              {globalStatus?.worker?.isOnline && (
                <Button
                  variant={globalStatus.worker.isListening ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => setConfirmToggleWorkerModal(true)}
                >
                  {globalStatus.worker.isListening ? 'Pause Worker' : 'Resume Worker'}
                </Button>
              )}

              <Button variant="primary" size="sm" onClick={handleOpenRegisterModal}>
                + Register Channel
              </Button>
            </div>
          </div>

          {/* Telemetry Status Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-slate-800/80">
            {/* Status 1: Worker State */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Worker Engine</span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    globalStatus?.worker?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-sm font-bold text-white capitalize">
                  {globalStatus?.worker?.status || (loadingStatus ? 'Checking...' : 'Offline')}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Uptime: {formatUptime(globalStatus?.worker?.uptimeSeconds)}
              </span>
            </div>

            {/* Status 2: MTProto Session */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Telegram Session</span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    globalStatus?.worker?.connectedToTelegram ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-sm font-bold text-white">
                  {globalStatus?.worker?.connectedToTelegram ? 'Authorized' : 'Disconnected'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                GramJS MTProto Protocol
              </span>
            </div>

            {/* Status 3: Channels Count */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Active Channels</span>
              <div className="text-lg font-bold text-sky-400 mt-0.5">
                {globalStatus?.telemetry?.channels?.active ?? 0}
                <span className="text-xs text-slate-400 font-normal">
                  {' '}/ {globalStatus?.telemetry?.channels?.total ?? 0}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block">
                {globalStatus?.telemetry?.channels?.paused ?? 0} paused / standby
              </span>
            </div>

            {/* Status 4: Ingested Messages */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Total Received</span>
              <div className="text-lg font-bold text-purple-400 mt-0.5">
                {globalStatus?.telemetry?.messages?.total ?? 0}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {globalStatus?.telemetry?.messages?.processed ?? 0} processed
              </span>
            </div>

            {/* Status 5: Duplicate Posts Filtered */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Duplicates Filtered</span>
              <div className="text-lg font-bold text-cyan-400 mt-0.5">
                {globalStatus?.telemetry?.messages?.duplicate ?? 0}
              </div>
              <span className="text-[10px] text-slate-500 block">Idempotent fingerprinting</span>
            </div>

            {/* Status 6: Delivery Failures */}
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Delivery Failures</span>
              <div
                className={`text-lg font-bold mt-0.5 ${
                  (globalStatus?.telemetry?.messages?.failed || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {globalStatus?.telemetry?.messages?.failed ?? 0}
              </div>
              <span className="text-[10px] text-slate-500 block">
                {(globalStatus?.telemetry?.messages?.failed || 0) > 0 ? 'Action required' : 'Clean outbox'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {notice && (
          <Alert
            variant={notice.type === 'error' ? 'danger' : notice.type === 'success' ? 'success' : 'info'}
            dismissible
            onDismiss={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        )}

        {/* =================================================================== */}
        {/* TABS NAVIGATION                                                     */}
        {/* =================================================================== */}
        <div className="flex border-b border-slate-800 gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('channels')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap ${
              activeTab === 'channels' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Authorized Channels ({channelsTotal})
            {activeTab === 'channels' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap ${
              activeTab === 'messages' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Ingested Messages ({messagesTotal})
            {activeTab === 'messages' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('deliveries')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap ${
              activeTab === 'deliveries' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Deliveries &amp; Failures ({deliveriesTotal})
            {activeTab === 'deliveries' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('publisher')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap ${
              activeTab === 'publisher' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Outbound Publishing Bot
            {activeTab === 'publisher' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-3 text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap ${
              activeTab === 'diagnostics' ? 'text-sky-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Worker Diagnostics
            {activeTab === 'diagnostics' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
            )}
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: AUTHORIZED CHANNELS MATRIX                                   */}
        {/* =================================================================== */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search channels by title or @username..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-72"
                />

                <select
                  value={channelStatusFilter}
                  onChange={(e) => setChannelStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="all">All Channels</option>
                  <option value="active">Active Listening</option>
                  <option value="paused">Paused / Standby</option>
                  <option value="unauthorized">Revoked / Unauthorized</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={fetchChannels} loading={loadingChannels}>
                  Filter
                </Button>
              </div>
            </div>

            {/* Channels Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Channel Info</th>
                      <th className="px-4 py-3">Telegram ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Authorization Reference</th>
                      <th className="px-4 py-3">Ingested Msgs</th>
                      <th className="px-4 py-3">Last Event</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingChannels ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400">
                          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading authorized channels...
                        </td>
                      </tr>
                    ) : channels.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500">
                          No authorized Telegram channels found. Click &quot;+ Register Channel&quot; to add one.
                        </td>
                      </tr>
                    ) : (
                      channels.map((ch) => (
                        <tr key={ch.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-white">{ch.title}</div>
                            {ch.username ? (
                              <a
                                href={`https://t.me/${ch.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-sky-400 hover:underline flex items-center gap-1 mt-0.5"
                              >
                                @{ch.username}
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">Private channel</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                            {ch.telegramChannelId}
                          </td>

                          <td className="px-4 py-3.5">
                            {!ch.isAuthorized ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                Revoked
                              </span>
                            ) : ch.isActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                Active Listening
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                Paused
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 max-w-xs truncate text-xs text-slate-400" title={ch.authorizationRecord}>
                            {ch.authorizationRecord || 'Documented permission on file'}
                          </td>

                          <td className="px-4 py-3.5 font-semibold text-white">
                            {ch._count?.messages ?? 0}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                            {formatTime(ch.lastEventAt)}
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerifyChannel(ch)}
                              loading={actionLoadingId === `verify-${ch.id}`}
                              className="text-sky-400 hover:text-sky-300"
                              title="Verify Telegram Access"
                            >
                              Verify
                            </Button>

                            {ch.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePauseChannel(ch.id, ch.title)}
                                loading={actionLoadingId === ch.id}
                                className="text-amber-400 hover:text-amber-300"
                              >
                                Pause
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleActivateChannel(ch.id, ch.title)}
                                loading={actionLoadingId === ch.id}
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                Activate
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(ch)}
                              className="text-slate-300 hover:text-white"
                            >
                              Edit
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setMessageChannelFilter(ch.id);
                                setActiveTab('messages');
                              }}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              Feed
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeactivateChannel(ch.id, ch.title)}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              Revoke
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConfirmDelete(ch)}
                              className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 font-medium"
                              title="Delete channel permanently"
                            >
                              Delete
                            </Button>
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

        {/* =================================================================== */}
        {/* TAB 2: LIVE INGESTED MESSAGES                                       */}
        {/* =================================================================== */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search message text content..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-72"
                />

                <select
                  value={messageChannelFilter}
                  onChange={(e) => setMessageChannelFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="">All Channels</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>

                <select
                  value={messageStatusFilter}
                  onChange={(e) => setMessageStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="PROCESSED">PROCESSED (Job Created)</option>
                  <option value="DUPLICATE">DUPLICATE</option>
                  <option value="FAILED">FAILED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="IGNORED">IGNORED (Non-vacancy)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={fetchMessages} loading={loadingMessages}>
                  Filter Feed
                </Button>
              </div>
            </div>

            {/* Messages Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Channel &amp; Msg ID</th>
                      <th className="px-4 py-3">Extracted Content Preview</th>
                      <th className="px-4 py-3">Publication Time</th>
                      <th className="px-4 py-3">Detected Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Linked Job</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loadingMessages ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400">
                          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Loading live ingested feed...
                        </td>
                      </tr>
                    ) : messages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500">
                          No ingested messages found for the selected filter.
                        </td>
                      </tr>
                    ) : (
                      messages.map((msg) => (
                        <tr key={msg.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-white">{msg.channel?.title}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span>#{msg.telegramMessageId}</span>
                              {msg.sourceUrl && (
                                <a
                                  href={msg.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-400 hover:underline flex items-center gap-0.5"
                                >
                                  View in TG
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 max-w-md">
                            <div
                              onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                              className="cursor-pointer group"
                            >
                              <p className={`text-xs text-slate-300 font-mono leading-relaxed ${expandedMessageId === msg.id ? '' : 'line-clamp-2'}`}>
                                {msg.originalText}
                              </p>
                              <span className="text-[10px] text-sky-400 group-hover:underline block mt-0.5">
                                {expandedMessageId === msg.id ? 'Collapse text' : 'Expand full post'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-300 whitespace-nowrap">
                            {formatTime(msg.publishedAt)}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                            {formatTime(msg.detectedAt)}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {msg.processingStatus === 'PROCESSED' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                PROCESSED
                              </span>
                            )}
                            {msg.processingStatus === 'DUPLICATE' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                DUPLICATE
                              </span>
                            )}
                            {msg.processingStatus === 'FAILED' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30" title={msg.errorMessage}>
                                FAILED
                              </span>
                            )}
                            {msg.processingStatus === 'PENDING' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                PENDING
                              </span>
                            )}
                            {msg.processingStatus === 'IGNORED' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                IGNORED
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                            {msg.job ? (
                              <a
                                href={`http://localhost:3000/jobs/${msg.job.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:underline font-medium block truncate max-w-[200px]"
                                title={msg.job.normalizedTitle}
                              >
                                {msg.job.normalizedTitle}
                              </a>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {messagesTotal > 30 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
                  <span>Showing page {messagePage} of {Math.ceil(messagesTotal / 30)} ({messagesTotal} total items)</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagePage <= 1}
                      onClick={() => setMessagePage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={messagePage >= Math.ceil(messagesTotal / 30)}
                      onClick={() => setMessagePage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: DELIVERIES & FAILURES DIAGNOSTICS                            */}
        {/* =================================================================== */}
        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Delivery Failures &amp; Outbox Recovery</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect failed webhook posts between worker outbox and backend ingestion. One-click retry available.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchDeliveries} loading={loadingDeliveries}>
                Refresh Failures
              </Button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Message ID</th>
                    <th className="px-4 py-3">Error Cause</th>
                    <th className="px-4 py-3">Failed At</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingDeliveries ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Checking delivery logs...
                      </td>
                    </tr>
                  ) : deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500">
                        <svg className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        All message deliveries succeeded. Zero failures currently in queue.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{del.channel?.title}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">#{del.telegramMessageId}</td>
                        <td className="px-4 py-3 text-xs text-rose-400 font-mono max-w-sm truncate" title={del.errorMessage}>
                          {del.errorMessage || 'Unknown delivery failure'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatTime(del.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRetryDelivery(del.id)}
                            loading={actionLoadingId === `retry-${del.id}`}
                          >
                            Retry Delivery
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: OUTBOUND PUBLISHING BOT                                      */}
        {/* =================================================================== */}
        {activeTab === 'publisher' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white">Outbound Telegram Publishing Bot</h3>
              <p className="text-sm text-slate-400 mt-1">
                Monitors high-value platform jobs (&gt; 20,000 ETB) and broadcasts alerts to the official Telegram channel.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Published Posts</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {publisherStats?.postedCount ?? 0}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Pending Eligible</span>
                  <div className="text-2xl font-bold text-amber-400 mt-1">
                    {publisherStats?.pendingCount ?? 0}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Skipped (&lt;20k ETB)</span>
                  <div className="text-2xl font-bold text-slate-400 mt-1">
                    {publisherStats?.skippedCount ?? 0}
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Publishing Failures</span>
                  <div className="text-2xl font-bold text-rose-400 mt-1">
                    {publisherStats?.failedCount ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 5: WORKER DIAGNOSTICS & TELEMETRY JSON                          */}
        {/* =================================================================== */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Live Worker Telemetry JSON</h3>
                  <p className="text-xs text-slate-400">Direct response from internal worker health endpoint (:5002/status)</p>
                </div>
                <Button variant="secondary" size="sm" onClick={fetchGlobalStatus} loading={loadingStatus}>
                  Re-fetch
                </Button>
              </div>

              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
                {JSON.stringify(globalStatus, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 1: REGISTER / EDIT CHANNEL MODAL                              */}
        {/* =================================================================== */}
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingChannel ? 'Edit Telegram Channel' : 'Register Authorized Telegram Channel'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Owner authorization is strictly required before registering any channel.
                </p>
              </div>

              {formError && <Alert variant="danger">{formError}</Alert>}

              <form onSubmit={handleSubmitChannelForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Telegram Channel Identifier or Link *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="@ethiojobs_official or https://t.me/ethiojobs"
                    value={registerForm.identifier}
                    onChange={(e) => setRegisterForm({ ...registerForm, identifier: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Accepts @username, full t.me link, or numeric Telegram Channel ID.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ethiojobs Official"
                    value={registerForm.title}
                    onChange={(e) => setRegisterForm({ ...registerForm, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Documented Authorization Reference &amp; Evidence *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide specific written consent reference, contract agreement date, or legal authorization note (minimum 10 characters)..."
                    value={registerForm.authorizationRecord}
                    onChange={(e) => setRegisterForm({ ...registerForm, authorizationRecord: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {!editingChannel && (
                  <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="consent-confirm"
                      checked={registerForm.explicitConsentConfirmation}
                      onChange={(e) => setRegisterForm({ ...registerForm, explicitConsentConfirmation: e.target.checked })}
                      className="mt-0.5 rounded border-slate-700 text-sky-500 focus:ring-sky-400 cursor-pointer"
                    />
                    <label htmlFor="consent-confirm" className="text-xs text-slate-300 leading-snug cursor-pointer select-none">
                      <span className="font-semibold text-white">Explicit Certification:</span> I formally certify that the owner/representative of this Telegram channel has authorized the automated collection and aggregation of vacancy postings on this platform.
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registerForm.isActive}
                      onChange={(e) => setRegisterForm({ ...registerForm, isActive: e.target.checked })}
                      className="rounded border-slate-700 text-sky-500 focus:ring-sky-400"
                    />
                    Activate listening immediately
                  </label>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRegisterModal(false)}
                      disabled={formSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" loading={formSubmitting}>
                      {editingChannel ? 'Save Changes' : 'Register Channel'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 2: CHANNEL VERIFICATION RESULT MODAL                          */}
        {/* =================================================================== */}
        {verifyingChannel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Telegram Access Verification: {verifyingChannel.title}
              </h3>

              {verificationResult ? (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      verificationResult.workerAccessible
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <p className="font-semibold">
                      {verificationResult.workerAccessible
                        ? '✓ Verified accessible on Telegram network.'
                        : 'Notice: Could not directly query GramJS client entity.'}
                    </p>
                    <p className="mt-1 text-[11px] opacity-90">{verificationResult.message || 'Worker confirmed channel accessibility.'}</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div>
                      <span className="text-slate-500">Identifier:</span>{' '}
                      <span className="font-mono text-slate-300">{verificationResult.telegramChannelId}</span>
                    </div>
                    {verificationResult.publicUrl && (
                      <div>
                        <span className="text-slate-500">Public URL:</span>{' '}
                        <a
                          href={verificationResult.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline"
                        >
                          {verificationResult.publicUrl}
                        </a>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500">Listening Configured:</span>{' '}
                      <span className={verificationResult.isActive ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {verificationResult.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-sm">
                  <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Testing connection via GramJS client...
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="secondary" size="sm" onClick={() => setVerifyingChannel(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 3: CONFIRM TOGGLE WORKER MODAL                                */}
        {/* =================================================================== */}
        {confirmToggleWorkerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Confirm Worker Operational State Change</h3>
                <p className="text-xs text-slate-400 mt-2">
                  {globalStatus?.worker?.isListening
                    ? 'Are you sure you want to pause real-time Telegram message listening? Incoming job postings will remain in channel history and will not be detected until resumed.'
                    : 'Are you sure you want to resume real-time Telegram message listening?'}
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmToggleWorkerModal(false)}
                  disabled={actionLoadingId === 'toggle-worker'}
                >
                  Cancel
                </Button>
                <Button
                  variant={globalStatus?.worker?.isListening ? 'danger' : 'primary'}
                  size="sm"
                  onClick={handleToggleWorker}
                  loading={actionLoadingId === 'toggle-worker'}
                >
                  {globalStatus?.worker?.isListening ? 'Yes, Pause Listening' : 'Yes, Resume Listening'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* MODAL 4: CONFIRM DELETE CHANNEL MODAL                               */}
        {/* =================================================================== */}
        {channelToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Telegram Channel</h3>
                  <p className="text-xs text-slate-400">Permanently remove channel from monitoring</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-white">&quot;{channelToDelete.title}&quot;</span>?
                This will remove the channel from active Telegram monitoring and delete its raw ingested message logs.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChannelToDelete(null)}
                  disabled={deletingChannel}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleExecuteDelete}
                  loading={deletingChannel}
                >
                  Delete Channel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
