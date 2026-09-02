import { taskRepository } from '../repositories/taskRepository';
import logger from '../utils/logger';

/**
 * Backlog Cron — runs at midnight.
 * Moves overdue pending tasks to backlog status.
 *
 * Pending + scheduled_date < today → is_backlog = true
 */
export async function runBacklogCron() {
  try {
    const overdueTasks = await taskRepository.findOverduePendingTasks();

    if (overdueTasks.length === 0) {
      logger.debug('Backlog cron: no overdue tasks found');
      return;
    }

    let movedCount = 0;
    for (const task of overdueTasks) {
      await taskRepository.updateTask(task.id, {
        isBacklog: true,
        backlogSince: new Date(),
      });
      movedCount++;
    }

    logger.info(`Backlog cron: moved ${movedCount} tasks to backlog`);
  } catch (error) {
    logger.error('Backlog cron failed:', error);
  }
}
