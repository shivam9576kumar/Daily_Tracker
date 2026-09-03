import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import logger from '../../utils/logger';

import { env } from '../../config/env';
import { dateKeyInTz } from '../../utils/dateKeys';

function todayKey() {
  return dateKeyInTz(new Date(), env.DEFAULT_TIMEZONE);
}

export const cronRunService = {
  async runOncePerDay(jobName: string, runner: () => Promise<void>) {
    const runDate = todayKey();

    // Check if the cron job already ran for today before attempting insert
    const existing = await prisma.cronRun.findUnique({
      where: {
        jobName_runDate: {
          jobName,
          runDate,
        },
      },
    });

    if (existing) {
      logger.info(`⏭️ Cron skipped: ${jobName} already ran for ${runDate}`);
      return;
    }

    try {
      await prisma.cronRun.create({
        data: {
          jobName,
          runDate,
          status: 'running',
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        logger.info(`⏭️ Cron skipped: ${jobName} already ran for ${runDate}`);
        return;
      }

      throw err;
    }

    logger.info(`⏰ Cron started: ${jobName} (${runDate})`);

    try {
      await runner();

      await prisma.cronRun.updateMany({
        where: {
          jobName,
          runDate,
        },
        data: {
          status: 'completed',
          completedAt: new Date(),
          error: null,
        },
      });

      logger.info(`✅ Cron completed: ${jobName} (${runDate})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      await prisma.cronRun.updateMany({
        where: {
          jobName,
          runDate,
        },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: message,
        },
      });

      logger.error(`❌ Cron failed: ${jobName}`, err);
      throw err;
    }
  },
};
