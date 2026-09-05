import prisma from '../../config/database';
import { todayKey, addDaysToKey } from '../../utils/dateKeys';

export interface PotdStreakResult {
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  lastSolvedDateKey: string | null;
  solvedToday: boolean;
}

const EMPTY: PotdStreakResult = {
  currentStreak: 0,
  longestStreak: 0,
  totalSolved: 0,
  lastSolvedDateKey: null,
  solvedToday: false,
};

/**
 * OPTION A — derive-on-read, retroactive.
 * The streak is recomputed from the user's completed POTD Task rows on every call.
 * Solving an old backlog POTD fills that date and can retroactively extend the
 * current streak. No stored counters anywhere — cannot drift.
 */
export async function computePotdStreak(
  userId: string,
  timezone: string,
): Promise<PotdStreakResult> {
  const rows = await prisma.task.findMany({
    where: {
      userId,
      taskType: 'potd',
      status: 'completed',
      potdDateKey: { not: null },
    },
    select: { potdDateKey: true },
  });

  const solved = new Set(
    rows.map((r) => r.potdDateKey).filter((k): k is string => Boolean(k)),
  );

  if (solved.size === 0) return EMPTY;

  const today = todayKey(timezone);
  const solvedToday = solved.has(today);

  // currentStreak: walk backward from today (or yesterday if today not yet solved).
  // An unsolved "today" does not break the streak — the day isn't over.
  let currentStreak = 0;
  let cursor = solvedToday ? today : addDaysToKey(today, -1);
  while (solved.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToKey(cursor, -1);
  }

  // longestStreak: longest consecutive run across all solved dates.
  const sorted = [...solved].sort(); // 'YYYY-MM-DD' sorts lexicographically = chronologically
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
