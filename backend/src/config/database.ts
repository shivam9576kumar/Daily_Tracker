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

prisma.$connect()
  .then(() => logger.info('✅ Connected to PostgreSQL via Prisma'))
  .catch((err) => logger.error('❌ Database connection failed', err));

export default prisma;
export { prisma };
