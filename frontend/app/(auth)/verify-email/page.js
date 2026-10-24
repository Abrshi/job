'use client';

import React, { Suspense } from 'react';
import { AuthCard } from '@/components/auth-card';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 flex items-center justify-center text-stormy-muted">
          Loading verification...
        </div>
      }
    >
      <div className="w-full max-w-md mx-auto">
        <AuthCard initialTab="verify-email" />
      </div>
    </Suspense>
  );
}
