/**
 * Coins are earned for SOLVING, based on the problem's own difficulty.
 * The revision rating (easy/medium/hard) NEVER affects coins.
 */
export const COIN_REWARDS = {
  new: { easy: 5, medium: 10, hard: 15 },
  revision: 5,
} as const;

type Difficulty = keyof typeof COIN_REWARDS.new;

export function calculateCoins(taskType: string, difficulty?: string | null): number {
  if (taskType === 'revision') return COIN_REWARDS.revision;
  if (taskType === 'new') {
    const d = (difficulty ?? 'medium') as Difficulty;
    return COIN_REWARDS.new[d] ?? COIN_REWARDS.new.medium;
  }
  return 0;
}
