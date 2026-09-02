import { runBacklogCron } from './backlogCron';
import { runExpiryCron } from './expiryCron';
import logger from '../utils/logger';

/**
 * Initialize all cron jobs.
 * Uses setInterval for simplicity — runs midnight checks every 60 seconds
 * and executes at the first check after midnight.
 */
let lastRunDate = '';

export function initCronJobs() {
  logger.info('⏰ Cron jobs initialized');

  // Check every 60 seconds if we've crossed midnight
  setInterval(async () => {
    const today = new Date().toISOString().split('T')[0];

    if (today !== lastRunDate) {
      lastRunDate = today;
      logger.info('🌙 Midnight cron triggered');

      await runBacklogCron();
      await runExpiryCron();
    }
  }, 60_000);

  // Also run immediately on startup to catch any missed midnight
  runBacklogCron();
  runExpiryCron();
}
