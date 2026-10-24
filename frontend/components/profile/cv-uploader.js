'use client';

import React, { useState, useRef } from 'react';
import { uploadDocument } from '../../lib/documents-api';

export function CvUploader({ onExtracted, onStartManual }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0); // 1: upload, 2: extract, 3: analyze
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF or Word document (.pdf, .docx).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit. Please upload a smaller file.');
      return;
    }

    setUploading(true);
    setStep(1); // Uploading & storing to Google Drive

    try {
      // Simulate stepper progress feedback for user assurance
      const stepTimer1 = setTimeout(() => setStep(2), 1200); // Parsing text
      const stepTimer2 = setTimeout(() => setStep(3), 2500); // AI Taxonomy & Structure Extraction

      const document = await uploadDocument(file, 'CV');

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setStep(4); // Done

      setTimeout(() => {
        setUploading(false);
        setStep(0);
        if (onExtracted) {
          onExtracted(document);
        }
      }, 800);
    } catch (err) {
      setUploading(false);
      setStep(0);
      setError(err.message || 'Failed to process document. Please try again or start manually.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white border border-blue-200/80 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
          <span>✨ Fast Onboarding</span>
          <span>•</span>
          <span>CV-First Auto-Fill</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Build Your Profile in Seconds</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload your existing CV or resume. Our AI extracts your work experience, education, and skills
          so you don't have to fill out long forms manually. You can review and edit everything before saving.
        </p>

        {/* Upload Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-600 bg-blue-50/80 scale-[1.01]'
              : 'border-gray-300 hover:border-blue-400 bg-white/80 hover:bg-white'
          } ${uploading ? 'pointer-events-none opacity-90' : ''}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
          />

          {!uploading ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-900 mb-1">
                Drop your CV here, or <span className="text-blue-600 underline">browse files</span>
              </p>
              <p className="text-xs text-gray-500 mb-3">Supports PDF and DOCX up to 10MB</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Stored privately in your secure Google Drive
              </span>
            </div>
          ) : (
            <div className="py-4">
              <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-900">
                  {step === 1 && '1/3 Encrypting & Storing in Google Drive...'}
                  {step === 2 && '2/3 Extracting text from document...'}
                  {step === 3 && '3/3 AI analyzing career history & skills...'}
                  {step === 4 && '✓ Extraction complete! Preparing review...'}
                </p>
                <div className="w-48 bg-gray-200 rounded-full h-1.5 mx-auto overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${step * 25}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">Please wait a few seconds</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Alternative action */}
        {onStartManual && !uploading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>Don't have a CV right now?</span>
            <button
              type="button"
              onClick={onStartManual}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Fill out your profile manually →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

