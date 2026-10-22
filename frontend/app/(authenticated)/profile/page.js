'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { fetchProfile, updateProfile, fetchCategories } from '@/lib/jobs-api';
import { ProfileCompletionCard } from '@/components/profile/profile-completion-card';
import { CvUploader } from '@/components/profile/cv-uploader';
import { CvReviewModal } from '@/components/profile/cv-review-modal';
import { ExperienceSection } from '@/components/profile/experience-section';
import { EducationSection } from '@/components/profile/education-section';
import { SkillsSection } from '@/components/profile/skills-section';
import { ProjectsSection } from '@/components/profile/projects-section';
import { DocumentsTab } from '@/components/profile/documents-tab';

export default function ProfilePage() {
  const { user, isEmailVerified, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('overview'); // overview, experience, education, skills, projects, preferences, documents
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Review extracted CV modal
  const [extractedCvDoc, setExtractedCvDoc] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Manual Profile / Preferences form
  const [formData, setFormData] = useState({
    displayName: '',
    headline: '',
    phoneNumber: '',
    professionalEmail: '',
    country: '',
    city: '',
    summary: '',
    linkedInUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    preferredWorkArrangement: '',
    preferredEmploymentType: '',
    preferredExperienceLevel: '',
    minSalary: '',
    maxSalary: '',
    salaryCurrency: 'ETB',
    preferredCategories: [],
  });

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      const [profileData, catList] = await Promise.all([
        fetchProfile().catch(() => null),
        fetchCategories().catch(() => []),
      ]);

      setCategories(catList || []);
      if (profileData) {
        setProfile(profileData);
        setFormData({
          displayName: profileData.displayName || '',
          headline: profileData.headline || '',
          phoneNumber: profileData.phoneNumber || '',
          professionalEmail: profileData.professionalEmail || '',
          country: profileData.country || '',
          city: profileData.city || '',
          summary: profileData.summary || '',
          linkedInUrl: profileData.linkedInUrl || '',
          githubUrl: profileData.githubUrl || '',
          portfolioUrl: profileData.portfolioUrl || '',
          preferredWorkArrangement: profileData.preferredWorkArrangement || '',
          preferredEmploymentType: profileData.preferredEmploymentType || '',
          preferredExperienceLevel: profileData.preferredExperienceLevel || '',
          minSalary: profileData.minSalary !== null ? String(profileData.minSalary) : '',
          maxSalary: profileData.maxSalary !== null ? String(profileData.maxSalary) : '',
          salaryCurrency: profileData.salaryCurrency || 'ETB',
          preferredCategories: profileData.preferredCategories || [],
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const handleCvExtracted = (doc) => {
    setExtractedCvDoc(doc);
    setShowReviewModal(true);
  };

  const handleCvConfirmed = (updatedProfile) => {
    setShowReviewModal(false);
    setProfile(updatedProfile);
    setSaveSuccess('Your CV was successfully analyzed and imported into your profile!');
    loadProfileData();
    setActiveTab('overview');
  };

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const payload = {
        displayName: formData.displayName.trim() || null,
        headline: formData.headline.trim() || null,
        phoneNumber: formData.phoneNumber.trim() || null,
        professionalEmail: formData.professionalEmail.trim() || null,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        summary: formData.summary.trim() || null,
        linkedInUrl: formData.linkedInUrl.trim() || null,
        githubUrl: formData.githubUrl.trim() || null,
        portfolioUrl: formData.portfolioUrl.trim() || null,
        preferredWorkArrangement: formData.preferredWorkArrangement || null,
        preferredEmploymentType: formData.preferredEmploymentType || null,
        preferredExperienceLevel: formData.preferredExperienceLevel || null,
        minSalary: formData.minSalary ? Number(formData.minSalary) : null,
        maxSalary: formData.maxSalary ? Number(formData.maxSalary) : null,
        salaryCurrency: formData.salaryCurrency || 'ETB',
        preferredCategories: formData.preferredCategories,
      };

      const updated = await updateProfile(payload);
      setProfile(updated);
      setSaveSuccess('Profile and preferences updated successfully.');
    } catch (err) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50/50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/jobs" className="hover:text-blue-600">Home</Link>
          <span>/</span>
          <span className="text-gray-900 font-semibold">My Profile</span>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              {(profile?.displayName || user?.firstName || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {profile?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Candidate Profile'}
                </h1>
                {isEmailVerified ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1 font-medium">
                {profile?.headline || 'Add your professional headline (e.g. Full Stack Developer)'}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-2">
                <span>{user?.email}</span>
                {profile?.city && (
                  <>
                    <span>•</span>
                    <span>{profile.city}, {profile.country}</span>
                  </>
                )}
                {profile?.preferredWorkArrangement && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-blue-600">{profile.preferredWorkArrangement}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('documents')}
              className="px-4 py-2 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              📄 Upload / View CV
            </button>
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="px-4 py-2 border border-gray-200 hover:border-red-200 rounded-xl text-xs font-semibold text-gray-600 hover:text-red-600 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Profile Strength / Completion Indicator */}
        <ProfileCompletionCard
          completion={profile?.completion}
          onNavigateSection={(secId) => {
            if (['personal', 'preferences'].includes(secId)) setActiveTab(secId === 'personal' ? 'overview' : 'preferences');
            else if (secId === 'experience') setActiveTab('experience');
            else if (secId === 'education') setActiveTab('education');
            else if (secId === 'skills') setActiveTab('skills');
            else if (secId === 'projects') setActiveTab('projects');
          }}
        />

        {/* CV-First Fast Onboarding Banner (if profile has low completion or onboarding incomplete) */}
        {(!profile?.onboardingCompleted || (profile?.completionPercentage || 0) < 60) && (
          <CvUploader
            onExtracted={handleCvExtracted}
            onStartManual={() => setActiveTab('overview')}
          />
        )}

        {/* Feedback Alerts */}
        {saveSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
            <span>✓ {saveSuccess}</span>
            <button onClick={() => setSaveSuccess(null)} className="text-emerald-600 font-bold ml-4">✕</button>
          </div>
        )}
        {saveError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between">
            <span>✕ {saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-600 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none border-b border-gray-200">
          {[
            { id: 'overview', label: '👤 Personal & Contact' },
            { id: 'experience', label: `💼 Experience (${profile?.experiences?.length || 0})` },
            { id: 'education', label: `🎓 Education (${profile?.educations?.length || 0})` },
            { id: 'skills', label: `⚡ Skills (${profile?.skills?.length || 0})` },
            { id: 'projects', label: `🚀 Projects (${profile?.projects?.length || 0})` },
            { id: 'preferences', label: '🎯 Job Preferences' },
            { id: 'documents', label: '📁 Stored CVs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: Personal & Contact */}
        {activeTab === 'overview' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-gray-900 pb-4 border-b border-gray-100 mb-6">
              Personal & Contact Information
            </h3>

            <form onSubmit={handlePersonalSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Display / Full Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Headline</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Backend Engineer"
                    value={formData.headline}
                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+251..."
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Email</label>
                  <input
                    type="email"
                    placeholder="you@domain.com"
                    value={formData.professionalEmail}
                    onChange={(e) => setFormData({ ...formData, professionalEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Summary / Bio</label>
                <textarea
                  rows={4}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Summarize your professional background, core specialties, and what you bring to potential employers..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Links */}
              <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Links & Profiles</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">LinkedIn URL</label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/..."
                      value={formData.linkedInUrl}
                      onChange={(e) => setFormData({ ...formData, linkedInUrl: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">GitHub URL</label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={formData.githubUrl}
                      onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Portfolio / Website</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={formData.portfolioUrl}
                      onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving Changes...' : 'Save Personal Information'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Experience */}
        {activeTab === 'experience' && (
          <ExperienceSection experiences={profile?.experiences || []} onRefresh={loadProfileData} />
        )}

        {/* TAB 3: Education */}
        {activeTab === 'education' && (
          <EducationSection educations={profile?.educations || []} onRefresh={loadProfileData} />
        )}

        {/* TAB 4: Skills */}
        {activeTab === 'skills' && (
          <SkillsSection skills={profile?.skills || []} onRefresh={loadProfileData} />
        )}

        {/* TAB 5: Projects */}
        {activeTab === 'projects' && (
          <ProjectsSection projects={profile?.projects || []} onRefresh={loadProfileData} />
        )}

        {/* TAB 6: Preferences */}
        {activeTab === 'preferences' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-gray-900 pb-4 border-b border-gray-100 mb-6">
              Job & Career Preferences
            </h3>

            <form onSubmit={handlePersonalSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Work Arrangement</label>
                  <select
                    value={formData.preferredWorkArrangement}
                    onChange={(e) => setFormData({ ...formData, preferredWorkArrangement: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Any arrangement</option>
                    <option value="REMOTE">Remote Only</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ON_SITE">On-Site</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Employment Type</label>
                  <select
                    value={formData.preferredEmploymentType}
                    onChange={(e) => setFormData({ ...formData, preferredEmploymentType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Any type</option>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="FREELANCE">Freelance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Experience Level</label>
                  <select
                    value={formData.preferredExperienceLevel}
                    onChange={(e) => setFormData({ ...formData, preferredExperienceLevel: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Any level</option>
                    <option value="ENTRY">Entry Level</option>
                    <option value="JUNIOR">Junior</option>
                    <option value="MID">Mid Level</option>
                    <option value="SENIOR">Senior</option>
                    <option value="LEAD">Lead / Architect</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Minimum Desired Salary ({formData.salaryCurrency})</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={formData.minSalary}
                    onChange={(e) => setFormData({ ...formData, minSalary: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Maximum Expected Salary ({formData.salaryCurrency})</label>
                  <input
                    type="number"
                    placeholder="e.g. 80000"
                    value={formData.maxSalary}
                    onChange={(e) => setFormData({ ...formData, maxSalary: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Target Categories */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Target Industries & Categories</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = formData.preferredCategories.includes(cat.slug);
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleCategoryToggle(cat.slug)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving Preferences...' : 'Save Career Preferences'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 7: Documents (Google Drive) */}
        {activeTab === 'documents' && <DocumentsTab />}

        {/* Review & Confirmation Modal */}
        {showReviewModal && (
          <CvReviewModal
            extractedData={extractedCvDoc?.extractedData}
            onClose={() => setShowReviewModal(false)}
            onConfirmed={handleCvConfirmed}
          />
        )}
      </div>
    </div>
  );
}
