import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';
import { initCronJobs } from './cron';
import logger from './utils/logger';

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL');

    // Start server
    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
      logger.info(`📋 Environment: ${env.NODE_ENV}`);
      logger.info(`🏥 Health check: http://localhost:${env.PORT}/api/health`);

      // Start cron jobs
      initCronJobs();
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
