import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function seedSources(): Promise<{ created: boolean; slug: string }> {
  const existing = await prisma.jobSource.findUnique({
    where: { slug: 'afriwork' },
  });

  if (existing) {
    logger.info('Afriwork job source already exists. Skipping creation.');
    return { created: false, slug: 'afriwork' };
  }

  await prisma.jobSource.create({
    data: {
      name: 'Afriwork',
      slug: 'afriwork',
      type: 'API',
      endpointUrl: 'https://api.afriworket.com/v1/graphql',
      isActive: false, // Disabled by default until live auth webhook credentials are configured
      pollingInterval: 60,
    },
  });

  logger.info('Afriwork job source created successfully (disabled by default pending credentials).');
  return { created: true, slug: 'afriwork' };
}
