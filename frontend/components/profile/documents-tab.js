'use client';

import React, { useState, useEffect } from 'react';
import { fetchDocuments, deleteDocument, downloadDocument, uploadDocument } from '../../lib/documents-api';

export function DocumentsTab({ onUploadNew }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteDocument(id);
      setDocuments(documents.filter((d) => d.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const handleDownload = async (id, name) => {
    try {
      await downloadDocument(id, name);
    } catch (err) {
      alert(err.message || 'Download failed');
    }
  };

  const handleQuickUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDocument(file, 'CV');
      await loadDocs();
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Stored CVs & Documents</h3>
          <p className="text-xs text-gray-500 mt-1">
            Original files are stored securely in your private Google Drive application folder.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-xs flex items-center gap-2">
            <span>+ Upload CV</span>
            <input
              type="file"
              onChange={handleQuickUpload}
              accept=".pdf,.docx,.doc"
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading your stored documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
            📁
          </div>
          <p className="text-sm font-semibold text-gray-800">No documents uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload your CV or resume to enable auto-fill and secure cloud backup.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 mt-4">
          {documents.map((doc) => (
            <div key={doc.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {doc.originalFilename.split('.').pop() || 'DOC'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{doc.originalFilename}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span>{Math.round((doc.fileSize || 0) / 1024)} KB</span>
                    <span>•</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-medium">✓ Secure in Google Drive</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(doc.id, doc.originalFilename)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  Download ↓
                </button>
                <button
                  onClick={() => handleDelete(doc.id, doc.originalFilename)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  Delete ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

