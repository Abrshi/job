import { apiClient } from './api-client.js';

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
 * Fetch public job sources with live active job counts
 */
export async function fetchSources() {
  const res = await apiClient.get('/jobs/sources');
  return res.data.sources;
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

// Avatar / Profile Picture Management
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await apiClient.post('/profile/avatar', formData);
  return res.data || res;
}

export async function deleteAvatar() {
  const res = await apiClient.delete('/profile/avatar');
  return res.data;
}

export function getAvatarUrl(avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(
    /\/api\/v1\/?$/,
    ''
  );
  return `${apiBase}${avatarPath.startsWith('/') ? '' : '/'}${avatarPath}`;
}

// ============================================================================
// Application Tracking System (ATS) APIs
// ============================================================================

/**
 * Fetch applications with status, source, search, sort, and pagination
 */
export async function fetchApplications(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  const endpoint = queryString ? `/applications?${queryString}` : '/applications';
  const res = await apiClient.get(endpoint);
  return res.data;
}

/**
 * Fetch summary metrics for candidate applications dashboard
 */
export async function fetchApplicationStats() {
  const res = await apiClient.get('/applications/stats');
  return res.data;
}

/**
 * Fetch single application details by ID (including history, interviews, reminders)
 */
export async function fetchApplicationById(id) {
  const res = await apiClient.get(`/applications/${id}`);
  return res.data;
}

/**
 * Create a new application (Platform or External; Draft or Applied)
 */
export async function createApplication(data) {
  const res = await apiClient.post('/applications', data);
  return res.data;
}

/**
 * Update an existing application (external fields, notes, archive)
 */
export async function updateApplication(id, data) {
  const res = await apiClient.patch(`/applications/${id}`, data);
  return res.data;
}

/**
 * Transition application status with audit reason
 */
export async function updateApplicationStatus(id, status, reason = '') {
  const res = await apiClient.post(`/applications/${id}/status`, { status, reason });
  return res.data;
}

/**
 * Voluntarily withdraw an application
 */
export async function withdrawApplication(id, reason = '') {
  const res = await apiClient.post(`/applications/${id}/withdraw`, { reason });
  return res.data;
}

/**
 * Delete a draft application (submitted cannot be deleted)
 */
export async function deleteDraftApplication(id) {
  const res = await apiClient.delete(`/applications/${id}`);
  return res.data;
}

/**
 * Schedule an interview round
 */
export async function scheduleInterview(id, data) {
  const res = await apiClient.post(`/applications/${id}/interviews`, data);
  return res.data;
}

/**
 * Update an interview round
 */
export async function updateInterview(id, interviewId, data) {
  const res = await apiClient.patch(`/applications/${id}/interviews/${interviewId}`, data);
  return res.data;
}

/**
 * Delete an interview round
 */
export async function deleteInterview(id, interviewId) {
  const res = await apiClient.delete(`/applications/${id}/interviews/${interviewId}`);
  return res.data;
}

/**
 * Create a follow-up reminder
 */
export async function createReminder(id, data) {
  const res = await apiClient.post(`/applications/${id}/reminders`, data);
  return res.data;
}

/**
 * Update a reminder (e.g. toggle completion)
 */
export async function updateReminder(id, reminderId, data) {
  const res = await apiClient.patch(`/applications/${id}/reminders/${reminderId}`, data);
  return res.data;
}

/**
 * Delete a reminder
 */
export async function deleteReminder(id, reminderId) {
  const res = await apiClient.delete(`/applications/${id}/reminders/${reminderId}`);
  return res.data;
}

/**
 * Create a new saved search
 */
export async function createSavedSearch(data) {
  const res = await apiClient.post('/saved-searches', data);
  return res.data;
}

/**
 * Fetch all saved searches for the current user
 */
export async function fetchSavedSearches() {
  const res = await apiClient.get('/saved-searches');
  return res.data.savedSearches;
}

/**
 * Fetch single saved search by ID
 */
export async function fetchSavedSearchById(id) {
  const res = await apiClient.get(`/saved-searches/${id}`);
  return res.data.savedSearch;
}

/**
 * Update saved search
 */
export async function updateSavedSearch(id, data) {
  const res = await apiClient.put(`/saved-searches/${id}`, data);
  return res.data.savedSearch;
}

/**
 * Toggle alert on/off for saved search
 */
export async function toggleSavedSearchAlert(id) {
  const res = await apiClient.patch(`/saved-searches/${id}/toggle-alert`);
  return res.data.savedSearch;
}

/**
 * Delete saved search
 */
export async function deleteSavedSearch(id) {
  const res = await apiClient.delete(`/saved-searches/${id}`);
  return res.data;
}

/**
 * Run a saved search live and return matching catalog jobs
 */
export async function runSavedSearch(id, page = 1, limit = 20) {
  const res = await apiClient.get(`/saved-searches/${id}/run?page=${page}&limit=${limit}`);
  return res.data;
}

/**
 * Fetch user's job notifications
 */
export async function fetchNotifications(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly));
  const queryString = query.toString();
  const endpoint = queryString ? `/notifications?${queryString}` : '/notifications';
  const res = await apiClient.get(endpoint);
  return res.data;
}

/**
 * Fetch count of unread notifications for badge
 */
export async function fetchUnreadNotificationCount() {
  const res = await apiClient.get('/notifications/unread-count');
  return res.data.unreadCount || 0;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id) {
  const res = await apiClient.patch(`/notifications/${id}/read`);
  return res.data.notification;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  const res = await apiClient.patch('/notifications/read-all');
  return res.data;
}

/**
 * Delete a notification
 */
export async function deleteNotification(id) {
  const res = await apiClient.delete(`/notifications/${id}`);
  return res.data;
}

/**
 * Clear all read notifications
 */
export async function clearReadNotifications() {
  const res = await apiClient.delete('/notifications');
  return res.data;
}

/**
 * AI Application Documents
 */
export {
  generateDocument,
  fetchGeneratedDocuments,
  fetchGeneratedDocumentById,
  saveDocumentVersion,
  downloadGeneratedDocument,
  attachDocumentToApplication,
  deleteGeneratedDocument,
} from './ai-documents-api.js';




