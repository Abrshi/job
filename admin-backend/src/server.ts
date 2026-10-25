import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { sourceScheduler } from './modules/scheduler/scheduler.service';

const server = app.listen(env.PORT, () => {
  logger.info(`[AdminBackend] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  logger.info(`[AdminBackend] Health check available at http://localhost:${env.PORT}/api/v1/health`);

  // Warm up database connection in background
  prisma.$queryRaw`SELECT 1`.catch((err) => {
    logger.warn(`[AdminBackend] Initial database connection warmup notice: ${(err as Error).message || err}`);
  });

  // Start background job source scheduler (ingestion authority)
  if (env.ENABLE_SCHEDULER) {
    logger.info('[AdminBackend] Background job source scheduler is enabled.');
    sourceScheduler.start();
  } else {
    logger.info('[AdminBackend] Background job source scheduler is disabled by config.');
  }
});

const handleShutdown = async (signal: string) => {
  logger.info(`[AdminBackend] Received ${signal}. Starting graceful shutdown...`);

  // Stop dynamic scheduler timer if running
  if (sourceScheduler.isRunning) {
    sourceScheduler.stop();
  }

  server.close(async () => {
    logger.info('[AdminBackend] HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('[AdminBackend] Prisma disconnected.');
    } catch (err) {
      logger.error('[AdminBackend] Error during Prisma disconnect:', err);
    }
    process.exit(0);
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    logger.error('[AdminBackend] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

