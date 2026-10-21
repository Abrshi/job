'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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
        const res = await apiClient.get('/admin/settings');
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
      await apiClient.patch('/admin/settings', formData);
      setSuccessMessage('Site branding settings updated and persisted successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-stormy-border text-center text-stormy-muted shadow-subtle">
        <div className="w-8 h-8 mx-auto border-3 border-stormy-sky border-t-transparent rounded-full animate-spin mb-2" />
        Loading branding configuration...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-stormy-main tracking-tight">Site Branding & Settings</h2>
        <p className="text-sm text-stormy-muted">
          Configure persistent site identity, branding titles, and public footer metadata stored directly in MySQL.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-xs">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stormy-border shadow-subtle p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div>
              <label className="block font-semibold text-stormy-main mb-1">Platform Brand Name *</label>
              <input
                type="text"
                required
                value={formData.siteName}
                onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-main mb-1">Tagline or Short Slogan</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-main mb-1">Platform Description</label>
              <textarea
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main leading-relaxed focus:ring-2 focus:ring-stormy-sky"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stormy-main mb-1">Logo Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              <div>
                <label className="block font-semibold text-stormy-main mb-1">Favicon URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/favicon.ico"
                  value={formData.faviconUrl}
                  onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stormy-main mb-1">Support Contact Email</label>
                <input
                  type="email"
                  value={formData.supportEmail}
                  onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              <div>
                <label className="block font-semibold text-stormy-main mb-1">Footer Copyright Text</label>
                <input
                  type="text"
                  value={formData.footerText}
                  onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                  className="w-full p-2.5 border border-stormy-border rounded-lg bg-stormy-canvas text-stormy-main focus:ring-2 focus:ring-stormy-sky"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-stormy-border flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-stormy-dark hover:bg-stormy-darkHover rounded-lg shadow-subtle disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? 'Saving Changes...' : 'Save Branding Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stormy-main">Real-Time Branding Preview</h3>
          <div className="bg-white rounded-2xl border border-stormy-border shadow-card p-6 space-y-5">
            {/* Navbar Preview */}
            <div className="p-3 bg-stormy-dark rounded-xl text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
                ) : (
                  <div className="w-6 h-6 rounded bg-stormy-sky text-stormy-dark font-extrabold flex items-center justify-center text-xs">
                    {formData.siteName.charAt(0)}
                  </div>
                )}
                <span className="font-bold text-sm tracking-tight">{formData.siteName || 'JobSphere'}</span>
              </div>
              <span className="text-[10px] text-stormy-mist/70">Candidate View</span>
            </div>

            {/* Hero Banner Preview */}
            <div className="p-4 bg-stormy-canvas rounded-xl border border-stormy-border space-y-2">
              <h4 className="text-base font-bold text-stormy-main leading-tight">
                {formData.tagline || 'Job Aggregation Platform'}
              </h4>
              <p className="text-xs text-stormy-muted leading-relaxed line-clamp-3">
                {formData.description || 'Discover curated vacancies across employers.'}
              </p>
            </div>

            {/* Footer Preview */}
            <div className="p-3 bg-stormy-canvas rounded-lg border border-stormy-border text-[11px] text-stormy-muted space-y-1">
              <p className="font-medium text-stormy-dark">Support: {formData.supportEmail || 'support@job.com'}</p>
              <p className="text-[10px]">{formData.footerText || '© 2026 JobSphere. All rights reserved.'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
