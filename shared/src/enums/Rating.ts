export type Rating = 'easy' | 'medium' | 'hard';

export const Rating = {
  EASY: 'easy' as const,
  MEDIUM: 'medium' as const,
  HARD: 'hard' as const,
};
