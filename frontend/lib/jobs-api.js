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
