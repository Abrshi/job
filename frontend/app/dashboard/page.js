'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function UniversalDashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace('/?auth=login&returnUrl=/dashboard');
      } else {
        router.replace('/profile');
      }
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen bg-stormy-canvas flex flex-col items-center justify-center p-6 space-y-4">
      <div className="w-12 h-12 border-4 border-stormy-sky border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium text-stormy-muted animate-pulse">
        Navigating to your dashboard...
      </p>
    </div>
  );
}
