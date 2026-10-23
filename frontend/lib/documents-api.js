import { apiClient } from './api-client.js';

/**
 * Upload a document (PDF or Word)
 */
export async function uploadDocument(file, documentType = 'CV') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const res = await apiClient.post('/documents/upload', formData);
  return res.data.document;
}

/**
 * Fetch all documents for the current authenticated user
 */
export async function fetchDocuments() {
  const res = await apiClient.get('/documents');
  return res.data.documents || [];
}

/**
 * Fetch single document metadata and extracted data
 */
export async function fetchDocument(documentId) {
  const res = await apiClient.get(`/documents/${documentId}`);
  return res.data.document;
}

/**
 * Delete a document from storage and database
 */
export async function deleteDocument(documentId) {
  const res = await apiClient.delete(`/documents/${documentId}`);
  return res.data;
}

/**
 * Re-trigger extraction on an existing document
 */
export async function retryDocumentExtraction(documentId) {
  const res = await apiClient.post(`/documents/${documentId}/retry`);
  return res.data.document;
}

/**
 * Download a document file safely via authenticated endpoint
 */
export async function downloadDocument(documentId, filename = 'document') {
  const token = apiClient.getAccessToken();
  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/documents/${documentId}/download`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to download document');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(blobUrl);
  document.body.removeChild(a);
}
