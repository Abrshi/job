import { apiClient } from './api-client.js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Generate a new tailored document draft (CV, Cover Letter, or Email)
 */
export async function generateDocument(payload) {
  const res = await apiClient.post('/ai-documents/generate', payload);
  return res.data;
}

/**
 * Fetch candidate's generated documents with optional filters and pagination
 */
export async function fetchGeneratedDocuments(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.documentType) query.set('documentType', params.documentType);
  if (params.jobId) query.set('jobId', params.jobId);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  const endpoint = qs ? `/ai-documents?${qs}` : '/ai-documents';
  const res = await apiClient.get(endpoint);
  return res.data;
}

/**
 * Fetch a single generated document with all historical versions
 */
export async function fetchGeneratedDocumentById(id) {
  const res = await apiClient.get(`/ai-documents/${id}`);
  return res.data.document;
}

/**
 * Save an edited version for a generated document
 */
export async function saveDocumentVersion(id, payload) {
  const res = await apiClient.post(`/ai-documents/${id}/versions`, payload);
  return res.data.version;
}

/**
 * Export and download a document version as PDF, DOCX, or TXT
 */
export async function downloadGeneratedDocument(id, versionNumber, format = 'pdf', fallbackFilename = 'document') {
  const token = apiClient.getAccessToken();
  const url = `${API_BASE_URL}/ai-documents/${id}/versions/${versionNumber}/export?format=${format}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = 'Failed to export document';
    try {
      const errJson = await res.json();
      errMessage = errJson.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  // Extract filename from Content-Disposition if present
  let filename = `${fallbackFilename}.${format}`;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Attach a generated document directly to a JobApplication
 */
export async function attachDocumentToApplication(id, payload) {
  const res = await apiClient.post(`/ai-documents/${id}/attach-application`, payload);
  return res.data;
}

/**
 * Delete a generated document draft and its versions
 */
export async function deleteGeneratedDocument(id) {
  const res = await apiClient.delete(`/ai-documents/${id}`);
  return res;
}
