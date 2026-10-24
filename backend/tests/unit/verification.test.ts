import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber } from '../../src/utils/phone.util';
import {
  generateNumericOtp,
  generateVerificationToken,
  hashVerificationCode,
  verifyCodeHash,
} from '../../src/utils/otp.util';
import { profileCompletionService } from '../../src/modules/profile/profile-completion.service';

describe('Phone Number Normalization & Validation', () => {
  it('normalizes Ethiopian 10-digit mobile starting with 09', () => {
    const res = normalizePhoneNumber('0911223344');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+251911223344');
  });

  it('normalizes Ethiopian 10-digit mobile starting with 07 (Safaricom)', () => {
    const res = normalizePhoneNumber('0712345678');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+251712345678');
  });

  it('normalizes Ethiopian 9-digit mobile without leading 0', () => {
    const res = normalizePhoneNumber('911223344');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+251911223344');
  });

  it('normalizes Ethiopian number with spaces, hyphens and country code', () => {
    const res = normalizePhoneNumber('+251 91 122 3344');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+251911223344');
  });

  it('normalizes Ethiopian number starting with 251 without +', () => {
    const res = normalizePhoneNumber('251911223344');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+251911223344');
  });

  it('validates standard international E.164 phone numbers', () => {
    const res = normalizePhoneNumber('+14155552671');
    assert.equal(res.isValid, true);
    assert.equal(res.e164, '+14155552671');
  });

  it('rejects invalid inputs and non-numbers gracefully', () => {
    const res1 = normalizePhoneNumber('');
    assert.equal(res1.isValid, false);

    const res2 = normalizePhoneNumber('abc');
    assert.equal(res2.isValid, false);

    const res3 = normalizePhoneNumber('12345');
    assert.equal(res3.isValid, false);
  });
});

describe('OTP and Token Cryptographic Utilities', () => {
  it('generates a 6-digit numeric OTP', () => {
    const otp = generateNumericOtp();
    assert.equal(typeof otp, 'string');
    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);
  });

  it('generates a 64-character hex verification token', () => {
    const token = generateVerificationToken();
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('hashes code deterministically with SHA-256', () => {
    const hash1 = hashVerificationCode('123456');
    const hash2 = hashVerificationCode('123456');
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  it('verifies code matching and rejects mismatched codes', () => {
    const code = '654321';
    const hash = hashVerificationCode(code);

    assert.equal(verifyCodeHash('654321', hash), true);
    assert.equal(verifyCodeHash('654320', hash), false);
    assert.equal(verifyCodeHash('', hash), false);
  });
});

describe('Profile Completion with Email & Phone Verification', () => {
  it('awards +2.5% for email verification and +2.5% for phone verification', () => {
    const baseProfile = {
      displayName: 'Abreham Yeshitla',
      headline: 'Software Engineer',
      phoneNumber: '+251911223344',
      city: 'Addis Ababa',
      country: 'Ethiopia',
      experiences: [{ companyName: 'Tech Corp', jobTitle: 'Developer' }],
      educations: [{ institution: 'AAU', degree: 'BSc' }],
      skills: [{ name: 'TypeScript' }, { name: 'React' }, { name: 'Node.js' }],
      projects: [{ title: 'JobPlatform' }],
      certifications: [],
      languages: [{ name: 'Amharic' }],
      preferredWorkArrangement: 'HYBRID',
      minSalary: 50000,
      user: {
        firstName: 'Abreham',
        lastName: 'Yeshitla',
        email: 'user@example.com',
        isEmailVerified: false,
      },
      isPhoneVerified: false,
    };

    const unverifiedReport = profileCompletionService.calculateCompletion(baseProfile);
    const verifSectionUnverified = unverifiedReport.sections.find((s) => s.id === 'verification');
    assert.ok(verifSectionUnverified);
    assert.equal(verifSectionUnverified.earned, 0);
    assert.equal(verifSectionUnverified.completed, false);

    // Now test email verified only (+2.5%)
    const emailVerifiedProfile = {
      ...baseProfile,
      user: { ...baseProfile.user, isEmailVerified: true },
    };
    const emailReport = profileCompletionService.calculateCompletion(emailVerifiedProfile);
    const emailSection = emailReport.sections.find((s) => s.id === 'verification');
    assert.equal(emailSection?.earned, 2.5);
    assert.equal(emailSection?.completed, false);

    // Now test both email and phone verified (+5%)
    const bothVerifiedProfile = {
      ...baseProfile,
      user: { ...baseProfile.user, isEmailVerified: true },
      isPhoneVerified: true,
    };
    const bothReport = profileCompletionService.calculateCompletion(bothVerifiedProfile);
    const bothSection = bothReport.sections.find((s) => s.id === 'verification');
    assert.equal(bothSection?.earned, 5);
    assert.equal(bothSection?.completed, true);
    assert.equal(bothReport.percentage, 100);
  });

  it('caps total completion percentage at 100%', () => {
    const fullProfile = {
      displayName: 'Full Profile',
      headline: 'Senior Lead',
      phoneNumber: '+251911223344',
      city: 'Addis Ababa',
      experiences: [{ companyName: 'A', jobTitle: 'Lead' }],
      educations: [{ institution: 'B', degree: 'MSc' }],
      skills: [{ name: 'S1' }, { name: 'S2' }, { name: 'S3' }],
      projects: [{ title: 'P1' }],
      certifications: [{ name: 'C1' }],
      languages: [{ name: 'L1' }],
      preferredWorkArrangement: 'REMOTE',
      minSalary: 100000,
      user: {
        firstName: 'F',
        lastName: 'P',
        email: 'full@example.com',
        isEmailVerified: true,
      },
      isPhoneVerified: true,
    };

    const report = profileCompletionService.calculateCompletion(fullProfile);
    assert.equal(report.percentage, 100);
    assert.equal(report.isComplete, true);
  });
});

