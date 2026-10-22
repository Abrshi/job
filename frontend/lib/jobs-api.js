import { apiClient } from './api-client';

/**
 * Fetch publicly available jobs with search, filtering, and pagination
 */
export async function fetchJobs(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  const endpoint = queryString ? `/jobs?${queryString}` : '/jobs';
  const res = await apiClient.get(endpoint);
  return res.data;
}

/**
 * Fetch public taxonomy categories with live active job counts
 */
export async function fetchCategories() {
  const res = await apiClient.get('/jobs/categories');
  return res.data.categories;
}

/**
 * Fetch single job details by ID
 */
export async function fetchJobById(id) {
  const res = await apiClient.get(`/jobs/${id}`);
  return res.data.job;
}

/**
 * Save job for authenticated user
 */
export async function saveJob(id) {
  const res = await apiClient.post(`/jobs/${id}/save`);
  return res.data;
}

/**
 * Unsave job for authenticated user
 */
export async function unsaveJob(id) {
  const res = await apiClient.delete(`/jobs/${id}/save`);
  return res.data;
}

/**
 * Fetch user's saved jobs
 */
export async function fetchSavedJobs(page = 1, limit = 20) {
  const res = await apiClient.get(`/jobs/saved?page=${page}&limit=${limit}`);
  return res.data;
}

/**
 * Submit internal application for a job
 */
export async function applyJob(id, coverNote = '') {
  const res = await apiClient.post(`/jobs/${id}/apply`, { coverNote });
  return res.data;
}

/**
 * Fetch user's application history
 */
export async function fetchUserApplications(page = 1, limit = 20) {
  const res = await apiClient.get(`/jobs/applications?page=${page}&limit=${limit}`);
  return res.data;
}

/**
 * Fetch current user profile & preferences
 */
export async function fetchProfile() {
  const res = await apiClient.get('/profile');
  return res.data.profile;
}

/**
 * Update current user profile & preferences
 */
export async function updateProfile(data) {
  const res = await apiClient.patch('/profile', data);
  return res.data.profile;
}

/**
 * Confirm and import extracted CV data into relational profile tables
 */
export async function confirmExtractedProfile(data) {
  const res = await apiClient.post('/profile/confirm-cv', data);
  return res.data.profile;
}

// Experience Section
export async function addExperience(data) {
  const res = await apiClient.post('/profile/experiences', data);
  return res.data.experience;
}

export async function updateExperience(id, data) {
  const res = await apiClient.patch(`/profile/experiences/${id}`, data);
  return res.data.experience;
}

export async function deleteExperience(id) {
  const res = await apiClient.delete(`/profile/experiences/${id}`);
  return res.data;
}

// Education Section
export async function addEducation(data) {
  const res = await apiClient.post('/profile/educations', data);
  return res.data.education;
}

export async function updateEducation(id, data) {
  const res = await apiClient.patch(`/profile/educations/${id}`, data);
  return res.data.education;
}

export async function deleteEducation(id) {
  const res = await apiClient.delete(`/profile/educations/${id}`);
  return res.data;
}

// Certification Section
export async function addCertification(data) {
  const res = await apiClient.post('/profile/certifications', data);
  return res.data.certification;
}

export async function deleteCertification(id) {
  const res = await apiClient.delete(`/profile/certifications/${id}`);
  return res.data;
}

// Project Section
export async function addProject(data) {
  const res = await apiClient.post('/profile/projects', data);
  return res.data.project;
}

export async function deleteProject(id) {
  const res = await apiClient.delete(`/profile/projects/${id}`);
  return res.data;
}

// Skill Section
export async function addSkill(data) {
  const res = await apiClient.post('/profile/skills', data);
  return res.data.skill;
}

export async function deleteSkill(id) {
  const res = await apiClient.delete(`/profile/skills/${id}`);
  return res.data;
}

// Language Section
export async function addLanguage(data) {
  const res = await apiClient.post('/profile/languages', data);
  return res.data.language;
}

export async function deleteLanguage(id) {
  const res = await apiClient.delete(`/profile/languages/${id}`);
  return res.data;
}

// Achievement Section
export async function addAchievement(data) {
  const res = await apiClient.post('/profile/achievements', data);
  return res.data.achievement;
}

export async function deleteAchievement(id) {
  const res = await apiClient.delete(`/profile/achievements/${id}`);
  return res.data;
}

