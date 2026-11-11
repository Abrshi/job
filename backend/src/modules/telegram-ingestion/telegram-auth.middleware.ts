                      import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { AppError } from '../../middleware/error-handler';

const MAX_CLOCK_SKEW_SECONDS = 300; // 5 minutes

export function authenticateTelegramWorker(req: Request, res: Response, next: NextFunction): void {
  const secret = env.TELEGRAM_INTERNAL_API_SECRET;
  if (!secret) {
    logger.error('[TelegramAuth] TELEGRAM_INTERNAL_API_SECRET is not configured on the server.');
    throw AppError.internal('Internal Telegram authentication is unconfigured.');
  }

  // 1. Check Bearer / Direct Secret Header
  const authHeader = req.headers.authorization;
  const directSecretHeader = req.headers['x-internal-secret'] as string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return next();
    }
  }

  if (directSecretHeader) {
    const token = directSecretHeader.trim();
    if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return next();
    }
  }

  // 2. Check HMAC Request Signature
  const signatureHeader = req.headers['x-telegram-worker-signature'] as string | undefined;
  const timestampHeader = req.headers['x-telegram-worker-timestamp'] as string | undefined;

  if (!signatureHeader || !timestampHeader) {
    logger.warn('[TelegramAuth] Missing Telegram worker credentials or signature headers.');
    throw AppError.unauthorized('Missing Telegram worker authentication credentials.', 'MISSING_WORKER_CREDENTIALS');
  }

  const timestampNum = Number(timestampHeader);
  const now = Math.floor(Date.now() / 1000);
  const timestampSeconds = isNaN(timestampNum) ? Math.floor(new Date(timestampHeader).getTime() / 1000) : (timestampNum > 1e11 ? Math.floor(timestampNum / 1000) : timestampNum);

  if (isNaN(timestampSeconds) || Math.abs(now - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    logger.warn(`[TelegramAuth] Rejected webhook with expired or skewed timestamp: ${timestampHeader} (now: ${now})`);
    throw AppError.unauthorized('Webhook timestamp is outside acceptable clock skew window (5 minutes).', 'INVALID_TIMESTAMP');
  }

  // Compute expected HMAC SHA-256 over `${timestampHeader}.${body}`
  const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const dataToSign = `${timestampHeader}.${payloadString}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

  const providedBuf = Buffer.from(signatureHeader.trim().toLowerCase());
  const expectedBuf = Buffer.from(expectedSignature.toLowerCase());

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    logger.warn('[TelegramAuth] Invalid HMAC signature provided by Telegram worker.');
    throw AppError.unauthorized('Invalid Telegram worker signature.', 'INVALID_WORKER_SIGNATURE');
  }

  return next();
}
