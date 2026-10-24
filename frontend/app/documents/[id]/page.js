'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ProtectedRoute } from '@/components/protected-route';
import {
  fetchGeneratedDocumentById,
  saveDocumentVersion,
  downloadGeneratedDocument,
  attachDocumentToApplication,
  fetchApplications,
} from '@/lib/jobs-api';

function getBadge(type) {
  switch (type) {
    case 'TAILORED_CV':
      return { label: 'Tailored CV', icon: '📄', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'COVER_LETTER':
      return { label: 'Cover Letter', icon: '✉️', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'APPLICATION_EMAIL':
      return { label: 'Application Email', icon: '📧', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    default:
      return { label: 'Document', icon: '📝', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DocumentWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.id;

  const [document, setDocument] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [contentDraft, setContentDraft] = useState('');
  const [subjectDraft, setSubjectDraft] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Attach to Application modal state
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [applications, setApplications] = useState([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [attachAs, setAttachAs] = useState('CV');
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachMessage, setAttachMessage] = useState(null);

  useEffect(() => {
    if (!documentId) return;

    let isMounted = true;
    async function loadDoc() {
      setIsLoading(true);
      setError(null);
      try {
        const doc = await fetchGeneratedDocumentById(documentId);
        if (!isMounted) return;
        setDocument(doc);
        const latest = doc.versions?.[0];
        if (latest) {
          setSelectedVersion(latest);
          setContentDraft(latest.content || '');
          setSubjectDraft(latest.subjectLine || '');
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load document workspace.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDoc();
    return () => {
      isMounted = false;
    };
  }, [documentId]);

  const handleSelectVersion = (version) => {
    setSelectedVersion(version);
    setContentDraft(version.content || '');
    setSubjectDraft(version.subjectLine || '');
    setSaveSuccess(false);
  };

  const handleSaveVersion = async (e) => {
    e.preventDefault();
    if (!contentDraft.trim()) {
      setError('Content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        content: contentDraft,
        subjectLine: document?.documentType === 'APPLICATION_EMAIL' ? subjectDraft.trim() || null : null,
        changeSummary: changeSummary.trim() || undefined,
      };

      const newVersion = await saveDocumentVersion(documentId, payload);

      setDocument((prev) => ({
        ...prev,
        currentVersionNumber: newVersion.versionNumber,
        versions: [newVersion, ...(prev.versions || [])],
      }));

      setSelectedVersion(newVersion);
      setChangeSummary('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to save version.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format) => {
    if (!selectedVersion) return;
    setIsExporting(true);
    try {
      await downloadGeneratedDocument(
        documentId,
        selectedVersion.versionNumber,
        format,
        document?.title || 'document'
      );
    } catch (err) {
      alert(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    let fullText = contentDraft;
    if (document?.documentType === 'APPLICATION_EMAIL' && subjectDraft) {
      fullText = `Subject: ${subjectDraft}\n\n${contentDraft}`;
    }
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const openAttachModal = async () => {
    setIsAttachModalOpen(true);
    setAttachMessage(null);
    try {
      const res = await fetchApplications({ limit: 50 });
      setApplications(res.items || []);
      if (res.items?.length > 0) {
        setSelectedAppId(res.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load applications for attach modal', err);
    }
  };

  const handleAttachSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAppId) {
      alert('Please select a target application.');
      return;
    }

    setIsAttaching(true);
    try {
      await attachDocumentToApplication(documentId, {
        applicationId: selectedAppId,
        attachAs,
      });

      setAttachMessage('Document successfully compiled to PDF and linked to your application!');
      setTimeout(() => {
        setIsAttachModalOpen(false);
      }, 1800);
    } catch (err) {
      alert(err.message || 'Failed to attach document.');
    } finally {
      setIsAttaching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stormy-muted mt-3">Loading workspace...</p>
        </main>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16">
          <Alert variant="danger">{error}</Alert>
          <div className="mt-4">
            <Link href="/documents" className="text-xs font-semibold text-stormy-sky hover:underline">
              &larr; Back to My Documents
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const badge = getBadge(document?.documentType);

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 font-semibold text-stormy-muted hover:text-stormy-dark transition-colors"
          >
            <span>&larr;</span>
            <span>Back to My Documents</span>
          </Link>

          {document?.jobId && (
            <Link
              href={`/jobs/${document.jobId}`}
              className="inline-flex items-center gap-1 text-stormy-sky font-semibold hover:underline"
            >
              <span>Target Job Listing</span>
              <span>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Workspace Header Card */}
        <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.color}`}>
                  <span>{badge.icon}</span>
                  <span>{badge.label}</span>
                </span>
                <span className="text-xs font-semibold text-stormy-muted bg-slate-100 px-2 py-0.5 rounded-md">
                  Version {selectedVersion?.versionNumber || 1} of {document?.currentVersionNumber}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-stormy-dark tracking-tight">
                {document?.title}
              </h1>
              <p className="text-xs sm:text-sm text-stormy-muted">
                Opportunity: <strong className="text-stormy-dark">{document?.targetCompanyName}</strong> — {document?.targetJobTitle}
              </p>
            </div>

            {/* Quick Export & Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                className="gap-1.5 text-xs shadow-subtle"
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                loading={isExporting}
                onClick={() => handleExport('pdf')}
                className="gap-1.5 text-xs text-blue-800 border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 shadow-subtle"
              >
                <span>📄</span>
                <span>Download PDF</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                loading={isExporting}
                onClick={() => handleExport('docx')}
                className="gap-1.5 text-xs text-blue-800 border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 shadow-subtle"
              >
                <span>📝</span>
                <span>Download Word</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                loading={isExporting}
                onClick={() => handleExport('txt')}
                className="gap-1.5 text-xs shadow-subtle"
              >
                <span>Text</span>
              </Button>

              <Button
                variant="cta"
                size="sm"
                onClick={openAttachModal}
                className="gap-1.5 text-xs shadow-subtle"
              >
                <span>📎</span>
                <span>Attach to Application</span>
              </Button>
            </div>
          </div>

          {/* Fact-Grounding & Draft Notice Banner */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <span className="text-amber-600 text-sm mt-0.5">⚠️</span>
            <div className="leading-relaxed">
              <strong className="font-semibold">Review before sending:</strong> This document was drafted by AI based on your verified profile. You can edit any section in the workspace below and save new revisions.
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {saveSuccess && (
          <Alert variant="success" onClose={() => setSaveSuccess(false)}>
            Revision saved successfully as Version {selectedVersion?.versionNumber}!
          </Alert>
        )}

        {/* Workspace Split-Pane Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Editor & Version Switcher (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Version Switcher Bar */}
            <div className="bg-white border border-stormy-border rounded-2xl p-4 shadow-card flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stormy-dark">Revision History:</span>
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
                  {document?.versions?.map((ver) => (
                    <button
                      key={ver.id}
                      onClick={() => handleSelectVersion(ver)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedVersion?.id === ver.id
                          ? 'bg-stormy-dark text-white shadow-subtle'
                          : 'bg-slate-100 text-stormy-muted hover:bg-slate-200'
                      }`}
                      title={ver.changeSummary || `Version ${ver.versionNumber}`}
                    >
                      v{ver.versionNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-stormy-muted">
                Created: {formatDate(selectedVersion?.createdAt)}
              </div>
            </div>

            {/* Document Editor Form */}
            <form onSubmit={handleSaveVersion} className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stormy-border">
                <h3 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                  Document Editor
                </h3>
                <span className="text-xs text-stormy-muted font-mono">
                  Markdown & Rich Text
                </span>
              </div>

              {/* Subject Line for Application Email */}
              {document?.documentType === 'APPLICATION_EMAIL' && (
                <div>
                  <label className="block text-xs font-bold text-stormy-dark mb-1">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={subjectDraft}
                    onChange={(e) => setSubjectDraft(e.target.value)}
                    placeholder="e.g. Application: Senior Software Engineer - Dawit Alemu"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky shadow-subtle font-medium text-stormy-dark"
                  />
                </div>
              )}

              {/* Body Textarea */}
              <div>
                <label className="block text-xs font-bold text-stormy-dark mb-1">
                  Document Content (Markdown)
                </label>
                <textarea
                  rows={18}
                  value={contentDraft}
                  onChange={(e) => setContentDraft(e.target.value)}
                  placeholder="Edit your document content..."
                  className="w-full p-4 text-xs font-mono rounded-xl border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky shadow-subtle leading-relaxed bg-slate-50/50 text-stormy-dark"
                />
              </div>

              {/* Change Summary Input */}
              <div>
                <label className="block text-xs font-semibold text-stormy-dark mb-1">
                  Revision Note / Summary of Changes (Optional)
                </label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g. Emphasized React architecture and optimized project bullets"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-stormy-muted">
                  Saving creates an immutable revision (v{(selectedVersion?.versionNumber || 1) + 1}).
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isSaving}
                  className="gap-2 shadow-subtle"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save New Revision</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Styled Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stormy-border">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                    Live Formatted Preview
                  </h3>
                </div>
                <span className="text-xs text-stormy-muted">
                  Print & PDF Layout
                </span>
              </div>

              {/* Preview Document Paper Sheet */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-6 text-xs text-stormy-main leading-relaxed shadow-inner max-h-[620px] overflow-y-auto space-y-3 font-sans">
                {document?.documentType === 'APPLICATION_EMAIL' && subjectDraft && (
                  <div className="pb-3 border-b border-slate-200 text-xs">
                    <span className="font-bold text-stormy-dark">Subject: </span>
                    <span className="text-stormy-main font-medium">{subjectDraft}</span>
                  </div>
                )}

                <div className="prose prose-sm max-w-none text-xs text-stormy-dark">
                  {contentDraft.split('\n').map((line, idx) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={idx} className="h-2" />;

                    if (trimmed.startsWith('# ')) {
                      return (
                        <h1 key={idx} className="text-base font-extrabold text-slate-900 border-b border-slate-200 pb-1 mt-2">
                          {trimmed.replace(/^#\s+/, '')}
                        </h1>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h2 key={idx} className="text-xs font-bold uppercase tracking-wider text-blue-700 border-b border-blue-100 pb-0.5 mt-3">
                          {trimmed.replace(/^##\s+/, '')}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('### ')) {
                      return (
                        <h3 key={idx} className="text-xs font-bold text-slate-800 mt-2">
                          {trimmed.replace(/^###\s+/, '')}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
                      return (
                        <div key={idx} className="flex items-start gap-1.5 pl-2 text-slate-700">
                          <span className="text-blue-500 font-bold">•</span>
                          <span>{trimmed.replace(/^[-*•]\s+/, '')}</span>
                        </div>
                      );
                    }
                    return (
                      <p key={idx} className="text-slate-700 leading-relaxed">
                        {trimmed}
                      </p>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-slate-200 text-[10px] text-slate-400 italic text-center">
                  Draft prepared for candidate review • Generated on Starcher Platform
                </div>
              </div>
            </div>

            {/* Model & Audit Metadata Box */}
            <div className="bg-white border border-stormy-border rounded-2xl p-5 shadow-card space-y-2.5 text-xs">
              <h4 className="font-bold text-stormy-dark uppercase tracking-wider text-[11px]">
                Generation Diagnostics & Audit
              </h4>
              <div className="space-y-1.5 text-stormy-muted">
                <div className="flex justify-between">
                  <span>AI Engine:</span>
                  <span className="font-mono text-stormy-dark font-semibold">
                    {selectedVersion?.modelIdentifier || 'gemini-3.5-flash-lite'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Prompt Version:</span>
                  <span className="font-mono text-stormy-dark">
                    {selectedVersion?.promptVersion || 'v1.0.0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Active Revision:</span>
                  <span className="font-semibold text-stormy-dark">
                    Version {selectedVersion?.versionNumber}
                  </span>
                </div>
                {document?.application && (
                  <div className="flex justify-between pt-1 border-t border-slate-100">
                    <span>Linked Application:</span>
                    <Link
                      href={`/jobs/applications/${document.application.id}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      {document.application.companyName} ({document.application.status})
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Attach to Application Modal */}
      {isAttachModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stormy-dark/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsAttachModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-floating border border-stormy-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-stormy-border flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📎</span>
                <div>
                  <h3 className="text-base font-bold text-stormy-dark">
                    Attach to Application
                  </h3>
                  <p className="text-xs text-stormy-muted">
                    Compile PDF and save into your ATS tracker record.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAttachModalOpen(false)}
                className="p-1 rounded-lg text-stormy-muted hover:text-stormy-dark"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAttachSubmit} className="p-6 space-y-4">
              {attachMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
                  {attachMessage}
                </div>
              )}

              {applications.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-stormy-muted">
                    You have no active tracked applications yet.
                  </p>
                  <Link
                    href="/jobs/applications"
                    className="text-xs font-bold text-stormy-sky hover:underline"
                  >
                    Go to Applications &rarr;
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-stormy-dark mb-1">
                      Target Application *
                    </label>
                    <select
                      value={selectedAppId}
                      onChange={(e) => setSelectedAppId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stormy-border bg-white focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                    >
                      {applications.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.companyName} — {app.jobTitle} ({app.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stormy-dark mb-1">
                      Attach Document As *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAttachAs('CV')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          attachAs === 'CV'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-stormy-border bg-white text-stormy-muted'
                        }`}
                      >
                        📄 Primary CV
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachAs('COVER_LETTER')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          attachAs === 'COVER_LETTER'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-stormy-border bg-white text-stormy-muted'
                        }`}
                      >
                        ✉️ Cover Letter
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAttachModalOpen(false)}
                      disabled={isAttaching}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={isAttaching}
                    >
                      Compile & Link PDF
                    </Button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentWorkspacePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
          <Navbar />
          <main className="max-w-4xl mx-auto px-4 py-16 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
          </main>
        </div>
      }
    >
      <ProtectedRoute>
        <DocumentWorkspaceContent />
      </ProtectedRoute>
    </React.Suspense>
  );
}
