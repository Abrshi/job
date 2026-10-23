'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createApplication } from '@/lib/jobs-api';
import { fetchDocuments } from '@/lib/documents-api';

export function AddExternalModal({ isOpen, onClose, onSuccess }) {
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState('APPLIED');
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [documentId, setDocumentId] = useState('');

  const [documents, setDocuments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadDocuments() {
      try {
        const res = await fetchDocuments();
        setDocuments(res.documents || []);
      } catch {
        // Non-critical if documents cannot be fetched
      }
    }

    loadDocuments();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!jobTitle.trim()) {
      setError('Job title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        source: 'EXTERNAL',
        externalCompanyName: companyName.trim(),
        externalJobTitle: jobTitle.trim(),
        externalJobUrl: jobUrl.trim() || undefined,
        externalLocation: location.trim() || undefined,
        externalSalary: salary.trim() || undefined,
        status,
        appliedAt: appliedAt ? new Date(appliedAt).toISOString() : new Date().toISOString(),
        notes: notes.trim() || undefined,
        documentId: documentId || undefined,
      };

      const result = await createApplication(payload);
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-elevated space-y-5 my-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-stormy-main">
              Track External Job Application
            </h3>
            <p className="text-xs text-stormy-muted mt-0.5">
              Record opportunities from outside platforms, direct outreach, or referrals.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stormy-muted hover:text-stormy-dark p-1 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-xs text-feedback-danger-text">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Job Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Developer"
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Job / Vacancy URL
            </label>
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://company.com/careers/job-123"
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Addis Ababa / Remote"
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Salary / Compensation
              </label>
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 50,000 ETB / month"
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none bg-white"
              >
                <option value="APPLIED">Applied (Already submitted)</option>
                <option value="DRAFT">Draft (Wishlist / In progress)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Date Applied
              </label>
              <input
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>
          </div>

          {documents.length > 0 && (
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Attach Submitted CV / Document (Optional)
              </label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none bg-white"
              >
                <option value="">No CV Attached</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.originalFilename} ({new Date(doc.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Personal Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Applied through recruiter message on LinkedIn, submitted custom portfolio..."
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stormy-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Add Application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

