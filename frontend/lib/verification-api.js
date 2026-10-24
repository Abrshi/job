import { apiClient } from './api-client.js';

/**
 * Request phone verification code via SMS
 */
export async function requestPhoneVerification(phoneNumber) {
  const res = await apiClient.post('/profile/phone/request-verification', { phoneNumber });
  return res.data;
}

/**
 * Confirm phone verification code
 */
export async function confirmPhoneVerification(code) {
  const res = await apiClient.post('/profile/phone/confirm-verification', { code });
  return res.data;
}

/**
 * Fetch current user email & phone verification status
 */
export async function fetchVerificationStatus() {
  const res = await apiClient.get('/profile/verification-status');
  return res.data?.status;
}

/**
 * Resend email verification
 */
export async function resendEmailVerification(email) {
  const res = await apiClient.post('/auth/resend-verification', { email });
  return res;
}
