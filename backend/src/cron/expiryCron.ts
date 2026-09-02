import { taskRepository } from '../repositories/taskRepository';
import { BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import logger from '../utils/logger';

/**
 * Expiry Cron — runs at midnight.
 * Marks backlog tasks as expired if they've been in backlog for > 7 days.
 *
 * backlog_since + 7 days → is_expired = true, status = 'expired'
 */
export async function runExpiryCron() {
  try {
    const expiredTasks = await taskRepository.findExpiredBacklogTasks(
      BACKLOG_EXPIRY_DAYS
    );

    if (expiredTasks.length === 0) {
      logger.debug('Expiry cron: no expired backlog tasks found');
      return;
    }

    let expiredCount = 0;
    for (const task of expiredTasks) {
      await taskRepository.updateTask(task.id, {
        isExpired: true,
        status: 'expired',
      });
      expiredCount++;
    }

    logger.info(`Expiry cron: expired ${expiredCount} backlog tasks`);
  } catch (error) {
    logger.error('Expiry cron failed:', error);
  }
}
