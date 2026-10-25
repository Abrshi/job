'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin-layout';
import { adminApiClient } from '@/lib/admin-api-client';
import { Button } from '@/components/ui/button';

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState({
    siteName: 'JobSphere',
    tagline: 'Ethiopia & East Africa Premier Job Aggregation Platform',
    description: 'Discover curated job opportunities aggregated across top portals, direct employers, and verified recruiters.',
    logoUrl: '',
    faviconUrl: '',
    supportEmail: 'support@job.com',
    footerText: '© 2026 JobSphere Aggregation Platform. All rights reserved.',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await adminApiClient.get('/admin/settings');
        if (res?.data?.settings) {
          const s = res.data.settings;
          setFormData({
            siteName: s.siteName || '',
            tagline: s.tagline || '',
            description: s.description || '',
            logoUrl: s.logoUrl || '',
            faviconUrl: s.faviconUrl || '',
            supportEmail: s.supportEmail || '',
            footerText: s.footerText || '',
          });
        }
      } catch (err) {
        setError(err.message || 'Failed to load site branding settings.');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await adminApiClient.patch('/admin/settings', formData);
      setSuccessMessage('Site branding settings updated and persisted successfully to database.');
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center text-slate-400 shadow-card">
          <div className="w-8 h-8 mx-auto border-3 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
          Loading platform branding configuration...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Site Branding & Settings</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure persistent platform identity, branding titles, contact coordinates, and public footer metadata.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-200 text-xs">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="font-bold ml-4 text-emerald-400 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Form */}
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-card p-6 sm:p-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Platform Brand Name *</label>
                <input
                  type="text"
                  required
                  value={formData.siteName}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tagline or Short Slogan</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Platform Description</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 leading-relaxed focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Logo Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Favicon URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/favicon.ico"
                    value={formData.faviconUrl}
                    onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Support Contact Email</label>
                  <input
                    type="email"
                    value={formData.supportEmail}
                    onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Footer Copyright Text</label>
                  <input
                    type="text"
                    value={formData.footerText}
                    onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                    className="w-full p-2.5 border border-slate-700 rounded-lg bg-slate-950 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={saving}
                >
                  Save Branding Configuration
                </Button>
              </div>
            </form>
          </div>

          {/* Live Preview Card */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Real-Time Branding Preview</h3>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-card p-6 space-y-5">
              {/* Navbar Preview */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded" />
                  ) : (
                    <div className="w-6 h-6 rounded bg-sky-500 text-slate-950 font-extrabold flex items-center justify-center text-xs">
                      {formData.siteName ? formData.siteName.charAt(0) : 'J'}
                    </div>
                  )}
                  <span className="font-bold text-sm tracking-tight text-white">
                    {formData.siteName || 'JobSphere'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  Candidate View
                </span>
              </div>

              {/* Hero Banner Preview */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-white leading-tight">
                  {formData.tagline || 'Job Aggregation Platform'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {formData.description || 'Discover curated vacancies across employers.'}
                </p>
              </div>

              {/* Footer Preview */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-medium text-slate-300">
                  Support: {formData.supportEmail || 'support@job.com'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formData.footerText || '© 2026 JobSphere. All rights reserved.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
