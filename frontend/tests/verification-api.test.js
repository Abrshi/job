import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as verificationApi from '../lib/verification-api.js';

describe('Verification API Client Exports', () => {
  test('exports all phone and email verification methods', () => {
    assert.equal(typeof verificationApi.requestPhoneVerification, 'function');
    assert.equal(typeof verificationApi.confirmPhoneVerification, 'function');
    assert.equal(typeof verificationApi.fetchVerificationStatus, 'function');
    assert.equal(typeof verificationApi.resendEmailVerification, 'function');
  });
});

