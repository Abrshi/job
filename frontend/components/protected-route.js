'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const returnUrl = encodeURIComponent(pathname || '/profile');
      router.replace(`/login?returnUrl=${returnUrl}`);
    }
  }, [loading, isAuthenticated, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-stormy-sky border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-stormy-muted animate-pulse">
          Authenticating session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Avoid flashing protected contents while redirect is happening
    return null;
  }

  return children;
}
