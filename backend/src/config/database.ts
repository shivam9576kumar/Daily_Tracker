import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
    ...(process.env.NODE_ENV === 'development' ? ([{ emit: 'event', level: 'query' }] as const) : []),
  ],
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

prisma.$on('error' as any, (e: any) => logger.error('Prisma error', e));
prisma.$on('warn' as any, (e: any) => logger.warn('Prisma warn', e));
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as any, (e: any) => {
    if (e.duration >= 500) logger.warn(`Slow query ${e.duration}ms: ${String(e.query).slice(0, 180)}`);
  });
}

/**
 * Prisma connects lazily on the first query. server.ts connects explicitly
 * at boot so startup failures are visible and exit the process.
 * Do not connect at import time.
 */
export default prisma;
export { prisma };
