import type { Task } from '../types';

/** Mirrors backend/src/config/rewards.ts — used only for toast text. */
export function coinsFor(task: Pick<Task, 'taskType' | 'difficulty'>): number {
  if (task.taskType === 'revision') return 5;
  if (task.taskType !== 'new') return 0;
  if (task.difficulty === 'easy') return 5;
  if (task.difficulty === 'hard') return 15;
  return 10;
}
