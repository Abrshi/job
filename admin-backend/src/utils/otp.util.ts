import crypto from 'crypto';

/**
 * Generate a cryptographically secure 6-digit numeric OTP string.
 */
export function generateNumericOtp(): string {
  const code = crypto.randomInt(100000, 1000000);
  return code.toString();
}

/**
 * Generate a cryptographically secure random url-safe token for email verification links.
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a plain verification code or token using SHA-256.
 */
export function hashVerificationCode(rawCode: string): string {
  return crypto.createHash('sha256').update(rawCode.trim()).digest('hex');
}

/**
 * Securely compare a provided code with a stored SHA-256 hash.
 */
export function verifyCodeHash(rawCode: string, storedHash: string): boolean {
  if (!rawCode || !storedHash) return false;
  const computedHash = hashVerificationCode(rawCode);
  const bufA = Buffer.from(computedHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

