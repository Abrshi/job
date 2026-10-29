'use client';

import React from 'react';
import Link from 'next/link';

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

  // 1. LinkedIn
  if (raw.includes('linkedin')) {
    return {
      name: 'LinkedIn',
      slug: 'linkedin',
      logoUrl: '/linkedin.png',
      // Very thin subtle sky/blue tint
      cardClasses: 'bg-[#F8FAFD] hover:bg-[#F2F6FC] border-sky-100/90 hover:border-[#0A66C2]/40',
      badgeClasses: 'bg-white text-[#0A66C2] border-sky-200/80 shadow-2xs',
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

  // 2. Afriwork
  if (raw.includes('afriwork')) {
    return {
      name: 'Afriwork',
      slug: 'afriwork',
      logoUrl: '/afriwork.png',
      // Very thin subtle warm amber tint
      cardClasses: 'bg-[#FFFDF7] hover:bg-[#FFF9EC] border-amber-100/90 hover:border-[#F59E0B]/50',
      badgeClasses: 'bg-white text-amber-700 border-amber-200/80 shadow-2xs',
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

  // 3. HaHuJobs
  if (raw.includes('hahu')) {
    return {
      name: 'HaHuJobs',
      slug: 'hahujobs',
      logoUrl: '/hahujob.jpeg',
      // Very thin subtle mint/emerald tint
      cardClasses: 'bg-[#F7FDF9] hover:bg-[#EEFAF2] border-emerald-100/90 hover:border-[#10B981]/50',
      badgeClasses: 'bg-white text-emerald-700 border-emerald-200/80 shadow-2xs',
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

  // 4. Ethiojobs
  if (raw.includes('ethiojob')) {
    return {
      name: 'Ethiojobs',
      slug: 'ethiojobs',
      logoUrl: '/Ethiojobs.webp',
      // Very thin subtle rose/crimson tint
      cardClasses: 'bg-[#FFF9F9] hover:bg-[#FFF0F0] border-rose-100/90 hover:border-[#E11D48]/40',
      badgeClasses: 'bg-white text-rose-700 border-rose-200/80 shadow-2xs',
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
      logoUrl: null,
      // Very thin subtle indigo tint
      cardClasses: 'bg-[#F8F9FE] hover:bg-[#F0F2FD] border-indigo-100/90 hover:border-[#4F46E5]/40',
      badgeClasses: 'bg-white text-indigo-700 border-indigo-200/80 shadow-2xs',
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
    cardClasses: 'bg-white hover:bg-slate-50/50 border-stormy-border hover:border-stormy-sky',
    badgeClasses: 'bg-slate-100 text-stormy-muted border-slate-200',
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
      className={`group relative rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-2xs hover:shadow-card ${
        sourceConfig?.cardClasses || 'bg-white border-stormy-border hover:border-stormy-sky hover:bg-slate-50/50'
      }`}
    >
      <div>
        {/* Top bar: Source with Logo + Category + Date + Save control */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {sourceConfig && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${sourceConfig.badgeClasses}`}
                title={`Job vacancy sourced from ${sourceConfig.name}`}
              >
                {sourceConfig.icon}
                <span>{sourceConfig.name}</span>
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
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
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
        <Link href={`/jobs/${job.id}`} className="block focus:outline-none">
          <h3 className="text-base sm:text-lg font-bold text-stormy-main group-hover:text-stormy-slate transition-colors line-clamp-2">
            {job.title}
          </h3>
          <p className="text-sm font-medium text-stormy-muted mt-1 line-clamp-1">
            {job.companyName || 'Confidential Employer'}
          </p>
        </Link>

        {/* Badges strip: Arrangement, Type, Exp, Location */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
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

      {/* Footer: Salary + Details Link */}
      <div className="mt-4 pt-3 border-t border-stormy-border/70 flex items-center justify-between text-xs">
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
          <Link
            href={`/jobs/${job.id}`}
            className="text-xs font-semibold text-stormy-sky hover:text-stormy-skyHover transition-colors flex items-center gap-1 group-hover:translate-x-0.5 duration-150"
          >
            Details &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

