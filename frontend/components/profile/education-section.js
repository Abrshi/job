'use client';

import React, { useState } from 'react';
import { addEducation, deleteEducation } from '../../lib/jobs-api';

export function EducationSection({ educations = [], onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    institution: '',
    degree: '',
    fieldOfStudy: '',
    startYear: new Date().getFullYear() - 4,
    endYear: new Date().getFullYear(),
    grade: '',
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addEducation(form);
      setShowAddModal(false);
      setForm({
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startYear: new Date().getFullYear() - 4,
        endYear: new Date().getFullYear(),
        grade: '',
        description: '',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to add education');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this education entry?')) return;
    try {
      await deleteEducation(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete education');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-center justify-between pb-6 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Education & Qualifications</h3>
          <p className="text-xs text-gray-500 mt-1">
            List your universities, colleges, degrees, and academic qualifications.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          + Add Education
        </button>
      </div>

      {educations.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-sm font-semibold text-gray-700">No education entries listed yet</p>
          <p className="text-xs text-gray-400 mt-1">Add your degree, university, or academic achievements.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 mt-4 space-y-4">
          {educations.map((edu) => (
            <div key={edu.id} className="pt-4 first:pt-0 flex justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">{edu.institution}</h4>
                <p className="text-sm font-semibold text-gray-700 mt-0.5">
                  {edu.degree || 'Degree'} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {edu.startYear || ''} {edu.endYear ? `— ${edu.endYear}` : ''} {edu.grade ? `• GPA: ${edu.grade}` : ''}
                </p>
                {edu.description && (
                  <p className="text-xs text-gray-500 mt-2">{edu.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(edu.id)}
                className="text-gray-400 hover:text-red-600 text-xs shrink-0 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h4 className="text-base font-bold text-gray-900 mb-4">Add Education Entry</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Institution / University *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addis Ababa University"
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Degree / Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. Bachelor of Science"
                    value={form.degree}
                    onChange={(e) => setForm({ ...form, degree: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Field of Study</label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={form.fieldOfStudy}
                    onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Graduation Year</label>
                  <input
                    type="number"
                    value={form.endYear}
                    onChange={(e) => setForm({ ...form, endYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Grade / GPA (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 3.8 / 4.0 or Distinction"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
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
                  {loading ? 'Saving...' : 'Save Education'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

