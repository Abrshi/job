'use client';

import React, { useState } from 'react';
import { addSkill, deleteSkill } from '../../lib/jobs-api';

export function SkillsSection({ skills = [], onRefresh }) {
  const [skillName, setSkillName] = useState('');
  const [category, setCategory] = useState('Technical');
  const [proficiency, setProficiency] = useState('INTERMEDIATE');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!skillName.trim()) return;

    setLoading(true);
    try {
      await addSkill({
        name: skillName.trim(),
        category,
        proficiency,
      });
      setSkillName('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to add skill');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSkill(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.message || 'Failed to remove skill');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="pb-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">Skills & Competencies</h3>
        <p className="text-xs text-gray-500 mt-1">
          Add your key technical, analytical, leadership, and domain capabilities.
        </p>
      </div>

      {/* Add Skill Bar */}
      <form onSubmit={handleAdd} className="mt-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Skill Name</label>
          <input
            type="text"
            required
            placeholder="e.g. React, Python, Project Management"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="w-40">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            <option value="Technical">Technical</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="DevOps">DevOps & Cloud</option>
            <option value="Soft Skills">Soft Skills</option>
            <option value="Leadership">Leadership</option>
            <option value="Design">UI/UX & Design</option>
          </select>
        </div>

        <div className="w-36">
          <label className="block text-xs font-semibold text-gray-700 mb-1">Proficiency</label>
          <select
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="EXPERT">Expert</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs h-[38px] cursor-pointer"
        >
          {loading ? 'Adding...' : '+ Add Skill'}
        </button>
      </form>

      {/* Skills Display */}
      {skills.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-xs">
          No skills added yet. Add at least 3 skills to boost your profile strength.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-6">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-xs shadow-2xs group hover:border-gray-300 transition-colors"
            >
              <span className="font-semibold">{skill.name}</span>
              {skill.proficiency && (
                <span className="text-[10px] text-gray-400 uppercase font-medium">({skill.proficiency.toLowerCase()})</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(skill.id)}
                className="text-gray-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                title="Remove skill"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

