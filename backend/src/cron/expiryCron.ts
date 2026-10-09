import prisma from '../config/database';
import { env } from '../config/env';
import { todayKey, addDaysToKey, dateKeyInTz, resolveTimeZone } from '../utils/dateKeys';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';
import {
  LIVE_TASK_WHERE,
  OPEN_BACKLOG_WHERE,
} from '../services/task/taskLifecycle';

/**
 * Expiry Cron
 *
 * Rule:
 * canonical open-backlog task older than BACKLOG_EXPIRY_DAYS calendar days in user timezone
 * → status = expired
 * → isBacklog = false
 * → isExpired = true
 *
 * Synchronizes Revision table records.
 * Idempotent and protected against race conditions via guarded updates.
 */
export async function runExpiryCron() {
  logger.info('💀 Expiry cron started');

  try {
    const candidates = await prisma.task.findMany({
      where: {
        AND: [
          LIVE_TASK_WHERE,
          OPEN_BACKLOG_WHERE,
        ],
      },
      select: {
        id: true,
        userId: true,
        taskType: true,
        backlogSince: true,
        user: { select: { timezone: true } },
      },
    });

    const now = new Date();
    const expiredByUser = new Map<string, number>();
    let totalExpired = 0;

    for (const task of candidates) {
      if (!task.backlogSince) {
        logger.warn('Expiry cron: backlog task missing backlogSince', { taskId: task.id, userId: task.userId });
        continue;
      }

      const tz = resolveTimeZone(task.user.timezone || env.DEFAULT_TIMEZONE);
      const backlogDay = dateKeyInTz(task.backlogSince, tz);
      const expiresOn = addDaysToKey(backlogDay, BACKLOG_EXPIRY_DAYS);
      const today = todayKey(tz, now);

      if (expiresOn <= today) {
        const count = await prisma.$transaction(async (tx) => {
          const changed = await tx.task.updateMany({
            where: {
              AND: [
                { id: task.id, userId: task.userId },
                LIVE_TASK_WHERE,
                OPEN_BACKLOG_WHERE,
              ],
            },
            data: {
              status: 'expired',
              isBacklog: false,
              isExpired: true,
            },
          });

          if (changed.count > 0 && task.taskType === 'revision') {
            await tx.revision.updateMany({
              where: { revisionTaskId: task.id, status: { not: 'completed' } },
              data: { status: 'expired', completedAt: null },
            });
          }

          return changed.count;
        });

        if (count > 0) {
          totalExpired += count;
          expiredByUser.set(task.userId, (expiredByUser.get(task.userId) || 0) + count);
        }
      }
    }

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

    logger.info(`💀 Expiry cron finished: ${totalExpired} tasks expired`);

    return { expired: totalExpired };
  } catch (error) {
    logger.error('❌ Expiry cron failed:', error);
    throw error;
  }
}
