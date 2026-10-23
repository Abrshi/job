'use client';

import React from 'react';

export function ApplicationStatsCards({ stats, isLoading = false, onSelectStatusFilter }) {
  const cards = [
    {
      id: 'TOTAL',
      label: 'Total Applications',
      value: stats?.totalApplications ?? 0,
      icon: (
        <svg className="w-5 h-5 text-stormy-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      subtext: `${stats?.bySource?.PLATFORM ?? 0} platform · ${stats?.bySource?.EXTERNAL ?? 0} external`,
      statusFilter: 'ALL',
      borderHover: 'hover:border-stormy-sky',
    },
    {
      id: 'ACTIVE',
      label: 'Active Applications',
      value: stats?.activeApplications ?? 0,
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      subtext: `${stats?.byStatus?.IN_REVIEW ?? 0} in active review`,
      statusFilter: 'ACTIVE',
      borderHover: 'hover:border-blue-400',
    },
    {
      id: 'INTERVIEW',
      label: 'Interviews Scheduled',
      value: stats?.interviewsScheduled ?? (stats?.byStatus?.INTERVIEW ?? 0),
      icon: (
        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      subtext: 'Rounds pending debrief',
      statusFilter: 'INTERVIEW',
      borderHover: 'hover:border-purple-400',
    },
    {
      id: 'OFFER',
      label: 'Offers Received',
      value: stats?.offersReceived ?? (stats?.byStatus?.OFFER ?? 0),
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      subtext: 'Ready for decision',
      statusFilter: 'OFFER',
      borderHover: 'hover:border-emerald-400',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-stormy-border rounded-2xl p-5 shadow-subtle animate-pulse space-y-3"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200" />
            <div className="w-12 h-6 bg-slate-200 rounded" />
            <div className="w-24 h-3 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelectStatusFilter && onSelectStatusFilter(card.statusFilter)}
          className={`bg-white border border-stormy-border rounded-2xl p-5 shadow-subtle transition-all text-left group cursor-pointer ${card.borderHover}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stormy-muted uppercase tracking-wider">
              {card.label}
            </span>
            <div className="p-2 rounded-xl bg-stormy-canvas border border-stormy-border/60 group-hover:scale-105 transition-transform">
              {card.icon}
            </div>
          </div>
          <div className="text-2xl font-extrabold text-stormy-main tracking-tight">
            {card.value}
          </div>
          <p className="text-[11px] text-stormy-slate mt-1 font-medium truncate">
            {card.subtext}
          </p>
        </button>
      ))}
    </div>
  );
}

