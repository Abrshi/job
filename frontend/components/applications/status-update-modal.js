'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateApplicationStatus } from '@/lib/jobs-api';
import { StatusBadge } from './status-badge';

const VALID_TRANSITIONS = {
  DRAFT: ['APPLIED', 'WITHDRAWN'],
  APPLIED: ['IN_REVIEW', 'INTERVIEW', 'REJECTED', 'WITHDRAWN'],
  IN_REVIEW: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'APPLIED'],
  INTERVIEW: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'IN_REVIEW'],
  OFFER: ['REJECTED', 'WITHDRAWN', 'INTERVIEW'],
  REJECTED: ['IN_REVIEW', 'INTERVIEW', 'APPLIED'],
  WITHDRAWN: ['APPLIED'],
};

const STATUS_LABELS = {
  DRAFT: 'Draft (In preparation)',
  APPLIED: 'Applied (Submitted)',
  IN_REVIEW: 'In Review (Screening)',
  INTERVIEW: 'Interview (Active rounds)',
  OFFER: 'Offer (Offer extended)',
  REJECTED: 'Declined / Rejected',
  WITHDRAWN: 'Withdrawn by candidate',
};

export function StatusUpdateModal({ application, isOpen, onClose, onSuccess }) {
  const currentStatus = application?.status || 'APPLIED';
  const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];

  const [selectedStatus, setSelectedStatus] = useState(allowedNextStatuses[0] || 'IN_REVIEW');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !application) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    setIsSubmitting(true);
    try {
      const updated = await updateApplicationStatus(
        application.id,
        selectedStatus,
        reason.trim() || undefined
      );
      if (onSuccess) {
        onSuccess(updated.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-white border border-stormy-border rounded-2xl p-6 max-w-md w-full shadow-elevated space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-stormy-main">
              Update Application Status
            </h3>
            <p className="text-xs text-stormy-muted mt-0.5 truncate max-w-xs">
              {application.jobTitle || application.title} · {application.companyName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stormy-muted hover:text-stormy-dark p-1 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 p-3 bg-stormy-canvas rounded-xl border border-stormy-border text-xs">
          <span className="font-semibold text-stormy-muted">Current Status:</span>
          <StatusBadge status={currentStatus} size="sm" />
        </div>

        {error && (
          <div className="p-3 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-xs text-feedback-danger-text">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              New Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none bg-white font-medium"
            >
              {allowedNextStatuses.map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st] || st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Audit Note / Reason (Optional)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received interview confirmation email; correcting mistaken click..."
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stormy-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Save Status'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
