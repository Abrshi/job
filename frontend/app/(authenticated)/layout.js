import React from 'react';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';

export default function AuthenticatedLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
    </div>
  );
}

