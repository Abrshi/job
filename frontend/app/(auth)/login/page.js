'use client';

import React from 'react';
import { AuthCard } from '@/components/auth-card';

export default function LoginPage() {
  return (
    <div className="w-full max-w-md mx-auto">
      <AuthCard initialTab="login" />
    </div>
  );
}
