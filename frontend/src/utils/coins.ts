import type { Task } from '../types';

/**
 * Mirrors backend/src/config/rewards.ts.
 *
 * Used only for optimistic toast text.
 * The backend remains the authoritative source of the actual balance.
 */
export function coinsFor(
  task: Pick<Task, 'taskType' | 'difficulty'>,
): number {
  if (task.taskType === 'personal') return 0;
  return 10;
}
