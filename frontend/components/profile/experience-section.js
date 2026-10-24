'use client';

import React, { useState } from 'react';
import { addExperience, deleteExperience } from '../../lib/jobs-api';

export function ExperienceSection({ experiences = [], onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    jobTitle: '',
    employmentType: 'FULL_TIME',
    location: '',
    startYear: new Date().getFullYear() - 1,
    startMonth: 1,
    endYear: new Date().getFullYear(),
    endMonth: 1,
    isCurrent: false,
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addExperience(form);
      setShowAddModal(false);
      setForm({
        companyName: '',
        jobTitle: '',
        employmentType: 'FULL_TIME',
        location: '',
        startYear: new Date().getFullYear() - 1,
        startMonth: 1,
        endYear: new Date().getFullYear(),
        endMonth: 1,
        isCurrent: false,
        description: '',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to add experience');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this experience entry?')) return;
    try {
      await deleteExperience(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete experience');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-center justify-between pb-6 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Work Experience</h3>
          <p className="text-xs text-gray-500 mt-1">
            Add your professional history, achievements, and key responsibilities.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          + Add Experience
        </button>
      </div>

      {experiences.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-sm font-semibold text-gray-700">No work experience listed yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload your CV to automatically populate this section, or click &quot;Add Experience&quot;.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 mt-4 space-y-4">
          {experiences.map((exp) => (
            <div key={exp.id} className="pt-4 first:pt-0 flex justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-gray-900">{exp.jobTitle}</h4>
                  {exp.isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Current
                    </span>
                  )}
                  {exp.provenance === 'CV_EXTRACTED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      CV Extracted
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">
                  {exp.companyName} {exp.location ? `• ${exp.location}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {exp.startYear || 'Start'} {exp.startMonth ? `/${exp.startMonth}` : ''} —{' '}
                  {exp.isCurrent ? 'Present' : `${exp.endYear || 'End'} ${exp.endMonth ? `/${exp.endMonth}` : ''}`}
                </p>
                {exp.description && (
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed whitespace-pre-line">{exp.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(exp.id)}
                className="text-gray-400 hover:text-red-600 text-xs shrink-0 cursor-pointer p-1"
                title="Delete entry"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h4 className="text-base font-bold text-gray-900 mb-4">Add Work Experience</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Addis Ababa"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="FREELANCE">Freelance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Year</label>
                  <input
                    type="number"
                    value={form.startYear}
                    onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Year</label>
                  <input
                    type="number"
                    disabled={form.isCurrent}
                    value={form.isCurrent ? '' : form.endYear}
                    onChange={(e) => setForm({ ...form, endYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={form.isCurrent}
                  onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isCurrent" className="text-xs font-medium text-gray-700 cursor-pointer">
                  I currently work in this role
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Responsibilities</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  {loading ? 'Saving...' : 'Save Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

