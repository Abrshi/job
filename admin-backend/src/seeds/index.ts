import { seedCategories } from './seed-categories';
import { seedAdmin } from './seed-admin';
import { seedSources } from './seed-sources';
import { seedSiteSettings } from './seed-settings';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function runAllSeeds() {
  logger.info('Starting platform database seeds...');
  try {
    await seedCategories();
    await seedAdmin();
    await seedSources();
    await seedSiteSettings();
    logger.info('All database seeds completed successfully.');
  } catch (err) {
    logger.error('Failed to run seeds:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// If executed directly from CLI:
if (require.main === module || process.argv[1]?.endsWith('seeds/index.ts')) {
  runAllSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
