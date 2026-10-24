'use client';

import React from 'react';
import { AuthCard } from '@/components/auth-card';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md mx-auto">
      <AuthCard initialTab="forgot-password" />
    </div>
  );
}
