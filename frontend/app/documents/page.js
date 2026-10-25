'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ProtectedRoute } from '@/components/protected-route';
import {
  fetchGeneratedDocuments,
  deleteGeneratedDocument,
  downloadGeneratedDocument,
} from '@/lib/jobs-api';
import { DocumentGenerationModal } from '@/components/documents/document-generation-modal';

function getDocTypeBadge(type) {
  switch (type) {
    case 'TAILORED_CV':
      return {
        label: 'Tailored CV',
        icon: '📄',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'COVER_LETTER':
      return {
        label: 'Cover Letter',
        icon: '✉️',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'APPLICATION_EMAIL':
      return {
        label: 'App Email',
        icon: '📧',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    default:
      return {
        label: 'Document',
        icon: '📝',
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
      };
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DocumentsListContent() {
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Generation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Export / Delete Actions State
  const [exportingId, setExportingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: 12,
        ...(activeTab !== 'ALL' && { documentType: activeTab }),
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
      };
      const res = await fetchGeneratedDocuments(params);
      setDocuments(res.items || []);
      setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments(1);
  }, [activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadDocuments(1);
  };

  const handleExport = async (doc, format = 'pdf') => {
    setExportingId(doc.id);
    try {
      const versionNum = doc.versions?.[0]?.versionNumber || doc.currentVersionNumber || 1;
      await downloadGeneratedDocument(doc.id, versionNum, format, doc.title);
    } catch (err) {
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this document? This will permanently remove all version history.')) {
      return;
    }
    setDeletingId(docId);
    try {
      await deleteGeneratedDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err) {
      alert(err.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stormy-border">
          <div>
            <h1 className="text-2xl font-extrabold text-stormy-dark tracking-tight">
              My Application Documents
            </h1>
            <p className="text-xs sm:text-sm text-stormy-muted mt-1">
              AI-tailored CVs, role-specific cover letters, and outbound emails strictly grounded in your verified experience.
            </p>
          </div>
          <Button
            variant="cta"
            size="md"
            className="gap-2 shrink-0 shadow-subtle"
            onClick={() => setIsModalOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Document</span>
          </Button>
        </div>

        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-stormy-border rounded-xl w-fit">
            {[
              { id: 'ALL', label: 'All Documents' },
              { id: 'TAILORED_CV', label: 'Tailored CVs' },
              { id: 'COVER_LETTER', label: 'Cover Letters' },
              { id: 'APPLICATION_EMAIL', label: 'Emails' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-stormy-dark text-white shadow-subtle'
                    : 'text-stormy-muted hover:text-stormy-dark hover:bg-slate-100/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-sm w-full">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents or companies..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-stormy-border focus:outline-none focus:ring-2 focus:ring-stormy-sky shadow-subtle"
              />
              <svg
                className="w-4 h-4 text-stormy-muted absolute left-3 top-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 bg-white border border-stormy-border rounded-2xl p-5 animate-pulse flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-24 h-6 bg-slate-100 rounded-lg" />
                  <div className="w-3/4 h-5 bg-slate-200 rounded-md" />
                  <div className="w-1/2 h-4 bg-slate-100 rounded-md" />
                </div>
                <div className="w-full h-9 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center max-w-lg mx-auto shadow-card space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl shadow-subtle">
              📄
            </div>
            <div>
              <h3 className="text-base font-bold text-stormy-dark">
                No application documents yet
              </h3>
              <p className="text-xs text-stormy-muted mt-1 leading-relaxed">
                Tailor your CV or craft a role-specific cover letter and outbound email for any job on our platform or external opportunities.
              </p>
            </div>
            <Button
              variant="cta"
              size="md"
              className="gap-2 mx-auto"
              onClick={() => setIsModalOpen(true)}
            >
              <span>⚡</span>
              <span>Create Your First Document</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc) => {
              const badge = getDocTypeBadge(doc.documentType);
              const latestVer = doc.versions?.[0];
              const isDeletingThis = deletingId === doc.id;
              const isExportingThis = exportingId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-stormy-border hover:border-stormy-slate rounded-2xl p-5 shadow-card hover:shadow-floating transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>

                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stormy-muted bg-slate-100/70 px-2 py-0.5 rounded-md">
                        <span>v{doc.currentVersionNumber}</span>
                      </div>
                    </div>

                    {/* Title & Target Job */}
                    <div>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="text-sm font-bold text-stormy-dark group-hover:text-stormy-sky transition-colors line-clamp-1 block"
                      >
                        {doc.title}
                      </Link>
                      <p className="text-xs text-stormy-muted line-clamp-1 mt-0.5">
                        Target: <strong className="text-stormy-main">{doc.targetCompanyName}</strong> — {doc.targetJobTitle}
                      </p>
                    </div>

                    {/* Preview Snippet */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-stormy-muted font-mono line-clamp-3 leading-relaxed">
                      {latestVer?.content || 'No content preview available.'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stormy-muted pt-1">
                      <span>Updated {formatDate(doc.updatedAt)}</span>
                      {doc.jobId ? (
                        <Link
                          href={`/jobs/${doc.jobId}`}
                          className="hover:text-stormy-sky underline"
                        >
                          View Job &rarr;
                        </Link>
                      ) : (
                        <span className="text-slate-400">External Vacancy</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      Open Workspace &rarr;
                    </Button>

                    {/* Export Dropdown / Quick PDF */}
                    <Button
                      variant="outline"
                      size="sm"
                      title="Download PDF"
                      loading={isExportingThis}
                      onClick={() => handleExport(doc, 'pdf')}
                      className="px-2.5 text-xs text-stormy-muted hover:text-blue-700"
                    >
                      PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      title="Download Word Document"
                      loading={isExportingThis}
                      onClick={() => handleExport(doc, 'docx')}
                      className="px-2.5 text-xs text-stormy-muted hover:text-blue-700"
                    >
                      DOCX
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeletingThis}
                      title="Delete Document"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => loadDocuments(pagination.page - 1)}
            >
              &larr; Previous
            </Button>
            <span className="text-xs font-semibold text-stormy-muted">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadDocuments(pagination.page + 1)}
            >
              Next &rarr;
            </Button>
          </div>
        )}
      </main>

      {/* Freeform Generation Wizard Modal */}
      <DocumentGenerationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadDocuments(1)}
      />
    </div>
  );
}

export default function DocumentsPage() {
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
        <DocumentsListContent />
      </ProtectedRoute>
    </React.Suspense>
  );
}
