import { parsePhoneNumberFromString, PhoneNumber } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string | null;
  nationalNumber?: string;
  countryCallingCode?: string;
  error?: string;
}

/**
 * Normalizes and validates a phone number.
 * Defaults to Ethiopia (ET) if no country code prefix is provided,
 * supporting Ethiopian mobile formats (09..., 07..., 2519..., 2517...).
 * Also supports international numbers in E.164 format.
 */
export function normalizePhoneNumber(rawInput: string): PhoneValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, e164: null, error: 'Phone number is required.' };
  }

  // Remove spaces, hyphens, parentheses, and tabs
  let cleaned = rawInput.trim().replace(/[\s\-\(\)\.]+/g, '');

  if (!cleaned) {
    return { isValid: false, e164: null, error: 'Phone number cannot be empty.' };
  }

  // Normalize Ethiopian local formats
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '+251' + cleaned.slice(1);
  } else if (cleaned.startsWith('07') && cleaned.length === 10) {
    cleaned = '+251' + cleaned.slice(1);
  } else if ((cleaned.startsWith('9') || cleaned.startsWith('7')) && cleaned.length === 9) {
    cleaned = '+251' + cleaned;
  } else if (cleaned.startsWith('251') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Attempt parse with libphonenumber-js (default country ET)
  try {
    let parsed: PhoneNumber | undefined = parsePhoneNumberFromString(cleaned, 'ET');

    if (!parsed && !cleaned.startsWith('+')) {
      parsed = parsePhoneNumberFromString('+' + cleaned);
    }

    if (!parsed || !parsed.isValid()) {
      // Fallback regex validation for Ethiopian numbers in case of specific prefix updates
      const ethiopianRegex = /^\+251(9|7)\d{8}$/;
      if (ethiopianRegex.test(cleaned)) {
        return {
          isValid: true,
          e164: cleaned,
          nationalNumber: cleaned.slice(4),
          countryCallingCode: '251',
        };
      }

      return {
        isValid: false,
        e164: null,
        error: 'Please enter a valid phone number (e.g., +251 91 123 4567 or 0911234567).',
      };
    }

    return {
      isValid: true,
      e164: parsed.format('E.164'),
      nationalNumber: parsed.nationalNumber,
      countryCallingCode: parsed.countryCallingCode,
    };
  } catch (err: any) {
    return {
      isValid: false,
      e164: null,
      error: 'Invalid phone number format.',
    };
  }
}

