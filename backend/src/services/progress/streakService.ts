import prisma from '../../config/database';
import { addDaysToKey, dateKeyInTz, todayKey } from '../../utils/dateKeys';
import { ACTIVITY_WHERE } from './activityWhere';
import type { StreakResult } from './progressTypes';

/**
 * Pure function — easy to unit test.
 * current: consecutive active days ending today, OR ending yesterday if today is not active yet
 *          (grace period: streak is "alive but at risk" until the day ends).
 * best:    longest run of consecutive active days ever.
 */
export function computeStreaks(activeKeys: Iterable<string>, today: string): StreakResult {
  const set = new Set(activeKeys);
  const keys = Array.from(set).sort();

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev !== null && addDaysToKey(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }

  const activeToday = set.has(today);
  let cursor = activeToday ? today : addDaysToKey(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDaysToKey(cursor, -1);
  }

  return { current, best, activeToday, activeDays: keys.length };
}

export const streakService = {
  async getActiveDayKeys(userId: string, tz: string): Promise<Set<string>> {
    const rows = await prisma.task.findMany({
      where: { userId, ...ACTIVITY_WHERE },
      select: { completedAt: true },
    });
    const set = new Set<string>();
    for (const r of rows) {
      if (r.completedAt) set.add(dateKeyInTz(r.completedAt, tz));
    }
    return set;
  },

  async getStreaks(userId: string, tz: string): Promise<StreakResult> {
    const keys = await this.getActiveDayKeys(userId, tz);
    return computeStreaks(keys, todayKey(tz));
  },
};
