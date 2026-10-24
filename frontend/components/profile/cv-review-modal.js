'use client';

import React, { useState } from 'react';
import { confirmExtractedProfile } from '../../lib/jobs-api';

export function CvReviewModal({ extractedData, onClose, onConfirmed }) {
  const [personal, setPersonal] = useState(extractedData?.personal || {});
  const [experiences, setExperiences] = useState(extractedData?.experiences || []);
  const [educations, setEducations] = useState(extractedData?.educations || []);
  const [skills, setSkills] = useState(extractedData?.skills || []);
  const [projects, setProjects] = useState(extractedData?.projects || []);
  const [certifications, setCertifications] = useState(extractedData?.certifications || []);
  const [languages, setLanguages] = useState(extractedData?.languages || []);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleRemoveExperience = (idx) => {
    setExperiences(experiences.filter((_, i) => i !== idx));
  };

  const handleRemoveEducation = (idx) => {
    setEducations(educations.filter((_, i) => i !== idx));
  };

  const handleRemoveProject = (idx) => {
    setProjects(projects.filter((_, i) => i !== idx));
  };

  const handleRemoveSkill = (idx) => {
    setSkills(skills.filter((_, i) => i !== idx));
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    setSkills([...skills, { name: newSkill.trim(), category: 'Technical' }]);
    setNewSkill('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        personal,
        experiences,
        educations,
        skills,
        projects,
        certifications,
        languages,
        jobPreferences: extractedData?.jobPreferences || {},
        onboardingCompleted: true,
      };

      const updatedProfile = await confirmExtractedProfile(payload);
      if (onConfirmed) {
        onConfirmed(updatedProfile);
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm profile information');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xl font-bold text-gray-900">Review Extracted Profile</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Verify and adjust the information parsed from your CV before it is saved to your profile.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Section: Personal & Contact */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>👤</span> Personal & Contact Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={personal.fullName || ''}
                  onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Headline</label>
                <input
                  type="text"
                  value={personal.headline || ''}
                  onChange={(e) => setPersonal({ ...personal, headline: e.target.value })}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={personal.phoneNumber || ''}
                  onChange={(e) => setPersonal({ ...personal, phoneNumber: e.target.value })}
                  placeholder="+251..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Email</label>
                <input
                  type="email"
                  value={personal.professionalEmail || ''}
                  onChange={(e) => setPersonal({ ...personal, professionalEmail: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={personal.city || ''}
                  onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={personal.country || ''}
                  onChange={(e) => setPersonal({ ...personal, country: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Professional Summary</label>
              <textarea
                rows={3}
                value={personal.summary || ''}
                onChange={(e) => setPersonal({ ...personal, summary: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Section: Work Experience */}
          <div className="pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span>💼</span> Work Experience ({experiences.length})
              </h4>
            </div>

            {experiences.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No previous work experience extracted.</p>
            ) : (
              <div className="space-y-3">
                {experiences.map((exp, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-900">{exp.jobTitle}</h5>
                      <p className="text-xs text-gray-600 font-medium">
                        {exp.companyName} {exp.location ? `• ${exp.location}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {exp.startYear || 'Start'} {exp.startMonth ? `/${exp.startMonth}` : ''} —{' '}
                        {exp.isCurrent ? 'Present' : `${exp.endYear || 'End'} ${exp.endMonth ? `/${exp.endMonth}` : ''}`}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{exp.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveExperience(idx)}
                      className="text-gray-400 hover:text-red-500 text-xs shrink-0 cursor-pointer"
                      title="Remove entry"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Education */}
          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>🎓</span> Education ({educations.length})
            </h4>

            {educations.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No education entries extracted.</p>
            ) : (
              <div className="space-y-3">
                {educations.map((edu, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-gray-900">{edu.institution}</h5>
                      <p className="text-xs text-gray-600">
                        {edu.degree || 'Degree'} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {edu.startYear || ''} {edu.endYear ? `— ${edu.endYear}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveEducation(idx)}
                      className="text-gray-400 hover:text-red-500 text-xs shrink-0 cursor-pointer"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Skills */}
          <div className="pt-6 border-t border-gray-100">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>⚡</span> Extracted Skills ({skills.length})
            </h4>

            <div className="flex flex-wrap gap-2 mb-4">
              {skills.map((s, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold"
                >
                  {s.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(idx)}
                    className="text-blue-400 hover:text-blue-800 cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddSkill} className="flex gap-2 max-w-sm">
              <input
                type="text"
                placeholder="Add missing skill (e.g. Next.js)"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                + Add
              </button>
            </form>
          </div>

          {/* Section: Projects & Certifications */}
          {(projects.length > 0 || certifications.length > 0) && (
            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🚀</span> Projects & Certifications
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map((proj, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{proj.name}</p>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{proj.description}</p>
                    </div>
                    <button onClick={() => handleRemoveProject(idx)} className="text-gray-400 hover:text-red-500 text-xs cursor-pointer">✕</button>
                  </div>
                ))}

                {certifications.map((cert, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-900">{cert.name}</p>
                    <p className="text-[11px] text-gray-500">{cert.issuingOrganization}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing Profile...</span>
              </>
            ) : (
              <>
                <span>Confirm & Save Profile</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

