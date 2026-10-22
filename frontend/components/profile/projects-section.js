'use client';

import React, { useState } from 'react';
import { addProject, deleteProject } from '../../lib/jobs-api';

export function ProjectsSection({ projects = [], onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: '',
    description: '',
    technologies: '',
    liveUrl: '',
    repoUrl: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addProject({
        name: form.name,
        role: form.role || undefined,
        description: form.description || undefined,
        technologies: form.technologies
          ? form.technologies.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined,
        liveUrl: form.liveUrl || undefined,
        repoUrl: form.repoUrl || undefined,
      });
      setShowAddModal(false);
      setForm({
        name: '',
        role: '',
        description: '',
        technologies: '',
        liveUrl: '',
        repoUrl: '',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to add project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await deleteProject(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-center justify-between pb-6 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Featured Projects</h3>
          <p className="text-xs text-gray-500 mt-1">
            Showcase personal, academic, or professional projects and open-source contributions.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          + Add Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-sm font-semibold text-gray-700">No projects added yet</p>
          <p className="text-xs text-gray-400 mt-1">Adding projects is especially effective for demonstrating hands-on skills.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 mt-4 space-y-4">
          {projects.map((proj) => (
            <div key={proj.id} className="pt-4 first:pt-0 flex justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">{proj.name}</h4>
                {proj.role && <p className="text-xs font-medium text-gray-600">{proj.role}</p>}
                {proj.description && <p className="text-xs text-gray-500 mt-1.5">{proj.description}</p>}
                {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {proj.technologies.map((tech, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs">
                  {proj.liveUrl && (
                    <a href={proj.liveUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Live Demo ↗
                    </a>
                  )}
                  {proj.repoUrl && (
                    <a href={proj.repoUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:underline">
                      Repository ↗
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(proj.id)}
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
            <h4 className="text-base font-bold text-gray-900 mb-4">Add Project</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Your Role</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Developer, Frontend Architect"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Technologies Used (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Next.js, TypeScript, Tailwind, PostgreSQL"
                  value={form.technologies}
                  onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Live URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.liveUrl}
                    onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Repository URL</label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={form.repoUrl}
                    onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
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
                  {loading ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

