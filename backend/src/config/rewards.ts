/**
 * Single source of truth for task coin rewards.
 *
 * Coin policy:
 * - First solve of any task: +10 coins
 * - Medium rating bonus: +5 coins
 * - Hard rating bonus: +10 coins
 * - Easy rating bonus: +0 coins
 * - Every completed revision: +10 coins
 *
 * The task difficulty does not change the base solve reward.
 */

export const COIN_REWARDS = {
  solve: 10,
  revision: 10,
  ratingBonus: {
    easy: 0,
    medium: 5,
    hard: 10,
  },
} as const;

export type RatingReward = keyof typeof COIN_REWARDS.ratingBonus;

export function calculateSolveCoins(taskType: string): number {
  return taskType === 'revision'
    ? COIN_REWARDS.revision
    : COIN_REWARDS.solve;
}

export function calculateRatingBonus(rating?: string | null): number {
  if (
    rating === 'easy' ||
    rating === 'medium' ||
    rating === 'hard'
  ) {
    return COIN_REWARDS.ratingBonus[rating];
  }

  return 0;
}

/**
 * Total coins associated with a completed task.
 *
 * For a parent/new/POTD task:
 *   base solve reward + rating bonus
 *
 * For a revision:
 *   revision solve reward
 *
 * This function is used for refunds when deleting completed tasks.
 */
export function calculateCompletedTaskCoins(
  taskType: string,
  rating?: string | null,
): number {
  if (taskType === 'personal') return 0;
  if (taskType === 'revision') {
    return COIN_REWARDS.revision;
  }

  return COIN_REWARDS.solve + calculateRatingBonus(rating);
}

/**
 * Backward-compatible helper.
 */
export function calculateCoins(
  taskType: string,
  _difficulty?: string | null,
): number {
  return calculateSolveCoins(taskType);
}

import logger from '../utils/logger';

/**
 * Applies a coin refund with a zero floor.
 *
 * A refund that would drive the balance below zero indicates an
 * accounting defect upstream (double refund, incorrect completed-child
 * count, or an unclosed concurrency race). This is intentionally never
 * silent: it is logged as an error for monitoring/alerting even though
 * the balance is still clamped to zero to avoid a broken UI state.
 */
export function applyCoinRefund(
  currentCoins: number,
  refund: number,
  context: { userId: string; taskId: string; reason: string },
): number {
  const next = currentCoins - refund;

  if (next < 0) {
    logger.error('Coin invariant violation: refund exceeds balance', {
      userId: context.userId,
      taskId: context.taskId,
      reason: context.reason,
      currentCoins,
      refund,
      wouldBe: next,
    });
  }

  return Math.max(0, next);
}
