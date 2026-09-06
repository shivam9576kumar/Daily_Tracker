import prisma from '../config/database';
import { env } from '../config/env';
import { todayKey } from '../utils/dateKeys';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';

/**
 * Backlog Cron
 *
 * Rule:
 * pending task with scheduledDateKey < todayKey(userTz)
 * → status = backlog
 * → isBacklog = true
 * → backlogSince = now
 *
 * This cron is idempotent:
 * running it multiple times will not move the same task twice.
 */
export async function runBacklogCron() {
  logger.info('📦 Backlog cron started');

  try {
    const candidates = await prisma.task.findMany({
      where: {
        status: 'pending',
        isBacklog: false,
        isExpired: false,
        completedAt: null,
        OR: [{ planId: null }, { plan: { status: 'active' } }],
      },
      select: {
        id: true,
        userId: true,
        scheduledDateKey: true,
        user: { select: { timezone: true } },
      },
    });

    // BUG 8: per-user tz. 'YYYY-MM-DD' compares lexicographically = chronologically.
    const overdue = candidates.filter((t) => {
      const tz = t.user.timezone || env.DEFAULT_TIMEZONE || 'Asia/Kolkata';
      return t.scheduledDateKey < todayKey(tz);
    });

    const overdueIds = overdue.map((t) => t.id);
    if (overdueIds.length === 0) {
      logger.info('📦 Backlog cron finished: 0 tasks moved');
      return { moved: 0 };
    }

    const movedByUser = new Map<string, number>();
    const result = await prisma.task.updateMany({
      where: {
        id: { in: overdueIds },
        status: 'pending',
        isBacklog: false,
        isExpired: false,
        completedAt: null,
      },
      data: {
        status: 'backlog',
        isBacklog: true,
        backlogSince: new Date(),
      },
    });

    for (const task of overdue) {
      movedByUser.set(task.userId, (movedByUser.get(task.userId) || 0) + 1);
    }
    const movedCount = result.count;

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

    logger.info(`📦 Backlog cron finished: ${movedCount} tasks moved`);

    return { moved: movedCount };
  } catch (error) {
    logger.error('❌ Backlog cron failed:', error);
    throw error;
  }
}
