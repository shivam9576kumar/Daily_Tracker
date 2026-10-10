export type Difficulty = 'easy' | 'medium' | 'hard';

export const Difficulty = {
  EASY: 'easy' as const,
  MEDIUM: 'medium' as const,
  HARD: 'hard' as const,
};
