import prisma from '../../config/database';
import {
  dateKeyInTz,
  todayKey,
  keyToParts,
  daysInMonth,
  weekdayOfKey,
  pad2,
  monthLabel,
  lowerBoundForKey,
} from '../../utils/dateKeys';
import { ACTIVITY_WHERE } from './activityWhere';
import type { HeatmapData, HeatmapDay, HeatmapMonth } from './progressTypes';

export const heatmapService = {
  async getHeatmap(userId: string, tz: string, monthsBack = 12): Promise<HeatmapData> {
    const months = Math.min(12, Math.max(1, Math.floor(monthsBack)));
    const today = todayKey(tz);
    const { year: ty, month: tm } = keyToParts(today);

    // First month of the range
    let sy = ty;
    let sm = tm - (months - 1);
    while (sm <= 0) {
      sm += 12;
      sy -= 1;
    }
    const fromKey = `${sy}-${pad2(sm)}-01`;

    const rows = await prisma.task.findMany({
      where: { userId, ...ACTIVITY_WHERE, completedAt: { gte: lowerBoundForKey(fromKey) } },
      select: { completedAt: true },
    });

    // Bucket by user-timezone day
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.completedAt) continue;
      const k = dateKeyInTz(r.completedAt, tz);
      if (k < fromKey || k > today) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    // Build month blocks
    const out: HeatmapMonth[] = [];
    let y = sy;
    let m = sm;
    for (let i = 0; i < months; i++) {
      const dim = daysInMonth(y, m);
      const firstWeekday = weekdayOfKey(`${y}-${pad2(m)}-01`);
      const days: HeatmapDay[] = [];
      let activeDays = 0;
      let totalCount = 0;

      for (let d = 1; d <= dim; d++) {
        const key = `${y}-${pad2(m)}-${pad2(d)}`;
        if (key > today) break; // never render the future
        const count = counts.get(key) ?? 0;
        if (count > 0) {
          activeDays++;
          totalCount += count;
        }
        days.push({ date: key, count });
      }

      const isPastMonth = y < ty || (y === ty && m < tm);
      out.push({
        key: `${y}-${pad2(m)}`,
        year: y,
        month: m,
        label: monthLabel(m),
        daysInMonth: dim,
        firstWeekday,
        weeks: Math.ceil((firstWeekday + dim) / 7),
        activeDays,
        totalCount,
        badge: isPastMonth && activeDays === dim ? 'full-month' : null,
        days,
      });

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    let totalCount = 0;
    let bestDay: HeatmapDay | null = null;
    for (const [date, count] of counts) {
      totalCount += count;
      if (!bestDay || count > bestDay.count) bestDay = { date, count };
    }

    return {
      tz,
      from: fromKey,
      to: today,
      weekStart: 0,
      months: out,
      summary: { totalCount, activeDays: counts.size, bestDay },
    };
  },
};
