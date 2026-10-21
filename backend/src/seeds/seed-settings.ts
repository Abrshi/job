import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function seedSiteSettings() {
  const existing = await prisma.siteSetting.findUnique({
    where: { id: 'default' },
  });

  if (existing) {
    logger.info('Default site settings already exist. Skipping creation.');
    return { created: false, settings: existing };
  }

  const settings = await prisma.siteSetting.create({
    data: {
      id: 'default',
      siteName: 'JobSphere',
      tagline: 'Ethiopia & East Africa Premier Job Aggregation Platform',
      description: 'Discover curated job opportunities aggregated across top portals, direct employers, and verified recruiters.',
      supportEmail: 'support@job.com',
      footerText: '© 2026 JobSphere Aggregation Platform. All rights reserved.',
    },
  });

  logger.info('Default site settings created successfully.');
  return { created: true, settings };
}
