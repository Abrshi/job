'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchApplicationById,
  updateApplication,
  withdrawApplication,
  deleteDraftApplication,
  createReminder,
  updateReminder,
  deleteReminder,
  updateInterview,
  deleteInterview,
} from '@/lib/jobs-api';
import { StatusBadge } from '@/components/applications/status-badge';
import { StatusUpdateModal } from '@/components/applications/status-update-modal';
import { ScheduleInterviewModal } from '@/components/applications/schedule-interview-modal';
import { DocumentGenerationModal } from '@/components/documents/document-generation-modal';

function ApplicationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const applicationId = params?.id;

  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);

  // Reminders state
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [isAddingReminder, setIsAddingReminder] = useState(false);

  // Notes state
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/?returnUrl=/jobs/applications/${applicationId}`);
    }
  }, [authLoading, isAuthenticated, router, applicationId]);

  const loadApplication = useCallback(async () => {
    if (!applicationId || !isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchApplicationById(applicationId);
      setApplication(data);
      setNotes(data.notes || '');
    } catch (err) {
      setError(err.message || 'Application not found or access denied.');
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, isAuthenticated]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleWithdraw = async () => {
    const confirm = window.confirm(
      'Are you sure you want to withdraw this application? It will be archived and you can reapply later.'
    );
    if (!confirm) return;

    try {
      await withdrawApplication(application.id, 'Candidate retracted application via detail view');
      loadApplication();
    } catch (err) {
      alert(err.message || 'Failed to withdraw application.');
    }
  };

  const handleDeleteDraft = async () => {
    const confirm = window.confirm(
      'Are you sure you want to permanently delete this application draft?'
    );
    if (!confirm) return;

    try {
      await deleteDraftApplication(application.id);
      router.push('/jobs/applications');
    } catch (err) {
      alert(err.message || 'Failed to delete draft.');
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    setNotesSavedNotice(false);
    try {
      await updateApplication(application.id, { notes });
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2500);
    } catch (err) {
      alert(err.message || 'Failed to save notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddReminder = async (e) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDate) return;

    setIsAddingReminder(true);
    try {
      await createReminder(application.id, {
        title: reminderTitle.trim(),
        remindAt: new Date(reminderDate).toISOString(),
      });
      setReminderTitle('');
      setReminderDate('');
      loadApplication();
    } catch (err) {
      alert(err.message || 'Failed to add reminder.');
    } finally {
      setIsAddingReminder(false);
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      await updateReminder(application.id, reminder.id, {
        isCompleted: !reminder.isCompleted,
      });
      loadApplication();
    } catch (err) {
      console.error('Failed to update reminder:', err);
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    try {
      await deleteReminder(application.id, reminderId);
      loadApplication();
    } catch (err) {
      console.error('Failed to delete reminder:', err);
    }
  };

  const handleUpdateInterviewOutcome = async (interviewId, outcome) => {
    try {
      await updateInterview(application.id, interviewId, { outcome });
      loadApplication();
    } catch (err) {
      alert(err.message || 'Failed to update interview outcome.');
    }
  };

  const handleDeleteInterview = async (interviewId) => {
    if (!window.confirm('Are you sure you want to remove this interview round?')) return;
    try {
      await deleteInterview(application.id, interviewId);
      loadApplication();
    } catch (err) {
      alert(err.message || 'Failed to delete interview round.');
    }
  };

  if (authLoading || (!isAuthenticated && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-12 w-full space-y-6">
          <div className="w-32 h-6 bg-slate-200 rounded animate-pulse" />
          <div className="bg-white border border-stormy-border rounded-2xl p-8 space-y-4 animate-pulse shadow-card">
            <div className="w-1/2 h-8 bg-slate-200 rounded" />
            <div className="w-1/4 h-5 bg-slate-100 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-stormy-main">Application Not Found</h2>
          <p className="text-sm text-stormy-muted">{error || 'Unable to locate this application record.'}</p>
          <div className="pt-2">
            <Link
              href="/jobs/applications"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-stormy-sky text-stormy-dark font-bold text-sm shadow-subtle"
            >
              &larr; Back to Applications Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isDraft = application.status === 'DRAFT';
  const isWithdrawn = application.status === 'WITHDRAWN';
  const isTerminal = ['REJECTED', 'WITHDRAWN'].includes(application.status);

  const appliedDateFormatted = application.appliedAt
    ? new Date(application.appliedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
        {/* Breadcrumb Back Link */}
        <div>
          <Link
            href="/jobs/applications"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stormy-slate hover:text-stormy-dark transition-colors"
          >
            <span>&larr;</span>
            <span>Back to Applications</span>
          </Link>
        </div>

        {/* Application Header Card */}
        <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card space-y-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-stormy-main tracking-tight">
                  {application.title || application.jobTitle}
                </h1>
                <StatusBadge status={application.status} size="lg" />
              </div>

              <p className="text-lg font-bold text-stormy-slate">
                {application.companyName}
              </p>

              {/* Source & Location tags */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {application.source === 'PLATFORM' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Verified Platform Job
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    External Opportunity
                  </span>
                )}

                {application.location && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-canvas text-stormy-dark border border-stormy-border">
                    📍 {application.location}
                  </span>
                )}

                {application.salary && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    💰 {application.salary}
                  </span>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsStatusModalOpen(true)}
              >
                Update Status
              </Button>

              {!isTerminal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInterviewModalOpen(true)}
                >
                  + Schedule Interview
                </Button>
              )}

              {!isWithdrawn && !isDraft && application.status !== 'REJECTED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWithdraw}
                  className="hover:border-rose-300 hover:text-rose-700 hover:bg-rose-50"
                >
                  Withdraw
                </Button>
              )}

              {isDraft && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteDraft}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  Delete Draft
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Timeline, Interviews, Cover Note, Notes */}
          <div className="lg:col-span-8 space-y-6">
            {/* Visual History Timeline Stepper */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                Application Timeline & History
              </h2>

              <div className="space-y-4 pt-1">
                {application.history && application.history.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stormy-border">
                    {application.history.map((event, idx) => (
                      <div key={event.id || idx} className="relative group text-xs">
                        {/* Dot */}
                        <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-stormy-sky border-2 border-white shadow-xs" />

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stormy-main">
                              {event.fromStatus ? (
                                <>
                                  Status updated to <strong>{event.toStatus}</strong> (from {event.fromStatus})
                                </>
                              ) : (
                                <>Application created with status <strong>{event.toStatus}</strong></>
                              )}
                            </span>
                            <span className="text-[11px] text-stormy-muted">
                              {new Date(event.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {event.reason && (
                            <p className="text-stormy-slate bg-stormy-canvas p-2 rounded-lg border border-stormy-border/60">
                              &ldquo;{event.reason}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stormy-muted italic">
                    Submitted on {appliedDateFormatted}.
                  </p>
                )}
              </div>
            </div>

            {/* Multi-Round Interviews Section */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stormy-border">
                <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                  Interview Rounds ({application.interviews?.length || 0})
                </h2>
                {!isTerminal && (
                  <button
                    type="button"
                    onClick={() => setIsInterviewModalOpen(true)}
                    className="text-xs font-bold text-stormy-sky hover:underline"
                  >
                    + Add Round
                  </button>
                )}
              </div>

              {application.interviews && application.interviews.length > 0 ? (
                <div className="space-y-4">
                  {application.interviews.map((intv) => {
                    const scheduledDateFormatted = new Date(intv.scheduledAt).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    });

                    const outcomeBadges = {
                      PENDING: 'bg-amber-50 text-amber-800 border-amber-300',
                      PASSED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
                      FAILED: 'bg-rose-50 text-rose-800 border-rose-300',
                      CANCELLED: 'bg-slate-100 text-slate-700 border-slate-300',
                    };

                    return (
                      <div
                        key={intv.id}
                        className="p-4 rounded-xl border border-stormy-border bg-stormy-canvas/40 space-y-3 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-stormy-main">
                                Round {intv.roundNumber}: {intv.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  outcomeBadges[intv.outcome] || outcomeBadges.PENDING
                                }`}
                              >
                                {intv.outcome}
                              </span>
                            </div>
                            <p className="text-stormy-muted font-medium mt-0.5">
                              🗓 {scheduledDateFormatted} ({intv.timezone}) · {intv.durationMinutes} min {intv.interviewType.toLowerCase()}
                            </p>
                          </div>

                          {intv.locationUrl && (
                            <a
                              href={intv.locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stormy-dark text-white font-bold text-xs hover:bg-stormy-darkHover transition-colors shrink-0"
                            >
                              <span>Join Meeting</span>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>

                        {intv.interviewerInfo && (
                          <p className="text-stormy-slate">
                            <strong>Interviewer(s):</strong> {intv.interviewerInfo}
                          </p>
                        )}

                        {intv.preparationNotes && (
                          <div className="p-2.5 rounded-lg bg-white border border-stormy-border text-stormy-slate">
                            <strong className="block text-stormy-dark mb-0.5">Prep Notes:</strong>
                            <p className="whitespace-pre-wrap">{intv.preparationNotes}</p>
                          </div>
                        )}

                        {intv.feedbackNotes && (
                          <div className="p-2.5 rounded-lg bg-white border border-stormy-border text-stormy-slate">
                            <strong className="block text-stormy-dark mb-0.5">Debrief Notes:</strong>
                            <p className="whitespace-pre-wrap">{intv.feedbackNotes}</p>
                          </div>
                        )}

                        {/* Outcome switcher */}
                        <div className="flex items-center justify-between pt-2 border-t border-stormy-border/60">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-stormy-muted">Mark Outcome:</span>
                            {['PASSED', 'FAILED', 'CANCELLED'].map((oc) => (
                              <button
                                key={oc}
                                type="button"
                                onClick={() => handleUpdateInterviewOutcome(intv.id, oc)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                  intv.outcome === oc
                                    ? 'bg-stormy-dark text-white'
                                    : 'bg-white border border-stormy-border text-stormy-dark hover:bg-slate-100'
                                }`}
                              >
                                {oc}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteInterview(intv.id)}
                            className="text-rose-600 hover:underline text-[11px]"
                          >
                            Remove Round
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-stormy-border rounded-xl text-center text-xs text-stormy-muted space-y-2">
                  <p>No interview rounds scheduled yet for this position.</p>
                  {!isTerminal && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsInterviewModalOpen(true)}
                    >
                      + Schedule Round 1
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Submitted Cover Note / Pitch */}
            {application.coverNoteText && (
              <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-3">
                <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                  Cover Note / Pitch Submitted
                </h2>
                <div className="p-4 rounded-xl bg-stormy-canvas border border-stormy-border text-xs text-stormy-main whitespace-pre-wrap leading-relaxed">
                  {application.coverNoteText}
                </div>
              </div>
            )}

            {/* Preparation & General Notes */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stormy-border">
                <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                  Personal Preparation & Notes
                </h2>
                {notesSavedNotice && (
                  <span className="text-xs font-bold text-emerald-700 animate-in fade-in">
                    ✓ Notes Saved
                  </span>
                )}
              </div>

              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log contacts, salary negotiations, recruiter correspondence, interview impressions..."
                className="w-full p-3 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none leading-relaxed"
              />

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Submitted CV Snapshot, Reminders, Platform Job Link */}
          <div className="lg:col-span-4 space-y-6">
            {/* Submitted CV Document Snapshot */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-3 text-xs">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                Submitted CV Snapshot
              </h2>

              {application.documentSnapshotFilename ? (
                <div className="p-3.5 rounded-xl border border-stormy-border bg-stormy-canvas space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 truncate">
                      <span className="font-bold text-stormy-main block truncate">
                        {application.documentSnapshotFilename}
                      </span>
                      <span className="text-[10px] text-stormy-muted font-mono block truncate">
                        Hash: {application.documentSnapshotChecksum?.slice(0, 16)}...
                      </span>
                    </div>
                  </div>

                  {application.documentId && (
                    <a
                      href={`/api/v1/documents/${application.documentId}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-stormy-border hover:border-stormy-slate text-stormy-dark font-bold text-xs transition-colors shadow-xs mt-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download Submitted File</span>
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-stormy-muted italic">
                  No specific document was attached to this application.
                </p>
              )}
            </div>

            {/* AI Application Documents Card */}
            <div className="bg-gradient-to-br from-blue-50/70 via-white to-slate-50 border border-blue-200/80 rounded-2xl p-6 shadow-card space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-stormy-border">
                <h2 className="text-sm font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>AI Application Documents</span>
                </h2>
              </div>
              <p className="text-stormy-muted leading-relaxed">
                Generate a fact-grounded tailored CV, cover letter, or outbound email specifically customized for {application.companyName}.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-white border-blue-300 text-blue-900 hover:bg-blue-50 hover:border-blue-400 font-semibold gap-1.5 shadow-subtle"
                onClick={() => setIsDocModalOpen(true)}
              >
                <span>⚡</span>
                <span>Prepare Application Documents</span>
              </Button>
            </div>

            {/* Follow-up Reminders Checklist */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4 text-xs">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                Follow-up Reminders
              </h2>

              {/* Reminders List */}
              {application.reminders && application.reminders.length > 0 ? (
                <div className="space-y-2.5">
                  {application.reminders.map((rem) => {
                    const remindDateFormatted = new Date(rem.remindAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <div
                        key={rem.id}
                        className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                          rem.isCompleted
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-stormy-border'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={rem.isCompleted}
                            onChange={() => handleToggleReminder(rem)}
                            className="mt-0.5 rounded text-stormy-sky focus:ring-stormy-sky cursor-pointer"
                          />
                          <div>
                            <span
                              className={`font-semibold block ${
                                rem.isCompleted ? 'line-through text-stormy-muted' : 'text-stormy-main'
                              }`}
                            >
                              {rem.title}
                            </span>
                            <span className="text-[10px] text-stormy-muted">
                              ⏰ Due {remindDateFormatted}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(rem.id)}
                          className="text-stormy-muted hover:text-rose-600 p-1"
                          title="Remove reminder"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-stormy-muted italic">
                  No reminders set yet.
                </p>
              )}

              {/* Add Reminder Form */}
              <form onSubmit={handleAddReminder} className="pt-2 border-t border-stormy-border space-y-2">
                <span className="font-bold text-stormy-dark block">Add Reminder</span>
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="e.g. Follow up on offer letter"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stormy-border text-xs focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
                <input
                  type="date"
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stormy-border text-xs focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isAddingReminder}
                >
                  {isAddingReminder ? 'Adding...' : '+ Add Reminder'}
                </Button>
              </form>
            </div>

            {/* Platform Job Link Info */}
            {application.job?.id && (
              <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-3 text-xs">
                <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                  Original Platform Listing
                </h2>
                <div className="space-y-2">
                  <p className="text-stormy-slate">
                    This application is linked to an active job opening in the directory.
                  </p>
                  <Link
                    href={`/jobs/${application.job.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stormy-canvas border border-stormy-border hover:border-stormy-slate font-bold text-stormy-dark transition-colors w-full justify-center"
                  >
                    <span>View Listing Details</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Status Modal */}
      {isStatusModalOpen && (
        <StatusUpdateModal
          application={application}
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onSuccess={() => loadApplication()}
        />
      )}

      {/* Interview Modal */}
      {isInterviewModalOpen && (
        <ScheduleInterviewModal
          applicationId={application.id}
          existingRoundsCount={application.interviews?.length || 0}
          isOpen={isInterviewModalOpen}
          onClose={() => setIsInterviewModalOpen(false)}
          onSuccess={() => loadApplication()}
        />
      )}

      {/* AI Document Generation Modal */}
      {isDocModalOpen && (
        <DocumentGenerationModal
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
          applicationId={application.id}
          job={
            application.job || {
              id: application.jobId || null,
              normalizedTitle: application.jobTitle,
              companyName: application.companyName,
              city: application.location,
            }
          }
        />
      )}
    </div>
  );
}

export default function ApplicationDetailPage() {
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
      <ApplicationDetailContent />
    </React.Suspense>
  );
}
