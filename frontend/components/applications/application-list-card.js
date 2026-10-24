'use client';

import React from 'react';
import Link from 'next/link';
import { StatusBadge } from './status-badge';

export function ApplicationListCard({
  application,
  onOpenStatusModal,
  onOpenInterviewModal,
  onWithdraw,
  onDeleteDraft,
}) {
  const isDraft = application.status === 'DRAFT';
  const isWithdrawn = application.status === 'WITHDRAWN';
  const isTerminal = ['REJECTED', 'WITHDRAWN'].includes(application.status);

  const appliedDateFormatted = application.appliedAt
    ? new Date(application.appliedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const nextInterviewFormatted = application.nextInterview?.scheduledAt
    ? new Date(application.nextInterview.scheduledAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white border border-stormy-border rounded-2xl p-5 sm:p-6 shadow-subtle hover:border-stormy-slate transition-all space-y-4">
      {/* Top Row: Title, Company, Status Badge, Source Badge */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/jobs/applications/${application.id}`}
              className="text-base sm:text-lg font-bold text-stormy-main hover:text-stormy-sky transition-colors leading-tight"
            >
              {application.title || application.jobTitle || 'Untitled Position'}
            </Link>

            <StatusBadge status={application.status} size="sm" />

            {/* Source Pill */}
            {application.source === 'PLATFORM' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Platform Job</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <span>External</span>
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-stormy-slate">
            {application.companyName || 'Unknown Company'}
          </p>
        </div>

        {/* Applied Date */}
        {appliedDateFormatted && (
          <div className="text-left sm:text-right shrink-0">
            <span className="text-[11px] text-stormy-muted font-medium block">
              {isDraft ? 'Draft Created' : 'Applied on'}
            </span>
            <span className="text-xs font-bold text-stormy-dark">
              {appliedDateFormatted}
            </span>
          </div>
        )}
      </div>

      {/* Meta Strip: Location, Salary, Platform Link */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stormy-muted pt-1 border-t border-stormy-border/60">
        {(application.location || application.externalLocation) && (
          <div className="flex items-center gap-1 text-stormy-dark">
            <svg className="w-3.5 h-3.5 text-stormy-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{application.location || application.externalLocation}</span>
          </div>
        )}

        {(application.salary || application.externalSalary) && (
          <div className="flex items-center gap-1 font-semibold text-emerald-800">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{application.salary || application.externalSalary}</span>
          </div>
        )}

        {application.job?.id && (
          <Link
            href={`/jobs/${application.job.id}`}
            className="text-stormy-sky hover:underline flex items-center gap-1 font-medium"
          >
            <span>View Job Listing</span>
            <span>&rarr;</span>
          </Link>
        )}

        {application.jobUrl && !application.job?.id && (
          <a
            href={application.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stormy-sky hover:underline flex items-center gap-1 font-medium"
          >
            <span>External Vacancy Page</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Middle Banner: Next Upcoming Interview or CV snapshot */}
      <div className="flex flex-wrap items-center gap-2">
        {application.nextInterview && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold">
            <svg className="w-3.5 h-3.5 text-purple-700 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              Next Interview: {application.nextInterview.title} ({nextInterviewFormatted})
            </span>
          </div>
        )}

        {application.documentSnapshot && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium">
            <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="truncate max-w-[180px]">
              {application.documentSnapshot.filename}
            </span>
          </div>
        )}

        {application.interviewsCount > 0 && (
          <span className="text-xs text-stormy-muted font-medium">
            · {application.interviewsCount} round{application.interviewsCount === 1 ? '' : 's'} logged
          </span>
        )}

        {application.remindersCount > 0 && (
          <span className="text-xs text-stormy-muted font-medium">
            · {application.remindersCount} reminder{application.remindersCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stormy-border">
        <Link
          href={`/jobs/applications/${application.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stormy-sky/20 hover:bg-stormy-sky text-stormy-dark font-bold text-xs transition-colors"
        >
          <span>View Details & Timeline</span>
          <span>&rarr;</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Schedule Interview */}
          {!isTerminal && (
            <button
              type="button"
              onClick={() => onOpenInterviewModal(application)}
              className="px-2.5 py-1.5 rounded-xl border border-stormy-border hover:border-stormy-slate bg-white text-xs font-semibold text-stormy-dark transition-colors"
            >
              + Schedule Interview
            </button>
          )}

          {/* Quick Update Status */}
          <button
            type="button"
            onClick={() => onOpenStatusModal(application)}
            className="px-2.5 py-1.5 rounded-xl border border-stormy-border hover:border-stormy-slate bg-white text-xs font-semibold text-stormy-dark transition-colors"
          >
            Update Status
          </button>

          {/* Withdraw Application */}
          {!isWithdrawn && !isDraft && application.status !== 'REJECTED' && (
            <button
              type="button"
              onClick={() => onWithdraw(application)}
              className="px-2.5 py-1.5 rounded-xl border border-stormy-border hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-xs font-semibold text-stormy-muted transition-colors"
            >
              Withdraw
            </button>
          )}

          {/* Delete Draft Button */}
          {isDraft && (
            <button
              type="button"
              onClick={() => onDeleteDraft(application)}
              className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
            >
              Delete Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

