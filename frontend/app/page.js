'use client';

import React from 'react';
import { Navbar } from '@/components/navbar';
import { AuthCard } from '@/components/auth-card';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      <main className="flex-1 flex flex-col justify-center">
        {/* Split Hero Section */}
        <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Platform Value & Messaging */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-stormy-mist/50 text-stormy-dark border border-stormy-mist">
                <span className="w-2 h-2 rounded-full bg-stormy-sky animate-pulse" />
                Intelligent Multi-Source Job Aggregator
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl xl:text-6xl font-extrabold text-stormy-main tracking-tight leading-tight sm:leading-tight">
                Find and track every opportunity in{' '}
                <span className="text-stormy-slate">one focused workspace</span>.
              </h1>

              <p className="text-base sm:text-lg text-stormy-muted max-w-2xl mx-auto lg:mx-0">
                Stop checking dozens of separate job sites every morning. Discover aggregated listings, personalized matches, and manage your pipeline in one clean interface.
              </p>

              {/* Action Links */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
                <a
                  href="/jobs"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stormy-dark hover:bg-stormy-darkHover text-white font-bold text-sm shadow-subtle transition-colors"
                >
                  <span>Browse Open Jobs</span>
                  <span>&rarr;</span>
                </a>
                <a
                  href="#auth-card"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stormy-border bg-white hover:border-stormy-slate text-xs font-semibold text-stormy-dark transition-colors"
                >
                  Sign In / Register
                </a>
              </div>

              {/* Value Highlights */}
              <div className="pt-2 space-y-3 max-w-lg mx-auto lg:mx-0 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-feedback-success-bg border border-feedback-success-border flex items-center justify-center text-feedback-success flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-stormy-main font-medium">
                    Unified search across 50+ global boards with live deduping
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-feedback-success-bg border border-feedback-success-border flex items-center justify-center text-feedback-success flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-stormy-main font-medium">
                    Secure in-memory session protection with Argon2id password hashing
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-feedback-success-bg border border-feedback-success-border flex items-center justify-center text-feedback-success flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-stormy-main font-medium">
                    Role-tailored dashboards for Candidates and Employers
                  </span>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="pt-4 grid grid-cols-3 gap-4 border-t border-stormy-border/80 max-w-md mx-auto lg:mx-0">
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-stormy-dark">10k+</div>
                  <div className="text-xs text-stormy-muted font-medium">Active Listings</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-stormy-dark">50+</div>
                  <div className="text-xs text-stormy-muted font-medium">Partner Boards</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-stormy-dark">100%</div>
                  <div className="text-xs text-stormy-muted font-medium">Verified Accounts</div>
                </div>
              </div>
            </div>

            {/* Right Column: Embedded Sliding Auth Card */}
            <div className="lg:col-span-5 w-full flex justify-center lg:justify-end">
              <div id="auth-card" className="w-full max-w-md">
                <AuthCard />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
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
