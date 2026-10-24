import React from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-stormy-canvas">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-stormy-dark flex items-center justify-center text-stormy-sky font-bold text-xl shadow-subtle group-hover:bg-stormy-darkHover transition-colors">
            J
          </div>
          <span className="font-bold text-2xl text-stormy-dark tracking-tight">
            Job<span className="text-stormy-sky">Platform</span>
          </span>
        </Link>
      </div>

      {/* Auth Card Container */}
      <div className="w-full max-w-md">
        {children}
      </div>

      {/* Footer Notice */}
      <div className="mt-8 text-center text-xs text-stormy-muted">
        Protected by industry-standard encryption and secure token authentication.
      </div>
    </div>
  );
}
