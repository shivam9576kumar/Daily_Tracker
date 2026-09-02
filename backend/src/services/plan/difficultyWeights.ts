export const DIFFICULTY_LOAD = {
  easy: 0.5,
  medium: 1.0,
  hard: 1.5,
} as const;

export function getDifficultyLoad(difficulty: string | null | undefined): number {
  if (difficulty === 'easy') return 0.5;
  if (difficulty === 'medium') return 1.0;
  if (difficulty === 'hard') return 1.5;
  return 1.0;
}
