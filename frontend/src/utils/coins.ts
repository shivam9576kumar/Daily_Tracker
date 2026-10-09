import type { Task } from '../types';

/**
 * Pre-action display estimate only.
 *
 * MUST NEVER be used to describe the result of a completed mutation.
 * Completed mutation toasts must always use the actual `coinsDelta`
 * returned by the backend (TaskMutationResult).
 */
export function coinsFor(
  task: Pick<Task, 'taskType' | 'difficulty'>,
): number {
  if (task.taskType === 'personal') return 0;
  return 10;
}
