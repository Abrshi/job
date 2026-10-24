'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { AuthCard } from '@/components/auth-card';

export default function RegisterPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if authenticated AND email has been verified
    if (!loading && isAuthenticated && user && user.isEmailVerified) {
      const target = user.role === 'ADMIN' ? '/admin' : '/jobs';
      router.replace(target);
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="w-full max-w-md mx-auto">
      <AuthCard initialTab="register" />
    </div>
  );
}
