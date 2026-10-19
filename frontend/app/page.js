'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-stormy-mist/50 text-stormy-dark border border-stormy-mist mb-6">
            Intelligent Multi-Source Job Aggregator
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-stormy-main tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
            Find and track every opportunity in{' '}
            <span className="text-stormy-slate">one focused workspace</span>.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-stormy-muted max-w-2xl mx-auto">
            Stop searching across dozens of job boards. Discover aggregated listings, personalized recommendations, and manage your applications seamlessly.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {isAuthenticated ? (
              <Link href="/profile">
                <Button variant="cta" size="lg" className="w-full sm:w-auto">
                  Go to Profile ({user?.firstName || user?.email})
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button variant="cta" size="lg" className="w-full sm:w-auto">
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-stormy-main">Aggregated Search</h2>
              <p className="mt-2 text-sm text-stormy-muted">
                Public search and browsing works out of the box without requiring registration. Discover vacancies across global boards instantly.
              </p>
            </div>

            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-stormy-main">Verified Identity</h2>
              <p className="mt-2 text-sm text-stormy-muted">
                Secure Argon2id hashing, encrypted in-memory access tokens, and rotating HttpOnly session cookies ensure your data stays protected.
              </p>
            </div>

            <div className="bg-white border border-stormy-border rounded-2xl p-6 shadow-card hover:shadow-elevated transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-stormy-main">Role-Based Experiences</h2>
              <p className="mt-2 text-sm text-stormy-muted">
                Tailored interfaces for Candidates searching for jobs and Employers publishing opportunities with verified ownership.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stormy-border bg-white py-6 text-center text-xs text-stormy-muted">
        &copy; 2026 Job Platform. Stormy Morning Design System.
      </footer>
    </div>
  );
}
