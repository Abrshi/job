'use client';

import React from 'react';

const STATUS_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'APPLIED', label: 'Applied' },
  { id: 'IN_REVIEW', label: 'In Review' },
  { id: 'INTERVIEW', label: 'Interview' },
  { id: 'OFFER', label: 'Offer' },
  { id: 'REJECTED', label: 'Declined' },
  { id: 'WITHDRAWN', label: 'Withdrawn' },
];

export function ApplicationFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  source,
  onSourceChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  countsByStatus = {},
}) {
  return (
    <div className="space-y-4">
      {/* Search and Top Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stormy-muted">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by job title, company, location, or notes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stormy-border bg-white text-sm text-stormy-main placeholder-stormy-muted focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-transparent transition-all shadow-subtle"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-stormy-muted hover:text-stormy-dark"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filters Group: Source, Sort, View Toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end md:self-auto">
          {/* Source Dropdown */}
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            aria-label="Filter by source"
            className="px-3 py-2.5 rounded-xl border border-stormy-border bg-white text-xs font-semibold text-stormy-dark focus:outline-none focus:ring-2 focus:ring-stormy-sky shadow-subtle cursor-pointer"
          >
            <option value="ALL">All Sources</option>
            <option value="PLATFORM">Platform Jobs</option>
            <option value="EXTERNAL">External Jobs</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort applications"
            className="px-3 py-2.5 rounded-xl border border-stormy-border bg-white text-xs font-semibold text-stormy-dark focus:outline-none focus:ring-2 focus:ring-stormy-sky shadow-subtle cursor-pointer"
          >
            <option value="newest">Newest Applied</option>
            <option value="oldest">Oldest Applied</option>
            <option value="company_asc">Company (A-Z)</option>
          </select>

          {/* View Mode Toggle: List vs Board */}
          <div className="inline-flex rounded-xl border border-stormy-border bg-white p-1 shadow-subtle">
            <button
              type="button"
              onClick={() => onViewModeChange('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'LIST'
                  ? 'bg-stormy-sky text-stormy-dark shadow-xs'
                  : 'text-stormy-muted hover:text-stormy-dark'
              }`}
              title="List View (Primary)"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('BOARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'BOARD'
                  ? 'bg-stormy-sky text-stormy-dark shadow-xs'
                  : 'text-stormy-muted hover:text-stormy-dark'
              }`}
              title="Kanban Board View"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Filter Horizontal Scrolling Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.id;
          const count = countsByStatus[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusChange(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                isActive
                  ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                  : 'bg-white border-stormy-border text-stormy-dark hover:border-stormy-slate hover:bg-stormy-canvas'
              }`}
            >
              <span>{tab.label}</span>
              {typeof count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

