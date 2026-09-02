/**
 * Coin rewards for completing tasks.
 * Harder problems = more coins. Revisions give a smaller flat reward.
 */
export const COIN_REWARDS = {
  new: {
    easy: 5,
    medium: 10,
    hard: 15,
  },
  revision: 5,
} as const;

/**
 * Calculate coins earned for completing a task.
 */
export function calculateCoins(
  taskType: string,
  rating?: string | null
): number {
  if (taskType === 'revision') return COIN_REWARDS.revision;
  if (taskType === 'new') {
    const key = (rating || 'medium') as 'easy' | 'medium' | 'hard';
    return COIN_REWARDS.new[key] ?? COIN_REWARDS.new.medium;
  }
  return 0;
}
