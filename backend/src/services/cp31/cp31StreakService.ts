import prisma from '../../config/database';
import { dateKeyInTz, todayKey } from '../../utils/dateKeys';
import { computeStreaks } from '../progress/streakService';

export interface Cp31StreakResult {
  enabled: boolean;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
  solvedToday: boolean;
  activeDays: number;
}

/** Derive-on-read (never mutated by toggling). ≥1 CP31 solve on a local day = streak day. */
export async function computeCp31Streak(userId: string, tz: string): Promise<Cp31StreakResult> {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { cp31Enabled: true } }),
    prisma.task.findMany({
      where: { userId, taskType: 'cp31', status: 'completed', completedAt: { not: null } },
      select: { completedAt: true },
    }),
  ]);

  const keys = new Set<string>();
  for (const r of rows) if (r.completedAt) keys.add(dateKeyInTz(r.completedAt, tz));

  const s = computeStreaks(keys, todayKey(tz));
  return {
    enabled: user?.cp31Enabled ?? false,
    currentStreak: s.current,
    longestStreak: s.best,
    totalSolved: rows.length,
    solvedToday: s.activeToday,
    activeDays: s.activeDays,
  };
}
