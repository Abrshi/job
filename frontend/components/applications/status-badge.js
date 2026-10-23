'use client';

import React from 'react';

export const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-500',
    description: 'Application prepared but not yet submitted',
  },
  APPLIED: {
    label: 'Applied',
    badgeClass: 'bg-[#F0F7FF] text-[#1E3A5F] border-[#BDDDFC]',
    dotClass: 'bg-[#1E3A5F]',
    description: 'Submitted to employer',
  },
  IN_REVIEW: {
    label: 'In Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-600',
    description: 'Under active screening by recruiter/hiring team',
  },
  INTERVIEW: {
    label: 'Interview',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    dotClass: 'bg-purple-600',
    description: 'One or more interview rounds scheduled or underway',
  },
  OFFER: {
    label: 'Offer',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotClass: 'bg-emerald-600',
    description: 'Formal job offer extended',
  },
  REJECTED: {
    label: 'Declined',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    dotClass: 'bg-rose-600',
    description: 'Application declined by employer or candidate',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
    description: 'Voluntarily retracted by candidate',
  },
};

export function StatusBadge({ status, size = 'md', showDot = true }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.APPLIED;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide transition-colors ${
        config.badgeClass
      } ${sizeClasses[size] || sizeClasses.md}`}
      title={config.description}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dotClass} ${
            ['IN_REVIEW', 'INTERVIEW'].includes(status) ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}

