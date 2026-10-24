'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { JobCard } from '@/components/job-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJobs, fetchCategories, fetchSources, saveJob, unsaveJob } from '@/lib/jobs-api';
import { useAuth } from '@/hooks/use-auth';
import { SaveSearchModal } from '@/components/jobs/save-search-modal';

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [isPending, startTransition] = useTransition();

  // Data states
  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [savePendingIds, setSavePendingIds] = useState(new Set());
  const [authPromptJobId, setAuthPromptJobId] = useState(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Read filters from URL
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const source = searchParams.get('source') || '';
  const status = searchParams.get('status') || '';
  const category = searchParams.get('category') || '';
  const workArrangement = searchParams.get('workArrangement') || '';
  const employmentType = searchParams.get('employmentType') || '';
  const experienceLevel = searchParams.get('experienceLevel') || '';
  const city = searchParams.get('city') || '';
  const country = searchParams.get('country') || '';
  const minSalary = searchParams.get('minSalary') || '';
  const sortBy = searchParams.get('sortBy') || 'publishedAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  // Local search input state for smooth typing
  const [searchInput, setSearchInput] = useState(search);

  // Sync local search input with URL search when URL changes
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Load categories and sources once
  useEffect(() => {
    async function loadTaxonomies() {
      try {
        const [catList, srcList] = await Promise.all([
          fetchCategories().catch((err) => {
            console.error('Failed to load categories:', err);
            return [];
          }),
          fetchSources().catch((err) => {
            console.error('Failed to load sources:', err);
            return [];
          }),
        ]);

        setCategories(catList || []);
        if (srcList && srcList.length > 0) {
          setSources(srcList);
        } else {
          setSources([
            { slug: 'hahujobs', name: 'HaHuJobs' },
            { slug: 'afriwork', name: 'Afriwork' },
          ]);
        }
      } catch (err) {
        console.error('Failed to load taxonomies:', err);
        setSources([
          { slug: 'hahujobs', name: 'HaHuJobs' },
          { slug: 'afriwork', name: 'Afriwork' },
        ]);
      }
    }
    loadTaxonomies();
  }, []);

  // Update URL params helper
  const updateFilters = useCallback(
    (newParams) => {
      const current = new URLSearchParams(searchParams.toString());

      Object.entries(newParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          current.delete(key);
        } else {
          current.set(key, String(value));
        }
      });

      // Always reset to page 1 on filter changes unless page itself is explicitly updated
      if (!('page' in newParams)) {
        current.delete('page');
      }

      startTransition(() => {
        router.push(`/jobs?${current.toString()}`);
      });
    },
    [router, searchParams]
  );

  // Load jobs when URL parameters change
  useEffect(() => {
    let isCancelled = false;

    async function loadJobs() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchJobs({
          page,
          search,
          source,
          status,
          category,
          workArrangement,
          employmentType,
          experienceLevel,
          city,
          country,
          minSalary,
          sortBy,
          sortOrder,
          limit: 12,
        });

        if (!isCancelled) {
          setJobs(data.jobs || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Unable to load jobs. Please try again.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      isCancelled = true;
    };
  }, [
    page,
    search,
    source,
    status,
    category,
    workArrangement,
    employmentType,
    experienceLevel,
    city,
    country,
    minSalary,
    sortBy,
    sortOrder,
  ]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateFilters({ search: searchInput.trim() });
  };

  // Handle Save / Unsave
  const handleToggleSave = async (job) => {
    if (!isAuthenticated) {
      setAuthPromptJobId(job.id);
      return;
    }

    setSavePendingIds((prev) => new Set(prev).add(job.id));
    const nextSavedState = !job.isSaved;

    // Optimistic UI update
    setJobs((prevJobs) =>
      prevJobs.map((j) => (j.id === job.id ? { ...j, isSaved: nextSavedState } : j))
    );

    try {
      if (nextSavedState) {
        await saveJob(job.id);
      } else {
        await unsaveJob(job.id);
      }
    } catch (err) {
      // Revert optimistic update on failure
      setJobs((prevJobs) =>
        prevJobs.map((j) => (j.id === job.id ? { ...j, isSaved: !nextSavedState } : j))
      );
      console.error('Failed to update saved job status:', err);
    } finally {
      setSavePendingIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const handleClearAllFilters = () => {
    setSearchInput('');
    router.push('/jobs');
  };

  const handleOpenSaveModal = () => {
    if (!isAuthenticated) {
      router.push('/#auth-card');
      return;
    }
    setIsSaveModalOpen(true);
  };

  const activeFiltersCount = [
    source,
    category,
    status && status !== 'ACTIVE' ? status : '',
    workArrangement,
    employmentType,
    experienceLevel,
    city,
    country,
    minSalary,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
      <Navbar />

      {/* Hero / Search Header */}
      <section className="bg-gradient-to-b from-white to-stormy-canvas border-b border-stormy-border py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1760px] mx-auto">
          <div className="max-w-4xl">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-stormy-main tracking-tight">
              Explore Job Opportunities
            </h1>
            <p className="mt-2 text-sm sm:text-base text-stormy-muted">
              Discover active vacancies aggregated across leading employment boards, with real-time updates and verified details.
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-4xl">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stormy-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Job title, keywords, or company name..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stormy-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stormy-sky focus:border-stormy-sky shadow-subtle text-stormy-main placeholder:text-stormy-muted/70"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateFilters({ search: '' });
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stormy-muted hover:text-stormy-dark"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <Button type="submit" variant="primary" size="md" className="sm:w-auto">
              Search Jobs
            </Button>
          </form>
        </div>
      </section>

      {/* Main Content: Filter Sidebar + Job Grid */}
      <main className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden w-full flex items-center justify-between pb-4 border-b border-stormy-border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>

              <button
                type="button"
                onClick={handleOpenSaveModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stormy-sky/30 bg-stormy-sky/5 text-xs font-semibold text-stormy-sky hover:bg-stormy-sky/15 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save
              </button>
            </div>

            <span className="text-xs text-stormy-muted">
              {total} {total === 1 ? 'job found' : 'jobs found'}
            </span>
          </div>

          {/* Sidebar Filter Panel - Sticky on scroll */}
          <aside
            className={`w-full lg:w-72 bg-white border border-stormy-border rounded-2xl p-5 shadow-card flex-shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto ${
              showMobileFilters ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stormy-border">
              <h2 className="text-sm font-bold text-stormy-dark uppercase tracking-wider">
                Filter Results
              </h2>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-stormy-sky hover:text-stormy-skyHover transition-colors cursor-pointer"
                >
                  Reset all
                </button>
              )}
            </div>

            <div className="space-y-5 pt-5">
              {/* Source Filter */}
              <div>
                <label htmlFor="filter-source" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Source
                </label>
                <select
                  id="filter-source"
                  value={source}
                  onChange={(e) => updateFilters({ source: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">All Sources</option>
                  {sources.map((s) => (
                    <option key={s.id || s.slug} value={s.slug}>
                      {s.name} {s.jobCount !== undefined && s.jobCount !== null ? `(${s.jobCount})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label htmlFor="filter-category" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Category
                </label>
                <select
                  id="filter-category"
                  value={category}
                  onChange={(e) => updateFilters({ category: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} {c.jobCount !== undefined && `(${c.jobCount})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="filter-status" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Status
                </label>
                <select
                  id="filter-status"
                  value={status || 'ACTIVE'}
                  onChange={(e) => updateFilters({ status: e.target.value === 'ACTIVE' ? '' : e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="ACTIVE">ACTIVE (Published)</option>
                  <option value="ALL">All Statuses</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* Work Arrangement */}
              <div>
                <span className="block text-xs font-bold text-stormy-dark mb-2 uppercase tracking-wide">
                  Work Arrangement
                </span>
                <div className="space-y-1.5">
                  {[
                    { value: '', label: 'All Locations' },
                    { value: 'REMOTE', label: 'Remote Only' },
                    { value: 'HYBRID', label: 'Hybrid' },
                    { value: 'ON_SITE', label: 'On-site' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs text-stormy-muted hover:text-stormy-dark cursor-pointer">
                      <input
                        type="radio"
                        name="workArrangement"
                        checked={workArrangement === opt.value}
                        onChange={() => updateFilters({ workArrangement: opt.value })}
                        className="text-stormy-sky focus:ring-stormy-sky rounded-full"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label htmlFor="filter-experience" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Experience Level
                </label>
                <select
                  id="filter-experience"
                  value={experienceLevel}
                  onChange={(e) => updateFilters({ experienceLevel: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">All Experience Levels</option>
                  <option value="ENTRY">Entry Level</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Mid Level</option>
                  <option value="SENIOR">Senior</option>
                  <option value="LEAD">Lead</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>

              {/* Sort By Controls */}
              <div>
                <label htmlFor="filter-sortby" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Sort By
                </label>
                <select
                  id="filter-sortby"
                  value={sortBy}
                  onChange={(e) => updateFilters({ sortBy: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="publishedAt">Most recently published</option>
                  <option value="firstSeenAt">Newest additions</option>
                  <option value="closingDate">Closing soon</option>
                  <option value="salaryMax">Highest salary</option>
                </select>
              </div>

              {/* Employment Type */}
              <div>
                <label htmlFor="filter-employment" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Employment Type
                </label>
                <select
                  id="filter-employment"
                  value={employmentType}
                  onChange={(e) => updateFilters({ employmentType: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">All Types</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>

              {/* City / Location */}
              <div>
                <label htmlFor="filter-city" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  City
                </label>
                <input
                  id="filter-city"
                  type="text"
                  value={city}
                  onChange={(e) => updateFilters({ city: e.target.value })}
                  placeholder="e.g. Addis Ababa"
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
              </div>

              {/* Minimum Salary */}
              <div>
                <label htmlFor="filter-min-salary" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Minimum Salary (ETB)
                </label>
                <input
                  id="filter-min-salary"
                  type="number"
                  min="0"
                  step="5000"
                  value={minSalary}
                  onChange={(e) => updateFilters({ minSalary: e.target.value })}
                  placeholder="e.g. 20000"
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                />
              </div>
            </div>
          </aside>

          {/* Job Listings Column */}
          <div className="flex-1 w-full space-y-6">
            {/* Header Strip: Count + Sort Controls */}
            <div className="hidden lg:flex items-center justify-between pb-3 border-b border-stormy-border">
              <span className="text-sm font-semibold text-stormy-dark">
                {total} {total === 1 ? 'position found' : 'positions found'}
                {search && ` matching "${search}"`}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenSaveModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stormy-border bg-white text-xs font-semibold text-stormy-dark hover:border-stormy-sky hover:text-stormy-sky transition-colors shadow-2xs cursor-pointer"
                >
                  <svg className="w-4 h-4 text-stormy-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save this Search
                </button>

                <div className="flex items-center gap-2">
                  <label htmlFor="sort-dropdown" className="text-xs font-medium text-stormy-muted">
                    Sort by:
                  </label>
                  <select
                    id="sort-dropdown"
                    value={sortBy}
                    onChange={(e) => updateFilters({ sortBy: e.target.value })}
                    className="bg-white border border-stormy-border rounded-lg px-2.5 py-1.5 text-xs text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                  >
                    <option value="publishedAt">Most recently published</option>
                    <option value="firstSeenAt">Newest additions</option>
                    <option value="closingDate">Closing soon</option>
                    <option value="salaryMax">Highest salary</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filters Pill Strip */}
            {(source || category || (status && status !== 'ACTIVE') || workArrangement || experienceLevel || employmentType || city || minSalary) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                <span className="text-xs text-stormy-muted font-medium">Active filters:</span>

                {source && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Source: {sources.find((s) => s.slug === source || s.id === source)?.name || source}
                    <button
                      type="button"
                      onClick={() => updateFilters({ source: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {category && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Category: {categories.find((c) => c.slug === category || c.id === category)?.name || category}
                    <button
                      type="button"
                      onClick={() => updateFilters({ category: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {status && status !== 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Status: {status}
                    <button
                      type="button"
                      onClick={() => updateFilters({ status: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {workArrangement && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Arrangement: {workArrangement === 'REMOTE' ? 'Remote Only' : workArrangement === 'HYBRID' ? 'Hybrid' : 'On-site'}
                    <button
                      type="button"
                      onClick={() => updateFilters({ workArrangement: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {experienceLevel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Level: {experienceLevel === 'ENTRY' ? 'Entry Level' : experienceLevel === 'JUNIOR' ? 'Junior' : experienceLevel === 'MID' ? 'Mid Level' : experienceLevel === 'SENIOR' ? 'Senior' : experienceLevel === 'LEAD' ? 'Lead' : experienceLevel === 'EXECUTIVE' ? 'Executive' : experienceLevel}
                    <button
                      type="button"
                      onClick={() => updateFilters({ experienceLevel: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {employmentType && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Type: {employmentType}
                    <button
                      type="button"
                      onClick={() => updateFilters({ employmentType: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {city && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    City: {city}
                    <button
                      type="button"
                      onClick={() => updateFilters({ city: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                {minSalary && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stormy-sky/10 text-stormy-dark border border-stormy-sky/30">
                    Min: {Number(minSalary).toLocaleString()} ETB
                    <button
                      type="button"
                      onClick={() => updateFilters({ minSalary: '' })}
                      className="hover:text-stormy-sky cursor-pointer ml-0.5 font-bold"
                    >
                      &times;
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="text-xs font-semibold text-stormy-sky hover:underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-feedback-danger-text text-sm flex items-center justify-between">
                <span>{error}</span>
                <Button size="sm" variant="outline" onClick={() => updateFilters({})}>
                  Retry
                </Button>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white border border-stormy-border rounded-xl p-5 space-y-4 animate-pulse shadow-subtle"
                  >
                    <div className="flex justify-between items-center">
                      <div className="w-20 h-4 bg-slate-200 rounded" />
                      <div className="w-16 h-4 bg-slate-200 rounded" />
                    </div>
                    <div className="w-3/4 h-5 bg-slate-200 rounded" />
                    <div className="w-1/2 h-4 bg-slate-100 rounded" />
                    <div className="flex gap-2 pt-2">
                      <div className="w-14 h-5 bg-slate-200 rounded-full" />
                      <div className="w-16 h-5 bg-slate-200 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              /* Empty State */
              <div className="bg-white border border-stormy-border rounded-2xl p-12 text-center shadow-card space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-stormy-mist/40 border border-stormy-mist flex items-center justify-center text-stormy-dark">
                  <svg className="w-7 h-7 text-stormy-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-stormy-main">
                  No matching jobs found
                </h3>
                <p className="text-sm text-stormy-muted max-w-md mx-auto">
                  We couldn&apos;t find any positions matching your criteria. Try loosening your filters, removing search terms, or exploring other categories.
                </p>
                <div>
                  <Button variant="outline" size="sm" onClick={handleClearAllFilters}>
                    Clear all filters
                  </Button>
                </div>
              </div>
            ) : (
              /* Job Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onToggleSave={handleToggleSave}
                    isSavePending={savePendingIds.has(job.id)}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="pt-6 border-t border-stormy-border flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => updateFilters({ page: page - 1 })}
                >
                  &larr; Previous
                </Button>

                <span className="text-xs font-semibold text-stormy-muted">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => updateFilters({ page: page + 1 })}
                >
                  Next &rarr;
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Save Search Modal */}
      <SaveSearchModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        filters={{
          search,
          category,
          categoryName: categories.find((c) => c.slug === category || c.id === category)?.name,
          workArrangement,
          employmentType,
          experienceLevel,
          city,
          country,
          minSalary,
        }}
      />

      {/* Unauthenticated Save Modal Prompt */}
      {authPromptJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white border border-stormy-border rounded-2xl p-6 max-w-sm w-full shadow-elevated space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-stormy-dark">
              <svg className="w-6 h-6 text-stormy-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-stormy-main">
              Sign In to Save Jobs
            </h3>
            <p className="text-xs text-stormy-muted">
              Create a free account or log in to bookmark vacancies and manage your application pipeline across devices.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={`/?returnUrl=/jobs/${authPromptJobId}`}
                className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-stormy-sky text-stormy-dark font-bold text-sm hover:bg-stormy-skyHover transition-colors"
              >
                Sign In or Register
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthPromptJobId(null)}
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-stormy-canvas text-stormy-main">
          <Navbar />
          <main className="w-full max-w-[1760px] mx-auto px-4 py-16 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
          </main>
        </div>
      }
    >
      <JobsContent />
    </React.Suspense>
  );
}
