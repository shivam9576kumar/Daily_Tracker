import prisma from '../config/database';
import { taskRepository } from '../repositories/taskRepository';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';

/**
 * Backlog Cron
 *
 * Rule:
 * pending task scheduled before today
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
    const overdueTasks = await taskRepository.findOverduePendingTasks();

    if (overdueTasks.length === 0) {
      logger.info('📦 Backlog cron finished: 0 tasks moved');
      return { moved: 0 };
    }

    const movedByUser = new Map<string, number>();
    let movedCount = 0;

    for (const task of overdueTasks) {
      const result = await prisma.task.updateMany({
        where: {
          id: task.id,
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

      if (result.count > 0) {
        movedCount++;
        movedByUser.set(task.userId, (movedByUser.get(task.userId) || 0) + 1);
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

    logger.info(`📦 Backlog cron finished: ${movedCount} tasks moved`);

    return { moved: movedCount };
  } catch (error) {
    logger.error('❌ Backlog cron failed:', error);
    throw error;
  }
}
