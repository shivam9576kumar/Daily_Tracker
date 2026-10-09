import prisma from '../config/database';
import { env } from '../config/env';
import { todayKey, resolveTimeZone, isValidDateKey } from '../utils/dateKeys';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';
import {
  LIVE_TASK_WHERE,
  DATED_BACKLOG_TYPE_WHERE,
} from '../services/task/taskLifecycle';

/**
 * Backlog Cron
 *
 * Rule:
 * pending lifecycle-eligible task with scheduledDateKey < todayKey(userTz)
 * → status = backlog
 * → isBacklog = true
 * → backlogSince = now
 *
 * Excludes CP31, POTD, Inbox, undated, completed and archived tasks.
 * Race protection: guarded updateMany rechecks state before updating.
 */
export async function runBacklogCron() {
  logger.info('📦 Backlog cron started');

  try {
    const candidates = await prisma.task.findMany({
      where: {
        AND: [
          LIVE_TASK_WHERE,
          DATED_BACKLOG_TYPE_WHERE,
          {
            status: 'pending',
            isBacklog: false,
            isExpired: false,
            completedAt: null,
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        scheduledDateKey: true,
        user: { select: { timezone: true } },
      },
    });

    const now = new Date();
    const movedByUser = new Map<string, number>();
    let totalMoved = 0;

    for (const task of candidates) {
      if (!task.scheduledDateKey || !isValidDateKey(task.scheduledDateKey)) continue;
      const tz = resolveTimeZone(task.user.timezone || env.DEFAULT_TIMEZONE);
      const today = todayKey(tz, now);

      if (task.scheduledDateKey < today) {
        const changed = await prisma.task.updateMany({
          where: {
            AND: [
              { id: task.id, userId: task.userId },
              LIVE_TASK_WHERE,
              DATED_BACKLOG_TYPE_WHERE,
              {
                status: 'pending',
                isBacklog: false,
                isExpired: false,
                completedAt: null,
                scheduledDateKey: { lt: today },
              },
            ],
          },
          data: {
            status: 'backlog',
            isBacklog: true,
            backlogSince: now,
            isExpired: false,
          },
        });

        if (changed.count > 0) {
          totalMoved += changed.count;
          movedByUser.set(task.userId, (movedByUser.get(task.userId) || 0) + changed.count);
        }
      }
    }

    for (const [userId, count] of movedByUser.entries()) {
      await notificationService.create({
        userId,
        type: 'backlog',
        title: 'Tasks moved to backlog',
        message:
          count === 1
            ? '1 overdue task was moved to your backlog.'
            : `${count} overdue tasks were moved to your backlog.`,
        metadata: {
          count,
        },
      });
    }

    logger.info(`📦 Backlog cron finished: ${totalMoved} tasks moved`);

    return { moved: totalMoved };
  } catch (error) {
    logger.error('❌ Backlog cron failed:', error);
    throw error;
  }
}
