'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { fetchProfile, updateProfile, fetchCategories } from '@/lib/jobs-api';

export default function ProfilePage() {
  const { user, isEmailVerified, logout } = useAuth();
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [categories, setCategories] = useState([]);

  // Profile Form state
  const [formData, setFormData] = useState({
    displayName: '',
    headline: '',
    country: '',
    city: '',
    preferredWorkArrangement: '',
    preferredEmploymentType: '',
    preferredExperienceLevel: '',
    minSalary: '',
    salaryCurrency: 'ETB',
    preferredCategories: [],
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Load Categories & Profile
  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    async function loadData() {
      setIsLoadingProfile(true);
      try {
        const [profileData, catList] = await Promise.all([
          fetchProfile().catch(() => null),
          fetchCategories().catch(() => []),
        ]);

        if (!isCancelled) {
          setCategories(catList || []);
          if (profileData) {
            setFormData({
              displayName: profileData.displayName || '',
              headline: profileData.headline || '',
              country: profileData.country || '',
              city: profileData.city || '',
              preferredWorkArrangement: profileData.preferredWorkArrangement || '',
              preferredEmploymentType: profileData.preferredEmploymentType || '',
              preferredExperienceLevel: profileData.preferredExperienceLevel || '',
              minSalary: profileData.minSalary !== null ? String(profileData.minSalary) : '',
              salaryCurrency: profileData.salaryCurrency || 'ETB',
              preferredCategories: profileData.preferredCategories || [],
            });
          }
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const handleCategoryToggle = (slug) => {
    setFormData((prev) => {
      const exists = prev.preferredCategories.includes(slug);
      return {
        ...prev,
        preferredCategories: exists
          ? prev.preferredCategories.filter((s) => s !== slug)
          : [...prev.preferredCategories, slug],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const payload = {
        displayName: formData.displayName.trim() || null,
        headline: formData.headline.trim() || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        preferredWorkArrangement: formData.preferredWorkArrangement || null,
        preferredEmploymentType: formData.preferredEmploymentType || null,
        preferredExperienceLevel: formData.preferredExperienceLevel || null,
        minSalary: formData.minSalary ? Number(formData.minSalary) : null,
        salaryCurrency: formData.salaryCurrency || 'ETB',
        preferredCategories: formData.preferredCategories,
      };

      await updateProfile(payload);
      setSaveSuccess('Your career profile and job preferences have been saved successfully.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';
  const initial = (user.firstName || user.email).charAt(0).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Profile Card */}
      <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-stormy-mist/50 border border-stormy-mist flex items-center justify-center text-2xl font-bold text-stormy-dark">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-stormy-main tracking-tight">
                  {formData.displayName || fullName}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stormy-mist/40 text-stormy-dark border border-stormy-mist">
                  {user.role}
                </span>
              </div>
              <p className="text-sm text-stormy-muted mt-0.5">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link href="/jobs/saved">
              <Button variant="outline" size="sm">
                Saved Jobs
              </Button>
            </Link>
            <Link href="/jobs/applications">
              <Button variant="outline" size="sm">
                Applications
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              loading={isLoggingOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Verification Notice */}
      {!isEmailVerified ? (
        <Alert variant="warning" title="Email Verification Required">
          <div className="space-y-2 mt-1">
            <p className="text-sm text-feedback-warning-text">
              Your account email has not been verified yet. Internal applications and notifications require an active verified email.
            </p>
            <div className="pt-1">
              <Link href="/verify-email">
                <Button variant="cta" size="sm">
                  Complete Email Verification
                </Button>
              </Link>
            </div>
          </div>
        </Alert>
      ) : (
        <Alert variant="success" title="Account Verified">
          Your email address is verified. You can save jobs and apply directly to matching openings.
        </Alert>
      )}

      {saveSuccess && (
        <Alert variant="success">
          {saveSuccess}
        </Alert>
      )}

      {saveError && (
        <Alert variant="danger">
          {saveError}
        </Alert>
      )}

      {/* Profile & Preferences Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 shadow-card space-y-6">
        <div className="border-b border-stormy-border pb-4">
          <h2 className="text-lg font-bold text-stormy-main">
            Career Profile & Discovery Preferences
          </h2>
          <p className="text-xs text-stormy-muted mt-0.5">
            Configure your work arrangements, target categories, and locations to customize your job search.
          </p>
        </div>

        {isLoadingProfile ? (
          <div className="space-y-4 py-8 text-center">
            <div className="w-8 h-8 mx-auto border-2 border-stormy-sky border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-stormy-muted">Loading preferences...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Display Name & Headline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="displayName" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Display Name
                </label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Abebe Bikila"
                />
              </div>

              <div>
                <label htmlFor="headline" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Professional Headline
                </label>
                <Input
                  id="headline"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  placeholder="e.g. Full-Stack Developer & Cloud Architect"
                />
              </div>
            </div>

            {/* Location: Country & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="country" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Country
                </label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="e.g. Ethiopia"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  City
                </label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Addis Ababa"
                />
              </div>
            </div>

            {/* Work Preferences: Arrangement, Employment Type, Exp Level */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="arrangement" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Preferred Arrangement
                </label>
                <select
                  id="arrangement"
                  value={formData.preferredWorkArrangement}
                  onChange={(e) => setFormData({ ...formData, preferredWorkArrangement: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">Any Work Arrangement</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ON_SITE">On-site</option>
                </select>
              </div>

              <div>
                <label htmlFor="employmentType" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Preferred Type
                </label>
                <select
                  id="employmentType"
                  value={formData.preferredEmploymentType}
                  onChange={(e) => setFormData({ ...formData, preferredEmploymentType: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">Any Employment Type</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </div>

              <div>
                <label htmlFor="experienceLevel" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Experience Level
                </label>
                <select
                  id="experienceLevel"
                  value={formData.preferredExperienceLevel}
                  onChange={(e) => setFormData({ ...formData, preferredExperienceLevel: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="">Any Experience Level</option>
                  <option value="ENTRY">Entry Level</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Mid Level</option>
                  <option value="SENIOR">Senior</option>
                  <option value="LEAD">Lead</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>
            </div>

            {/* Compensation Expectations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="minSalary" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Minimum Expected Salary
                </label>
                <Input
                  id="minSalary"
                  type="number"
                  min="0"
                  step="5000"
                  value={formData.minSalary}
                  onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                  placeholder="e.g. 35000"
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-xs font-bold text-stormy-dark mb-1.5 uppercase tracking-wide">
                  Currency
                </label>
                <select
                  id="currency"
                  value={formData.salaryCurrency}
                  onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value })}
                  className="w-full bg-white border border-stormy-border rounded-lg px-3 py-2 text-sm text-stormy-main focus:outline-none focus:ring-2 focus:ring-stormy-sky"
                >
                  <option value="ETB">ETB (Ethiopian Birr)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>
            </div>

            {/* Preferred Categories (Multi-select pills) */}
            <div>
              <span className="block text-xs font-bold text-stormy-dark mb-2 uppercase tracking-wide">
                Target Industries & Categories
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isSelected = formData.preferredCategories.includes(cat.slug);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryToggle(cat.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-stormy-dark text-white border-stormy-dark shadow-subtle'
                          : 'bg-white text-stormy-muted border-stormy-border hover:border-stormy-slate hover:text-stormy-dark'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-stormy-border flex justify-end">
              <Button type="submit" variant="primary" size="md" loading={isSaving}>
                Save Profile & Preferences
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
