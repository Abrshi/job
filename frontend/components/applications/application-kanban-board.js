'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from './status-badge';

const COLUMNS = [
  { id: 'DRAFT', title: 'Wishlist & Drafts', color: 'border-slate-300 bg-slate-50/50' },
  { id: 'APPLIED', title: 'Applied', color: 'border-blue-200 bg-blue-50/30' },
  { id: 'IN_REVIEW', title: 'In Review', color: 'border-amber-200 bg-amber-50/30' },
  { id: 'INTERVIEW', title: 'Interviewing', color: 'border-purple-200 bg-purple-50/30' },
  { id: 'OFFER', title: 'Offers', color: 'border-emerald-200 bg-emerald-50/30' },
];

export function ApplicationKanbanBoard({
  applications = [],
  onOpenStatusModal,
  onOpenInterviewModal,
}) {
  const [showArchived, setShowArchived] = useState(false);

  const getAppsForColumn = (status) => {
    return applications.filter((app) => app.status === status);
  };

  const terminalApps = applications.filter((app) =>
    ['REJECTED', 'WITHDRAWN'].includes(app.status)
  );

  return (
    <div className="space-y-6">
      {/* 5-Column Responsive Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colApps = getAppsForColumn(col.id);

          return (
            <div
              key={col.id}
              className={`border rounded-2xl p-3 flex flex-col gap-3 min-h-[360px] ${col.color}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-stormy-border/60 px-1">
                <span className="text-xs font-bold text-stormy-dark uppercase tracking-wider">
                  {col.title}
                </span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white border border-stormy-border text-stormy-dark">
                  {colApps.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-2.5 flex-1">
                {colApps.length === 0 ? (
                  <div className="h-28 border border-dashed border-stormy-border/80 rounded-xl flex items-center justify-center text-[11px] text-stormy-muted text-center p-2">
                    No applications in this stage
                  </div>
                ) : (
                  colApps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white border border-stormy-border rounded-xl p-3.5 shadow-subtle hover:border-stormy-slate hover:shadow-card transition-all space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <Link
                          href={`/jobs/applications/${app.id}`}
                          className="font-bold text-stormy-main hover:text-stormy-sky line-clamp-1"
                        >
                          {app.title || app.jobTitle}
                        </Link>
                      </div>

                      <p className="font-semibold text-stormy-slate truncate">
                        {app.companyName}
                      </p>

                      {app.location && (
                        <p className="text-[11px] text-stormy-muted truncate">
                          📍 {app.location}
                        </p>
                      )}

                      {app.nextInterview && (
                        <div className="p-1.5 rounded-lg bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-semibold truncate">
                          🗓 {app.nextInterview.title}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-stormy-border/60">
                        <span className="text-[10px] text-stormy-muted">
                          {app.source === 'PLATFORM' ? 'Platform' : 'External'}
                        </span>

                        <button
                          type="button"
                          onClick={() => onOpenStatusModal(app)}
                          className="text-[10px] font-bold text-stormy-sky hover:underline"
                        >
                          Move &rarr;
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Drawer (Declined & Withdrawn) */}
      <div className="border border-stormy-border rounded-2xl bg-white p-4 shadow-subtle space-y-3">
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className="flex items-center justify-between w-full text-xs font-bold text-stormy-dark hover:text-stormy-main"
        >
          <div className="flex items-center gap-2">
            <span>Declined & Withdrawn Applications ({terminalApps.length})</span>
            <span className="text-[10px] text-stormy-muted font-normal">
              — Retained for full historical reference
            </span>
          </div>
          <span>{showArchived ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {showArchived && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-stormy-border">
            {terminalApps.length === 0 ? (
              <p className="text-xs text-stormy-muted italic col-span-3">
                No declined or withdrawn applications.
              </p>
            ) : (
              terminalApps.map((app) => (
                <div
                  key={app.id}
                  className="p-3 rounded-xl border border-stormy-border bg-stormy-canvas text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <Link
                      href={`/jobs/applications/${app.id}`}
                      className="font-bold text-stormy-main hover:underline truncate"
                    >
                      {app.title || app.jobTitle}
                    </Link>
                    <StatusBadge status={app.status} size="sm" />
                  </div>
                  <p className="text-stormy-muted truncate">{app.companyName}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
