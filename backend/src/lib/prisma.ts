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
    let connStr = env.DATABASE_URL;
    // Normalize connection parameters for Neon PostgreSQL pooler
    if (connStr.includes('channel_binding=')) {
      connStr = connStr.replace(/([?&])channel_binding=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
    }

    const pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    pool.on('error', (err) => {
      logger.warn(`PostgreSQL client pool notice: ${err.message}`);
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
