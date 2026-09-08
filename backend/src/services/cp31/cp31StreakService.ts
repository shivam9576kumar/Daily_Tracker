import prisma from '../../config/database';
import { todayKey, addDaysToKey, dateKeyInTz } from '../../utils/dateKeys';

export interface Cp31StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  lastSolvedDateKey: string | null;
  solvedToday: boolean;
}

const EMPTY: Cp31StreakResult = {
  currentStreak: 0,
  longestStreak: 0,
  totalSolved: 0,
  lastSolvedDateKey: null,
  solvedToday: false,
};

export async function computeCp31Streak(
  userId: string,
  timezone: string,
): Promise<Cp31StreakResult> {
  const rows = await prisma.task.findMany({
    where: {
      userId,
      taskType: 'cp31',
      status: 'completed',
      isSkipped: false,
    },
    select: { completedAt: true },
  });

  if (rows.length === 0) return EMPTY;

  const solved = new Set(
    rows
      .map((r) => (r.completedAt ? dateKeyInTz(r.completedAt, timezone) : null))
      .filter(Boolean) as string[],
  );

  const today = todayKey(timezone);
  const solvedToday = solved.has(today);

  let currentStreak = 0;
  let cursor = solvedToday ? today : addDaysToKey(today, -1);
  while (solved.has(cursor)) {
    currentStreak++;
    cursor = addDaysToKey(cursor, -1);
  }

  const sorted = [...solved].sort();
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDaysToKey(sorted[i - 1], 1) ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  return {
    currentStreak,
    longestStreak,
    totalSolved: solved.size,
    lastSolvedDateKey: sorted[sorted.length - 1] ?? null,
    solvedToday,
  };
}
