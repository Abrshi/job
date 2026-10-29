'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function formatSalary(min, max, currency = 'ETB', period) {
  if (!min && !max) return null;
  const curr = currency || 'ETB';
  const per = period ? `/${period.toLowerCase().replace('ly', '').slice(0, 2)}` : '';

  const formatNum = (num) => {
    const val = Number(num);
    return isNaN(val) ? num : val.toLocaleString();
  };

  if (min && max && Number(min) !== Number(max)) {
    return `${formatNum(min)} - ${formatNum(max)} ${curr}${per}`;
  }
  return `${formatNum(min || max)} ${curr}${per}`;
}

export function formatRelativeTime(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Returns brand metadata, clean logo icon, and subtle background tint classes for job sources
 */
export function getSourceTheme(source) {
  const raw = (typeof source === 'string' ? source : (source?.slug || source?.name || '')).toLowerCase();

  // 1. LinkedIn: #4D9D8F
  if (raw.includes('linkedin')) {
    return {
      name: 'LinkedIn',
      slug: 'linkedin',
      color: '#4D9D8F',
      logoUrl: '/linkedin.png',
      // Very thin subtle tint with #4D9D8F
      cardClasses: 'bg-[#4D9D8F]/[0.04] hover:bg-[#4D9D8F]/[0.08] border-[#4D9D8F]/25 hover:border-[#4D9D8F]/60',
      badgeClasses: 'bg-white text-[#215E55] border-[#4D9D8F]/40 shadow-2xs',
      bottomLogo: (
        <img
          src="/linkedin.png"
          alt="LinkedIn"
          className="w-full h-full object-contain rounded-sm"
          loading="lazy"
        />
      ),
      icon: (
        <img
          src="/linkedin.png"
          alt="LinkedIn"
          className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
          loading="lazy"
        />
      ),
    };
  }

  // 2. Afriwork: #E74B60
  if (raw.includes('afriwork')) {
    return {
      name: 'Afriwork',
      slug: 'afriwork',
      color: '#E74B60',
      logoUrl: '/afriwork.png',
      // Very thin subtle tint with #E74B60
      cardClasses: 'bg-[#E74B60]/[0.04] hover:bg-[#E74B60]/[0.08] border-[#E74B60]/25 hover:border-[#E74B60]/60',
      badgeClasses: 'bg-white text-[#AD1F35] border-[#E74B60]/40 shadow-2xs',
      bottomLogo: (
        <img
          src="/afriwork-icon.png"
          alt="Afriwork"
          className="w-full h-full object-contain rounded-sm"
          loading="lazy"
        />
      ),
      icon: (
        <img
          src="/afriwork-icon.png"
          alt="Afriwork"
          className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
          loading="lazy"
        />
      ),
    };
  }

  // 3. HaHuJobs: #4D9D8F
  if (raw.includes('hahu')) {
    return {
      name: 'HaHuJobs',
      slug: 'hahujobs',
      color: '#4D9D8F',
      logoUrl: '/hahujob.jpeg',
      // Very thin subtle tint with #4D9D8F
      cardClasses: 'bg-[#4D9D8F]/[0.04] hover:bg-[#4D9D8F]/[0.08] border-[#4D9D8F]/25 hover:border-[#4D9D8F]/60',
      badgeClasses: 'bg-white text-[#215E55] border-[#4D9D8F]/40 shadow-2xs',
      bottomLogo: (
        <img
          src="/hahujob.jpeg"
          alt="HaHuJobs"
          className="w-full h-full object-contain rounded-sm"
          loading="lazy"
        />
      ),
      icon: (
        <img
          src="/hahujob.jpeg"
          alt="HaHuJobs"
          className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
          loading="lazy"
        />
      ),
    };
  }

  // 4. Ethiojobs: #62BC8B
  if (raw.includes('ethiojob')) {
    return {
      name: 'Ethiojobs',
      slug: 'ethiojobs',
      color: '#62BC8B',
      logoUrl: '/Ethiojobs.webp',
      // Very thin subtle tint with #62BC8B
      cardClasses: 'bg-[#62BC8B]/[0.04] hover:bg-[#62BC8B]/[0.08] border-[#62BC8B]/25 hover:border-[#62BC8B]/60',
      badgeClasses: 'bg-white text-[#256B47] border-[#62BC8B]/40 shadow-2xs',
      bottomLogo: (
        <img
          src="/ethiojobs-icon.webp"
          alt="Ethiojobs"
          className="w-full h-full object-contain rounded-sm"
          loading="lazy"
        />
      ),
      icon: (
        <img
          src="/ethiojobs-icon.webp"
          alt="Ethiojobs"
          className="w-3.5 h-3.5 object-contain rounded-xs shrink-0"
          loading="lazy"
        />
      ),
    };
  }

  // 5. GeezJobs
  if (raw.includes('geez')) {
    return {
      name: 'GeezJobs',
      slug: 'geezjobs',
      color: '#2563EB',
      logoUrl: null,
      cardClasses: 'bg-[#2563EB]/[0.03] hover:bg-[#2563EB]/[0.06] border-indigo-100/90 hover:border-[#2563EB]/50',
      badgeClasses: 'bg-white text-[#2563EB] border-indigo-200/80 shadow-2xs',
      bottomLogo: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="5" fill="#2563EB" />
          <path d="M12 5L15 12H9L12 5ZM12 19L9 12H15L12 19Z" fill="white" />
        </svg>
      ),
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="5" fill="#2563EB" />
          <path d="M12 5L15 12H9L12 5ZM12 19L9 12H15L12 19Z" fill="white" />
        </svg>
      ),
    };
  }

  if (!raw) return null;

  return {
    name: source?.name || source || 'Platform',
    slug: source?.slug || 'direct',
    color: '#64748B',
    cardClasses: 'bg-white hover:bg-slate-50/50 border-stormy-border hover:border-stormy-sky',
    badgeClasses: 'bg-slate-100 text-stormy-muted border-slate-200',
    bottomLogo: (
      <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  };
}

export function JobCard({
  job,
  onToggleSave,
  isSavePending = false,
  showRemoveButton = false,
}) {
  const router = useRouter();

  const salaryDisplay = formatSalary(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod
  );

  const formattedDate = formatRelativeTime(job.publishedAt || job.firstSeenAt);
  const locationDisplay = [job.city, job.country].filter(Boolean).join(', ') || 'Location Unspecified';
  const sourceConfig = getSourceTheme(job.source || job.sourceSlug);

  const arrangementLabels = {
    REMOTE: { label: 'Remote', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    HYBRID: { label: 'Hybrid', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
    ON_SITE: { label: 'On-site', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const arrangement = arrangementLabels[job.workArrangement] || arrangementLabels.ON_SITE;

  const empTypeLabels = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship',
    FREELANCE: 'Freelance',
  };

  const expLevelLabels = {
    ENTRY: 'Entry Level',
    JUNIOR: 'Junior',
    MID: 'Mid Level',
    SENIOR: 'Senior',
    LEAD: 'Lead',
    EXECUTIVE: 'Executive',
  };

  return (
    <div
      onClick={() => router.push(`/jobs/${job.id}`)}
      className={`group relative rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-card cursor-pointer select-none ${
        sourceConfig?.cardClasses || 'bg-white border-stormy-border hover:border-stormy-sky hover:bg-slate-50/50'
      }`}
    >
      {/* Stretched Link for keyboard accessibility and middle/command click */}
      <Link
        href={`/jobs/${job.id}`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`View details for ${job.title}`}
        tabIndex={-1}
      />

      <div>
        {/* Top bar: Source Name (without logo) + Category + Date + Save control */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {sourceConfig && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${sourceConfig.badgeClasses}`}
                title={`Job vacancy sourced from ${sourceConfig.name}`}
              >
                {sourceConfig.name}
              </span>
            )}
            {job.category?.name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-stormy-mist/40 text-stormy-dark border border-stormy-mist/60">
                {job.category.name}
              </span>
            )}
            {formattedDate && (
              <span className="text-xs text-stormy-muted">
                {formattedDate}
              </span>
            )}
          </div>

          {/* Save / Bookmark Button */}
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(job);
              }}
              disabled={isSavePending}
              className={`relative z-10 p-2 rounded-lg transition-colors cursor-pointer ${
                job.isSaved
                  ? 'text-stormy-sky bg-stormy-mist/30 hover:bg-stormy-mist/50'
                  : 'text-stormy-muted hover:text-stormy-dark hover:bg-stormy-canvas'
              }`}
              title={job.isSaved ? 'Remove from saved jobs' : 'Save job'}
              aria-label={job.isSaved ? 'Remove from saved jobs' : 'Save job'}
            >
              <svg
                className="w-4 h-4"
                fill={job.isSaved ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Title and Company */}
        <div className="block">
          <h3 className="text-base sm:text-lg font-bold text-stormy-main group-hover:text-stormy-slate transition-colors line-clamp-2">
            {job.title}
          </h3>
          <p className="text-sm font-medium text-stormy-muted mt-1 line-clamp-1">
            {job.companyName || 'Confidential Employer'}
          </p>
        </div>

        {/* Badges strip: Arrangement, Type, Exp, Location */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pointer-events-none">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${arrangement.bg}`}
          >
            {arrangement.label}
          </span>

          {job.employmentType && empTypeLabels[job.employmentType] && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {empTypeLabels[job.employmentType]}
            </span>
          )}

          {job.experienceLevel && expLevelLabels[job.experienceLevel] && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {expLevelLabels[job.experienceLevel]}
            </span>
          )}

          <span className="inline-flex items-center gap-1 text-xs text-stormy-muted px-1 py-0.5">
            <svg className="w-3.5 h-3.5 text-stormy-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {locationDisplay}
          </span>
        </div>
      </div>

      {/* Footer: Salary on left + Source Logo on bottom right (Details button removed) */}
      <div className="mt-4 pt-3 border-t border-stormy-border/70 flex items-center justify-between text-xs pointer-events-none">
        <div>
          {salaryDisplay ? (
            <span className="font-bold text-stormy-dark">
              {salaryDisplay}
            </span>
          ) : (
            <span className="text-stormy-muted italic">
              Salary Undisclosed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {job.applicationMethod === 'INTERNAL' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border">
              Quick Apply
            </span>
          )}
          {sourceConfig?.bottomLogo && (
            <div
              className="w-7 h-7 rounded-lg bg-white border border-black/10 shadow-2xs p-1 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
              title={`Sourced from ${sourceConfig.name}`}
            >
              {sourceConfig.bottomLogo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

