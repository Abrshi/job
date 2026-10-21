import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env, getDatabaseProvider } from '../config/env';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = (): PrismaClient => {
  const provider = getDatabaseProvider();

  if (provider === 'postgresql') {
    logger.info('Initializing Prisma Client with PostgreSQL adapter (PrismaPg)');
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  logger.info('Initializing Prisma Client with MySQL / MariaDB adapter (PrismaMariaDb)');
  let connStr = env.DATABASE_URL;
  if (connStr.startsWith('mysql://')) {
    connStr = 'mariadb://' + connStr.slice('mysql://'.length);
  }
  if (connStr.includes('socket=') && !connStr.includes('socketPath=')) {
    connStr = connStr.replace('socket=', 'socketPath=');
  }
  const adapter = new PrismaMariaDb(connStr);
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
