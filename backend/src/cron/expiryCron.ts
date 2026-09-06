import prisma from '../config/database';
import { env } from '../config/env';
import { todayKey, addDaysToKey, zonedDayStartUtc } from '../utils/dateKeys';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';

/**
 * Expiry Cron
 *
 * Rule:
 * backlog task older than BACKLOG_EXPIRY_DAYS in user timezone
 * → status = expired
 * → isExpired = true
 *
 * This cron is idempotent:
 * running it multiple times will not expire the same task twice.
 */
export async function runExpiryCron() {
  logger.info('💀 Expiry cron started');

  try {
    const candidates = await prisma.task.findMany({
      where: {
        isBacklog: true,
        isExpired: false,
        status: { not: 'completed' },
        OR: [{ planId: null }, { plan: { status: 'active' } }],
      },
      select: {
        id: true,
        userId: true,
        backlogSince: true,
        user: { select: { timezone: true } },
      },
    });

    // backlogSince is an instant → compare against the exact user-local
    // midnight of (userToday − N days).
    const expired = candidates.filter((t) => {
      if (!t.backlogSince) return false;
      const tz = t.user.timezone || env.DEFAULT_TIMEZONE || 'Asia/Kolkata';
      const cutoffKey = addDaysToKey(todayKey(tz), -BACKLOG_EXPIRY_DAYS);
      return t.backlogSince.getTime() <= zonedDayStartUtc(cutoffKey, tz).getTime();
    });

    const expiredIds = expired.map((t) => t.id);
    if (expiredIds.length === 0) {
      logger.info('💀 Expiry cron finished: 0 tasks expired');
      return { expired: 0 };
    }

    const expiredByUser = new Map<string, number>();
    const result = await prisma.task.updateMany({
      where: {
        id: { in: expiredIds },
        isBacklog: true,
        isExpired: false,
        status: {
          not: 'completed',
        },
      },
      data: {
        status: 'expired',
        isExpired: true,
      },
    });

    for (const task of expired) {
      expiredByUser.set(
        task.userId,
        (expiredByUser.get(task.userId) || 0) + 1
      );
    }
    const expiredCount = result.count;

    for (const [userId, count] of expiredByUser.entries()) {
      await notificationService.create({
        userId,
        type: 'expired',
        title: 'Backlog tasks expired',
        message:
          count === 1
            ? '1 backlog task expired because it was not completed in time.'
            : `${count} backlog tasks expired because they were not completed in time.`,
        metadata: {
          count,
          expiryDays: BACKLOG_EXPIRY_DAYS,
        },
      });
    }

    logger.info(`💀 Expiry cron finished: ${expiredCount} tasks expired`);

    return { expired: expiredCount };
  } catch (error) {
    logger.error('❌ Expiry cron failed:', error);
    throw error;
  }
}
