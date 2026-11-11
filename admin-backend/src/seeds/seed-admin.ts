import argon2 from 'argon2';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../middleware/error-handler';

export const DEFAULT_ADMIN_EMAIL = 'admin@job.com';
export const DEFAULT_DEV_ADMIN_PASSWORD = 'admin';

export async function seedAdmin(): Promise<{ created: boolean; email: string }> {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
  });

  if (existingAdmin) {
    logger.info(`Admin user (${DEFAULT_ADMIN_EMAIL}) already exists. Skipping password overwrite.`);
    return { created: false, email: DEFAULT_ADMIN_EMAIL };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  let passwordToUse = DEFAULT_DEV_ADMIN_PASSWORD;

  if (isProduction) {
    const securePassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!securePassword || securePassword.trim().length < 8) {
      throw AppError.internal(
        'Cannot seed default development admin credentials in production. Provide a secure ADMIN_INITIAL_PASSWORD.'
      );
    }
    passwordToUse = securePassword.trim();
  }

  const passwordHash = await argon2.hash(passwordToUse, {
    type: argon2.argon2id,
  });

  await prisma.user.create({
    data: {
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  logger.info(`Admin user (${DEFAULT_ADMIN_EMAIL}) created successfully with verified status.`);
  return { created: true, email: DEFAULT_ADMIN_EMAIL };
}
