import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function seedSources(): Promise<{ createdCount: number }> {
  let createdCount = 0;

  // 1. Afriwork
  const afriworkExisting = await prisma.jobSource.findUnique({
    where: { slug: 'afriwork' },
  });

  if (!afriworkExisting) {
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
    createdCount++;
  } else {
    logger.info('Afriwork job source already exists. Skipping creation.');
  }

  // 2. HaHuJobs
  const hahuExisting = await prisma.jobSource.findUnique({
    where: { slug: 'hahujobs' },
  });

  if (!hahuExisting) {
    await prisma.jobSource.create({
      data: {
        name: 'HaHuJobs',
        slug: 'hahujobs',
        type: 'API',
        endpointUrl: 'https://graph.aggregator.hahu.jobs/v1/graphql',
        isActive: false, // Disabled by default pending official permission verification
        pollingInterval: 120, // 2 hours
      },
    });
    logger.info('HaHuJobs source created successfully (disabled by default pending confirmation).');
    createdCount++;
  } else {
    logger.info('HaHuJobs source already exists. Skipping creation.');
  }

  // 3. Ethiojobs
  const ethioExisting = await prisma.jobSource.findUnique({
    where: { slug: 'ethiojobs' },
  });

  if (!ethioExisting) {
    await prisma.jobSource.create({
      data: {
        name: 'Ethiojobs',
        slug: 'ethiojobs',
        type: 'API',
        endpointUrl: 'https://ethiojobs.net',
        isActive: false, // Disabled by default pending official permission verification
        pollingInterval: 120, // 2 hours
      },
    });
    logger.info('Ethiojobs source created successfully (disabled by default pending confirmation).');
    createdCount++;
  } else {
    logger.info('Ethiojobs source already exists. Skipping creation.');
  }

  return { createdCount };
}
