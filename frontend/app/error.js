'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled segment error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-stormy-card border border-stormy-border rounded-2xl p-8 shadow-card text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-feedback-danger-bg border border-feedback-danger-border flex items-center justify-center text-feedback-danger">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-stormy-main mb-2">Something went wrong</h1>
        <p className="text-sm text-stormy-muted mb-6 leading-relaxed">
          {error?.message && !error.message.includes('digest')
            ? error.message
            : 'An unexpected application error occurred. We apologize for the inconvenience.'}
        </p>

        {error?.digest && (
          <div className="mb-6 p-2.5 bg-stormy-canvas border border-stormy-border rounded-lg text-xs font-mono text-stormy-muted break-all">
            <span className="font-semibold text-stormy-dark">Error ID:</span> {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={() => reset()}>
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
