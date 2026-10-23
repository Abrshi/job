'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { fetchJobById, saveJob, unsaveJob, applyJob, createApplication } from '@/lib/jobs-api';
import { useAuth } from '@/hooks/use-auth';
import { formatSalary, formatRelativeTime } from '@/components/job-card';
import { StatusBadge } from '@/components/applications/status-badge';

function JobDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const jobId = params?.id;

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Internal Application Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [applySuccess, setApplySuccess] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    let isCancelled = false;
    async function loadJob() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJobById(jobId);
        if (!isCancelled) {
          setJob(data);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Job vacancy not found or no longer available.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadJob();

    return () => {
      isCancelled = true;
    };
  }, [jobId]);

  // Toggle Save
  const handleToggleSave = async () => {
    if (!isAuthenticated) {
      router.push(`/?returnUrl=/jobs/${jobId}`);
      return;
    }

    setIsSaving(true);
    const nextSavedState = !job.isSaved;
    setJob((prev) => ({ ...prev, isSaved: nextSavedState }));

    try {
      if (nextSavedState) {
        await saveJob(job.id);
      } else {
        await unsaveJob(job.id);
      }
    } catch (err) {
      setJob((prev) => ({ ...prev, isSaved: !nextSavedState }));
      console.error('Save job failure:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Internal Application
  const handleApplicationSubmit = async (e) => {
    e.preventDefault();
    setApplyError(null);
    setIsSubmittingApp(true);

    try {
      const res = await applyJob(job.id, coverNote);
      setApplySuccess(res);
      setJob((prev) => ({
        ...prev,
        hasApplied: true,
        applicationStatus: res.status || 'APPLIED',
        applicationId: res.applicationId,
      }));
      setTimeout(() => {
        setIsApplyModalOpen(false);
      }, 2000);
    } catch (err) {
      setApplyError(err.message || 'Unable to submit application. Please try again.');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-12 w-full space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-64 bg-white border border-stormy-border rounded-2xl p-6 shadow-card animate-pulse space-y-4">
            <div className="h-8 w-3/4 bg-slate-200 rounded" />
            <div className="h-5 w-1/3 bg-slate-100 rounded" />
            <div className="h-24 w-full bg-slate-100 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-feedback-danger-bg border border-feedback-danger-border flex items-center justify-center text-feedback-danger">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-stormy-main">
            Position Not Available
          </h1>
          <p className="text-sm text-stormy-muted">
            {error || 'This job listing may have expired, been removed, or is awaiting administrative review.'}
          </p>
          <div className="pt-2">
            <Link
              href="/jobs"
              className="inline-flex items-center px-4 py-2 rounded-xl bg-stormy-sky text-stormy-dark font-bold text-sm hover:bg-stormy-skyHover transition-colors"
            >
              &larr; Back to all jobs
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const salaryDisplay = formatSalary(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod
  );

  const locationDisplay = [job.city, job.country].filter(Boolean).join(', ') || 'Location Unspecified';
  const publishedDateFormatted = formatRelativeTime(job.publishedAt || job.firstSeenAt);
  const closingDateFormatted = job.closingDate
    ? new Date(job.closingDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between text-xs text-stormy-muted">
          <Link href="/jobs" className="hover:text-stormy-dark flex items-center gap-1 font-semibold">
            &larr; Back to job search
          </Link>
          {job.source?.name && (
            <span>
              Collected from <strong className="text-stormy-dark">{job.source.name}</strong>
            </span>
          )}
        </div>

        {/* Expired / Inactive Notice */}
        {job.isExpired && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold">This job vacancy has expired</p>
              <p className="text-xs text-amber-800">
                The application deadline for this vacancy has passed. It is displayed for historical reference only.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Description Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Header Box */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-stormy-main tracking-tight leading-snug">
                    {job.title}
                  </h1>
                  <p className="text-base font-semibold text-stormy-slate mt-1">
                    {job.companyName || 'Confidential Employer'}
                  </p>
                </div>

                {/* Bookmark Button */}
                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={isSaving}
                  className={`self-start p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                    job.isSaved
                      ? 'bg-stormy-mist/30 border-stormy-sky text-stormy-dark'
                      : 'bg-white border-stormy-border text-stormy-muted hover:border-stormy-slate hover:text-stormy-dark'
                  }`}
                >
                  <svg
                    className="w-4 h-4 text-stormy-sky"
                    fill={job.isSaved ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>{job.isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {/* Tags Strip */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stormy-border/60">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stormy-mist/50 text-stormy-dark border border-stormy-mist">
                  {job.workArrangement.replace('_', ' ')}
                </span>
                {job.employmentType && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {job.employmentType.replace('_', ' ')}
                  </span>
                )}
                {job.experienceLevel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {job.experienceLevel} Level
                  </span>
                )}
                {job.category?.name && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {job.category.name}
                  </span>
                )}
              </div>
            </div>

            {/* Description Body */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
              <h2 className="text-base font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                Job Description & Overview
              </h2>

              <div
                className="prose prose-sm max-w-none text-stormy-main leading-relaxed space-y-4 font-normal"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </div>
          </div>

          {/* Action & Metadata Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Action Box */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                Application
              </h2>

              {job.isExpired ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-stormy-muted text-center font-medium">
                  Applications are currently closed for this position.
                </div>
              ) : job.hasApplied ? (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-center space-y-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <StatusBadge status={job.applicationStatus || 'APPLIED'} size="sm" />
                  </div>
                  <p className="text-xs text-stormy-muted">
                    You have tracked an application for this position.
                  </p>
                  {job.applicationId && (
                    <Link
                      href={`/jobs/applications/${job.applicationId}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-white border border-blue-200 text-blue-800 hover:bg-blue-50 transition-colors shadow-subtle"
                    >
                      <span>View Application Details</span>
                      <span>&rarr;</span>
                    </Link>
                  )}
                </div>
              ) : job.applicationMethod === 'INTERNAL' ? (
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      if (!isAuthenticated) {
                        router.push(`/?returnUrl=/jobs/${job.id}`);
                      } else {
                        setIsApplyModalOpen(true);
                      }
                    }}
                  >
                    Apply Now
                  </Button>
                  <p className="text-[11px] text-stormy-muted text-center">
                    Direct internal application via JobPlatform.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <a
                    href={job.applicationUrl || job.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stormy-dark hover:bg-stormy-darkHover text-white font-bold text-sm shadow-subtle transition-colors"
                  >
                    <span>Apply on {job.source?.name || 'External Site'}</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!isAuthenticated) {
                        router.push(`/?returnUrl=/jobs/${job.id}`);
                        return;
                      }
                      try {
                        const res = await createApplication({
                          source: 'PLATFORM',
                          jobId: job.id,
                          status: 'APPLIED',
                          notes: `Tracked from job page on ${new Date().toLocaleDateString()}`,
                        });
                        setJob((prev) => ({
                          ...prev,
                          hasApplied: true,
                          applicationStatus: 'APPLIED',
                          applicationId: res.id,
                        }));
                      } catch (err) {
                        alert(err.message || 'Could not track application.');
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stormy-border hover:border-stormy-slate bg-white text-xs font-semibold text-stormy-dark transition-colors shadow-subtle"
                  >
                    <span>+ Track this application in ATS</span>
                  </button>

                  <p className="text-[11px] text-stormy-muted leading-tight text-center">
                    You will be directed to the verified external job board to complete your application.
                  </p>
                </div>
              )}
            </div>

            {/* Overview Details Box */}
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card space-y-4 text-xs">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider pb-2 border-b border-stormy-border">
                Position Details
              </h2>

              <div className="space-y-3">
                <div>
                  <span className="font-semibold text-stormy-muted block">Location</span>
                  <span className="font-medium text-stormy-main">{locationDisplay}</span>
                </div>

                <div>
                  <span className="font-semibold text-stormy-muted block">Compensation</span>
                  <span className="font-bold text-stormy-dark">
                    {salaryDisplay || 'Undisclosed'}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-stormy-muted block">Work Arrangement</span>
                  <span className="font-medium text-stormy-main">
                    {job.workArrangement.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-stormy-muted block">Remote Eligibility</span>
                  <span className="font-medium text-stormy-main">
                    {job.remoteEligibility || 'Unspecified eligibility'}
                  </span>
                </div>

                <div>
                  <span className="font-semibold text-stormy-muted block">Date Published</span>
                  <span className="font-medium text-stormy-main">
                    {publishedDateFormatted || 'Recently added'}
                  </span>
                </div>

                {closingDateFormatted && (
                  <div>
                    <span className="font-semibold text-stormy-muted block">Application Deadline</span>
                    <span className="font-bold text-stormy-slate">
                      {closingDateFormatted}
                    </span>
                  </div>
                )}

                {job.originalUrl && (
                  <div className="pt-2 border-t border-stormy-border">
                    <span className="font-semibold text-stormy-muted block">Source Posting</span>
                    <a
                      href={job.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stormy-sky hover:underline break-all inline-flex items-center gap-1 mt-0.5"
                    >
                      View on {job.source?.name || 'original platform'} &rarr;
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Internal Application Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-elevated space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-stormy-main">
                  Apply for {job.title}
                </h3>
                <p className="text-xs text-stormy-muted mt-0.5">
                  Submitting application as {user?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-stormy-muted hover:text-stormy-dark p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {applyError && (
              <Alert variant="danger">
                {applyError}
              </Alert>
            )}

            {applySuccess ? (
              <div className="p-4 rounded-xl bg-feedback-success-bg border border-feedback-success-border text-center space-y-2">
                <span className="text-sm font-bold text-feedback-success-text">
                  Application Successfully Submitted!
                </span>
                <p className="text-xs text-stormy-muted">
                  Your application is now recorded and visible in your application history.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplicationSubmit} className="space-y-4">
                <div>
                  <label htmlFor="cover-note" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                    Cover Note / Introductory Message (Optional)
                  </label>
                  <textarea
                    id="cover-note"
                    rows={4}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Briefly explain your relevant qualifications and interest in this role..."
                    className="w-full bg-white border border-stormy-border rounded-xl p-3 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                  />
                  <p className="text-[11px] text-stormy-muted mt-1">
                    Your profile contact details will be automatically attached to this submission.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsApplyModalOpen(false)}
                    disabled={isSubmittingApp}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={isSubmittingApp}
                  >
                    Submit Application
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobDetailsPage() {
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
      <JobDetailsContent />
    </React.Suspense>
  );
}
