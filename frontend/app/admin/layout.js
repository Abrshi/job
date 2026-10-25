'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminLegacyRedirectLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 text-sky-600 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Admin Console Has Moved</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          The administrative control console is now hosted on its own independent application. Please access the dedicated administration portal on port 3001.
        </p>
        <div className="pt-2 flex flex-col gap-2">
          <a
            href="http://localhost:3001"
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
          >
            Open Admin Portal (Port 3001) &rarr;
          </a>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
          >
            &larr; Return to Job Seeker Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
