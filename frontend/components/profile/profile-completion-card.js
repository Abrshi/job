'use client';

import React, { useState } from 'react';

export function ProfileCompletionCard({ completion, onNavigateSection }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!completion) return null;

  const { percentage = 0, isComplete = false, sections = [], nextAction } = completion;

  // Color dynamic gradient
  const getBadgeColor = (pct) => {
    if (pct >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (pct >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getBarColor = (pct) => {
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs mb-8 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Profile Strength</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getBadgeColor(
                percentage
              )}`}
            >
              {isComplete ? 'All-Star Profile' : percentage >= 50 ? 'Intermediate' : 'Getting Started'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Complete your profile to unlock 1-click tailored applications, automated CV generation, and top employer visibility.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-3xl font-extrabold text-gray-900">{percentage}%</span>
          <span className="text-xs text-gray-400 block">Completed</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Next Recommended Action Banner */}
      {nextAction && (
        <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Recommended Next Step</p>
              <p className="text-sm text-blue-950 font-medium">{nextAction.recommendation}</p>
            </div>
          </div>
          {onNavigateSection && (
            <button
              onClick={() => onNavigateSection(nextAction.sectionId)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Complete Now →
            </button>
          )}
        </div>
      )}

      {/* Toggle Details Breakdown */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          {sections.filter((s) => s.completed).length} of {sections.length} core sections completed
        </span>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
        >
          {showBreakdown ? 'Hide Breakdown ▲' : 'View Section Breakdown ▼'}
        </button>
      </div>

      {/* Collapsible Section Checklist */}
      {showBreakdown && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((s) => (
            <div
              key={s.id}
              onClick={() => onNavigateSection && onNavigateSection(s.id)}
              className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {s.completed ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-gray-300 text-gray-400 flex items-center justify-center shrink-0 text-[10px]">
                    ○
                  </div>
                )}
                <div>
                  <p className={`text-xs font-medium ${s.completed ? 'text-gray-900' : 'text-gray-600'}`}>
                    {s.title}
                  </p>
                  {!s.completed && s.missingFields.length > 0 && (
                    <p className="text-[11px] text-gray-400">{s.missingFields[0]}</p>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-gray-400">{s.earned} / {s.weight} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

