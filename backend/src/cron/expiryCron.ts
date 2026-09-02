import prisma from '../config/database';
import { taskRepository } from '../repositories/taskRepository';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import { notificationService } from '../services/notification/notificationService';
import logger from '../utils/logger';

/**
 * Expiry Cron
 *
 * Rule:
 * backlog task older than BACKLOG_EXPIRY_DAYS
 * → status = expired
 * → isExpired = true
 *
 * This cron is idempotent:
 * running it multiple times will not expire the same task twice.
 */
export async function runExpiryCron() {
  logger.info('💀 Expiry cron started');

  try {
    const expiredTasks = await taskRepository.findExpiredBacklogTasks(
      BACKLOG_EXPIRY_DAYS
    );

    if (expiredTasks.length === 0) {
      logger.info('💀 Expiry cron finished: 0 tasks expired');
      return { expired: 0 };
    }

    const expiredByUser = new Map<string, number>();
    let expiredCount = 0;

    for (const task of expiredTasks) {
      const result = await prisma.task.updateMany({
        where: {
          id: task.id,
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

      if (result.count > 0) {
        expiredCount++;
        expiredByUser.set(
          task.userId,
          (expiredByUser.get(task.userId) || 0) + 1
        );
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

    logger.info(`💀 Expiry cron finished: ${expiredCount} tasks expired`);

    return { expired: expiredCount };
  } catch (error) {
    logger.error('❌ Expiry cron failed:', error);
    throw error;
  }
}
