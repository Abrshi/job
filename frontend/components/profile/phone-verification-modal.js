'use client';

import React, { useState, useEffect } from 'react';
import { requestPhoneVerification, confirmPhoneVerification } from '@/lib/verification-api';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export function PhoneVerificationModal({ isOpen, onClose, initialPhoneNumber, onVerified }) {
  const [step, setStep] = useState('request'); // 'request' | 'verify'
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (initialPhoneNumber) {
      setPhoneNumber(initialPhoneNumber);
    }
  }, [initialPhoneNumber]);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleSendCode = async (e) => {
    e?.preventDefault?.();
    if (!phoneNumber.trim()) {
      setError('Please provide a valid phone number.');
      return;
    }

    setError(null);
    setStatusMessage(null);
    setLoading(true);

    try {
      const res = await requestPhoneVerification(phoneNumber.trim());
      setPhoneNumber(res.data?.phoneNumber || phoneNumber);
      setStatusMessage(res.message || 'Verification code sent via SMS.');
      setCooldown(res.data?.cooldownSeconds || 60);
      setStep('verify');
    } catch (err) {
      setError(err.message || 'Failed to dispatch SMS verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e) => {
    e?.preventDefault?.();
    const cleanCode = code.trim();
    if (cleanCode.length < 4) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await confirmPhoneVerification(cleanCode);
      setStatusMessage(res.message || 'Phone number verified successfully!');
      if (onVerified) {
        onVerified(res.data?.phoneNumber || phoneNumber);
      }
      setTimeout(() => {
        onClose();
        setStep('request');
        setCode('');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Phone Verification</h3>
            <p className="text-xs text-gray-500">Verify your mobile phone via SMS to gain +2.5% profile strength.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        {statusMessage && (
          <div className="mb-4">
            <Alert variant="success">{statusMessage}</Alert>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mobile Phone Number
              </label>
              <input
                type="tel"
                placeholder="+251 91 123 4567 or 0911234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
                autoFocus
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Supports Ethiopian numbers (09..., 07..., +251...) and international E.164.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={loading} disabled={loading || !phoneNumber.trim()}>
                Send SMS Code
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmCode} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Verification Code
                </label>
                <span className="text-xs text-gray-500 font-mono">{phoneNumber}</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
                autoFocus
              />
              <p className="text-[11px] text-gray-400 mt-1 text-center">
                Enter the 6-digit code received on your phone.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-blue-600 hover:text-blue-700 underline cursor-pointer"
              >
                Change number
              </button>

              <button
                type="button"
                onClick={handleSendCode}
                disabled={cooldown > 0 || loading}
                className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:no-underline underline cursor-pointer"
              >
                {cooldown > 0 ? `Resend SMS in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Close
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={loading} disabled={loading || code.length < 4}>
                Confirm Verification
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

