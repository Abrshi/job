import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Helper to sanitize environment strings (strips trailing commas, wrapping quotes, and extraneous whitespace)
const sanitizeEnvString = (val: string | undefined): string | undefined => {
  if (val === undefined || val === null) return undefined;
  let str = String(val).trim();
  if (str.endsWith(',')) str = str.slice(0, -1).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  if (str.endsWith(',')) str = str.slice(0, -1).trim();
  return str.length > 0 ? str : undefined;
};

// Normalize Google Service Account environment variables from either prefixed or direct JSON-style names
const rawClientEmail = sanitizeEnvString(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL
);

let rawPrivateKey = sanitizeEnvString(
  process.env.GOOGLE_PRIVATE_KEY ||
    process.env.PRIVATE_KEY
);
if (rawPrivateKey) {
  // Normalize escaped newline characters into actual newlines
  rawPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
}

const rawProjectId = sanitizeEnvString(
  process.env.GOOGLE_PROJECT_ID ||
    process.env.PROJECT_ID
);

const rawDriveFolderId = sanitizeEnvString(
  process.env.GOOGLE_DRIVE_FOLDER_ID ||
    process.env.DRIVE_FOLDER_ID ||
    process.env.GOOGLE_FOLDER_ID ||
    process.env.FOLDER_ID
);

const rawClientId = sanitizeEnvString(
  process.env.GOOGLE_CLIENT_ID ||
    process.env.CLIENT_ID
);

const rawEmailUser = sanitizeEnvString(process.env.EMAIL_USER);
const rawGoogleAppPassword = sanitizeEnvString(process.env.GOOGLE_APP_PASSWORD);
const rawSmsDeviceToken = sanitizeEnvString(process.env.SMS_DEVICE_TOKEN);
const rawSmsApiUrl = sanitizeEnvString(process.env.SMS_API_URL);
const rawTelegramBotToken = sanitizeEnvString(process.env.TELEGRAM_BOT_TOKEN);
const rawTelegramChannelId = sanitizeEnvString(process.env.TELEGRAM_CHANNEL_ID) || '@etjobcollector';
const rawExchangeRatesJson = sanitizeEnvString(process.env.EXCHANGE_RATES_JSON);
const rawTelegramAutoPostStartDate = sanitizeEnvString(process.env.TELEGRAM_AUTO_POST_START_DATE);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_PROVIDER: z.enum(['mysql', 'mariadb', 'postgres', 'postgresql']).optional(),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  ADMIN_FRONTEND_ORIGIN: z.string().default('http://localhost:3001'),
  ACCESS_TOKEN_SECRET: z.string().min(16, 'ACCESS_TOKEN_SECRET must be at least 16 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  PRIVATE_KEY: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
  PROJECT_ID: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  FOLDER_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  CLIENT_ID: z.string().optional(),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  EMAIL_USER: z.string().optional(),
  GOOGLE_APP_PASSWORD: z.string().optional(),
  SMS_DEVICE_TOKEN: z.string().optional(),
  SMS_API_URL: z.string().default('https://sms-connect.vercel.app'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().default('@etjobcollector'),
  EXCHANGE_RATES_JSON: z.string().optional(),
  TELEGRAM_MIN_SALARY_ETB: z.coerce.number().default(20000),
  TELEGRAM_AUTO_POST_START_DATE: z.string().optional(),
  ENABLE_SCHEDULER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
});

export type Env = z.infer<typeof envSchema>;

const parseEnv = (): Env => {
  const mergedEnv = {
    ...process.env,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: rawClientEmail,
    CLIENT_EMAIL: rawClientEmail,
    GOOGLE_PRIVATE_KEY: rawPrivateKey,
    PRIVATE_KEY: rawPrivateKey,
    GOOGLE_PROJECT_ID: rawProjectId,
    PROJECT_ID: rawProjectId,
    GOOGLE_DRIVE_FOLDER_ID: rawDriveFolderId,
    FOLDER_ID: rawDriveFolderId,
    GOOGLE_CLIENT_ID: rawClientId,
    CLIENT_ID: rawClientId,
    EMAIL_USER: rawEmailUser,
    GOOGLE_APP_PASSWORD: rawGoogleAppPassword,
    SMS_DEVICE_TOKEN: rawSmsDeviceToken,
    SMS_API_URL: rawSmsApiUrl || 'https://sms-connect.vercel.app',
    TELEGRAM_BOT_TOKEN: rawTelegramBotToken,
    TELEGRAM_CHANNEL_ID: rawTelegramChannelId,
    EXCHANGE_RATES_JSON: rawExchangeRatesJson,
    TELEGRAM_AUTO_POST_START_DATE: rawTelegramAutoPostStartDate,
  };

  const result = envSchema.safeParse(mergedEnv);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};

export const env = parseEnv();

export const getDatabaseProvider = (): 'mysql' | 'postgresql' => {
  if (env.DB_PROVIDER) {
    const p = env.DB_PROVIDER.toLowerCase();
    if (p.includes('postgre') || p === 'pg') return 'postgresql';
    if (p.includes('mysql') || p.includes('mariadb')) return 'mysql';
  }
  const url = env.DATABASE_URL.toLowerCase();
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }
  return 'mysql';
};

