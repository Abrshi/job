'use client';

import React, { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Fatal global error:', error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex items-center justify-center bg-[#F8FAFC] text-[#0F172A] p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-lg text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#EF4444]">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-[#0F172A] mb-2">Critical Application Error</h1>
          <p className="text-sm text-[#475569] mb-6 leading-relaxed">
            A critical error prevented the application from loading. Please try reloading the page.
          </p>

          {error?.digest && (
            <div className="mb-6 p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-mono text-[#475569] break-all">
              <span className="font-semibold text-[#384959]">Error ID:</span> {error.digest}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full py-2.5 px-4 rounded-lg bg-[#384959] hover:bg-[#293642] text-white text-sm font-medium transition cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-lg border border-[#E2E8F0] bg-transparent text-[#384959] text-sm font-medium hover:bg-[#F8FAFC] transition cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
