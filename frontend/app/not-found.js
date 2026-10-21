import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-stormy-card border border-stormy-border rounded-2xl p-8 shadow-card text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-stormy-mist/40 border border-stormy-sky/30 flex items-center justify-center text-stormy-dark">
          <span className="text-2xl font-bold font-mono">404</span>
        </div>

        <h1 className="text-xl font-bold text-stormy-main mb-2">Page Not Found</h1>
        <p className="text-sm text-stormy-muted mb-6 leading-relaxed">
          The page you are looking for doesn&apos;t exist or may have been moved.
        </p>

        <Link href="/">
          <Button variant="primary" className="w-full">
            Return to Homepage
          </Button>
        </Link>
      </div>
    </div>
  );
}
