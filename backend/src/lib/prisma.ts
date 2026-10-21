import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = (): PrismaClient => {
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
