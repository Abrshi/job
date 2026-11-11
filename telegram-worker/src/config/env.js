import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

function parseNumber(val, fallback) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

const apiIdRaw = process.env.TELEGRAM_API_ID || process.env.API_ID;
const apiId = parseNumber(apiIdRaw, 0);

const apiHash = (process.env.TELEGRAM_API_HASH || process.env.API_HASH || '').trim();
const sessionString = (process.env.TELEGRAM_SESSION || process.env.SESSION || '').trim();

const sessionsDir = path.resolve(process.cwd(), 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseNumber(process.env.PORT, 5002),
  
  // Telegram credentials
  API_ID: apiId,
  API_HASH: apiHash,
  TELEGRAM_SESSION: sessionString,
  SESSION_FILE_PATH: process.env.TELEGRAM_SESSION_FILE || path.join(sessionsDir, 'gramjs.session'),

  // Backend Webhook Integration
  BACKEND_URL: (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  INTERNAL_API_SECRET: (process.env.INTERNAL_API_SECRET || process.env.TELEGRAM_INTERNAL_API_SECRET || 'development_telegram_worker_internal_secret_key_12345').trim(),
  WEBHOOK_PATH: process.env.WEBHOOK_PATH || '/api/v1/internal/telegram/messages',
  CHANNELS_SYNC_PATH: process.env.CHANNELS_SYNC_PATH || '/api/v1/internal/telegram/channels',

  // Outbox & Delivery
  OUTBOX_DB_PATH: process.env.OUTBOX_DB_PATH || path.join(sessionsDir, 'outbox.db'),
  OUTBOX_FLUSH_INTERVAL_MS: parseNumber(process.env.OUTBOX_FLUSH_INTERVAL_MS, 3000),
  MAX_RETRY_ATTEMPTS: parseNumber(process.env.MAX_RETRY_ATTEMPTS, 10),
  WEBHOOK_TIMEOUT_MS: parseNumber(process.env.WEBHOOK_TIMEOUT_MS, 15000),
};
