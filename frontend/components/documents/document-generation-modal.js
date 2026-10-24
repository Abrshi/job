'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateDocument } from '@/lib/jobs-api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function DocumentGenerationModal({
  isOpen,
  onClose,
  job = null,
  applicationId = null,
  onSuccess = null,
}) {
  const router = useRouter();

  const [documentType, setDocumentType] = useState('TAILORED_CV');
  const [customInstructions, setCustomInstructions] = useState('');

  // External job inputs if not provided via platform job
  const [externalTitle, setExternalTitle] = useState('');
  const [externalCompany, setExternalCompany] = useState('');
  const [externalDescription, setExternalDescription] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const targetJobTitle = job?.normalizedTitle || job?.originalTitle || externalTitle;
  const targetCompanyName = job?.companyName || externalCompany;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError(null);

    if (!job && (!externalTitle.trim() || !externalCompany.trim())) {
      setError('Please provide both the target job title and company name.');
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        documentType,
        customInstructions: customInstructions.trim() || undefined,
        applicationId: applicationId || undefined,
      };

      if (job?.id) {
        payload.jobId = job.id;
      } else {
        payload.externalJob = {
          title: externalTitle.trim(),
          companyName: externalCompany.trim(),
          description: externalDescription.trim() || undefined,
        };
      }

      const res = await generateDocument(payload);
      const generatedDoc = res.document;

      if (onSuccess) {
        onSuccess(generatedDoc);
      }

      onClose();
      // Redirect to the newly created document workspace
      router.push(`/documents/${generatedDoc.id}`);
    } catch (err) {
      setError(err.message || 'Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stormy-dark/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-floating border border-stormy-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-stormy-border flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shadow-subtle">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 id="doc-wizard-title" className="text-base font-bold text-stormy-dark">
                Prepare Application Document
              </h3>
              <p className="text-xs text-stormy-muted">
                Tailored with AI, strictly grounded in your verified profile facts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stormy-muted hover:text-stormy-dark hover:bg-slate-200/60 transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-5">
          {error && (
            <Alert variant="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Job Target Badge / Form */}
          {job ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stormy-muted block mb-1">
                Target Opportunity
              </span>
              <p className="text-sm font-bold text-stormy-dark">
                {targetJobTitle}
              </p>
              <p className="text-xs text-stormy-muted">
                {targetCompanyName}
                {(job.city || job.country) && ` • ${[job.city, job.country].filter(Boolean).join(', ')}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stormy-muted block">
                Target Opportunity Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stormy-dark mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={externalTitle}
                    onChange={(e) => setExternalTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stormy-dark mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={externalCompany}
                    onChange={(e) => setExternalCompany(e.target.value)}
                    placeholder="e.g. Google or FinTech Ltd"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stormy-dark mb-1">
                  Job Description / Requirements (Optional)
                </label>
                <textarea
                  rows={3}
                  value={externalDescription}
                  onChange={(e) => setExternalDescription(e.target.value)}
                  placeholder="Paste key responsibilities or requirements to help the AI highlight your matching background..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
              </div>
            </div>
          )}

          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-bold text-stormy-dark mb-2">
              Select Document Type
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setDocumentType('TAILORED_CV')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  documentType === 'TAILORED_CV'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600'
                    : 'border-stormy-border hover:border-stormy-slate bg-white'
                }`}
              >
                <div className="text-xl mb-1">📄</div>
                <div className="text-xs font-bold text-stormy-dark">Tailored CV</div>
                <div className="text-[10px] text-stormy-muted mt-0.5 line-clamp-2">
                  Role-specific skills and impact
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDocumentType('COVER_LETTER')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  documentType === 'COVER_LETTER'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600'
                    : 'border-stormy-border hover:border-stormy-slate bg-white'
                }`}
              >
                <div className="text-xl mb-1">✉️</div>
                <div className="text-xs font-bold text-stormy-dark">Cover Letter</div>
                <div className="text-[10px] text-stormy-muted mt-0.5 line-clamp-2">
                  Role-specific story & motivation
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDocumentType('APPLICATION_EMAIL')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  documentType === 'APPLICATION_EMAIL'
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-600'
                    : 'border-stormy-border hover:border-stormy-slate bg-white'
                }`}
              >
                <div className="text-xl mb-1">📧</div>
                <div className="text-xs font-bold text-stormy-dark">App Email</div>
                <div className="text-[10px] text-stormy-muted mt-0.5 line-clamp-2">
                  Outbound pitch & subject line
                </div>
              </button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-xs font-bold text-stormy-dark mb-1">
              Custom Focus / Instructions (Optional)
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Emphasize backend scalability, mentor experience, or cloud migration"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky"
            />
          </div>

          {/* Fact-Grounding Banner */}
          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-2.5">
            <span className="text-blue-600 text-sm mt-0.5">🛡️</span>
            <div className="text-[11px] text-blue-900 leading-relaxed">
              <strong className="font-semibold">Fact-grounding guarantee:</strong> Your document is created
              strictly from your verified work history and education. You will be able to review, edit,
              and export it in PDF, Word, or plain text before submitting.
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="cta"
              size="md"
              loading={isGenerating}
              className="gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{isGenerating ? 'Generating Draft...' : 'Generate Document'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
