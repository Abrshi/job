'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { scheduleInterview } from '@/lib/jobs-api';

export function ScheduleInterviewModal({ applicationId, isOpen, onClose, onSuccess, existingRoundsCount = 0 }) {
  const [title, setTitle] = useState('');
  const [roundNumber, setRoundNumber] = useState(existingRoundsCount + 1);
  const [interviewType, setInterviewType] = useState('VIDEO');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [timezone, setTimezone] = useState('UTC');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [locationUrl, setLocationUrl] = useState('');
  const [interviewerInfo, setInterviewerInfo] = useState('');
  const [preparationNotes, setPreparationNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setTimezone(userTz);
    } catch {
      setTimezone('UTC');
    }

    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setRoundNumber(existingRoundsCount + 1);
    setTitle(`Round ${existingRoundsCount + 1} Interview`);
  }, [isOpen, existingRoundsCount]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Interview title is required.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setError('Scheduled date and time are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isoDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      const payload = {
        roundNumber: Number(roundNumber) || 1,
        title: title.trim(),
        interviewType,
        scheduledAt: isoDateTime,
        timezone,
        durationMinutes: Number(durationMinutes) || 60,
        locationUrl: locationUrl.trim() || undefined,
        interviewerInfo: interviewerInfo.trim() || undefined,
        preparationNotes: preparationNotes.trim() || undefined,
      };

      const result = await scheduleInterview(applicationId, payload);
      if (onSuccess) {
        onSuccess(result.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to schedule interview round.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-stormy-border rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-elevated space-y-4 my-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-stormy-main">
              Schedule Interview Round
            </h3>
            <p className="text-xs text-stormy-muted mt-0.5">
              Track meeting details, prep notes, and interviewers.
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

        {error && (
          <div className="p-3 bg-feedback-danger-bg border border-feedback-danger-border rounded-xl text-xs text-feedback-danger-text">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-semibold text-stormy-dark mb-1">
                Interview Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Technical System Design"
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Round #
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={roundNumber}
                onChange={(e) => setRoundNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Interview Format
              </label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none bg-white font-medium"
              >
                <option value="VIDEO">Video Call (Google Meet / Zoom)</option>
                <option value="PHONE">Phone Screen</option>
                <option value="IN_PERSON">In-Person (Office)</option>
                <option value="TAKE_HOME">Take-Home Assessment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Duration (minutes)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none bg-white"
              >
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins (1 hr)</option>
                <option value={90}>90 mins (1.5 hrs)</option>
                <option value={120}>120 mins (2 hrs)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stormy-dark mb-1">
                Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="e.g. Africa/Addis_Ababa or UTC"
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Meeting URL or Office Address
            </label>
            <input
              type="url"
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Interviewer(s) Info (Optional)
            </label>
            <input
              type="text"
              value={interviewerInfo}
              onChange={(e) => setInterviewerInfo(e.target.value)}
              placeholder="e.g. Dawit (Lead Engineer) & Sara (Director)"
              className="w-full px-3 py-2 rounded-xl border border-stormy-border text-xs focus:ring-2 focus:ring-stormy-sky focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-stormy-dark mb-1">
              Preparation Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={preparationNotes}
              onChange={(e) => setPreparationNotes(e.target.value)}
              placeholder="e.g. Review system architecture, prepared answers for questions on microservices..."
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
              {isSubmitting ? 'Scheduling...' : 'Save Interview'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
