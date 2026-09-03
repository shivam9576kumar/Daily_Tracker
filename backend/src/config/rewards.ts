/**
 * Coins are earned for SOLVING, based on the problem's own difficulty.
 * The revision rating (easy/medium/hard) NEVER affects coins — it only shapes the revision schedule.
 * Completing a revision task earns a flat amount.
 */
export const COIN_REWARDS = {
  problem: { easy: 5, medium: 10, hard: 15 },
  revision: 5,
} as const;

type DifficultyKey = keyof typeof COIN_REWARDS.problem;

export function calculateCoins(taskType: string, difficulty?: string | null): number {
  if (taskType === 'revision') return COIN_REWARDS.revision;
  if (taskType === 'new') {
    const key = (difficulty || 'medium') as DifficultyKey;
    return COIN_REWARDS.problem[key] ?? COIN_REWARDS.problem.medium;
  }
  return 0;
}
