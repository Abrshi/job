'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AuthCard } from '@/components/auth-card';

export default function LoginPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const target = user.role === 'ADMIN' ? '/admin' : '/profile';
      router.replace(target);
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <AuthCard initialTab="login" />
    </div>
  );
}
