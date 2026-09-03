import type { Task } from '../../types';
import WeekCard, { type DayGroup } from './WeekCard';
import { localKey, daysBetween, todayKey } from '../../utils/dateKeys';

export interface WeekGroup {
  weekNumber: number;
  days: DayGroup[];
}

/** Plan problems first, then revisions; then alphabetical. */
const rank = (t: Task) => (t.taskType === 'revision' ? 1 : 0);

export function groupIntoWeeks(items: Task[], originKey: string): WeekGroup[] {
  // 1. bucket by LOCAL calendar day (fixes the off-by-one for revision/manual tasks)
  const byDate = new Map<string, Task[]>();
  for (const t of items) {
    const key = localKey(new Date(t.scheduledDate));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(t);
  }

  // 2. bucket days into weeks counted from origin; anything before origin → week 1
  const weeks = new Map<number, DayGroup[]>();
  for (const key of Array.from(byDate.keys()).sort()) {
    const weekNumber = Math.max(1, Math.floor(daysBetween(originKey, key) / 7) + 1);
    const tasks = byDate.get(key)!.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
    if (!weeks.has(weekNumber)) weeks.set(weekNumber, []);
    weeks.get(weekNumber)!.push({ dateKey: key, tasks });
  }

  return Array.from(weeks.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([weekNumber, days]) => ({ weekNumber, days }));
}

interface Props {
  tasks: Task[];       // plan problems
  revisions: Task[];   // all revisions
  originKey: string;   // 'YYYY-MM-DD' local — week 1 starts here
}

export default function Roadmap({ tasks, revisions, originKey }: Props) {
  const weeks = groupIntoWeeks([...tasks, ...revisions], originKey);
  if (weeks.length === 0) return null;

  // Open the week that contains today (or the next upcoming one); fall back to the last week.
  const today = todayKey();
  const current = weeks.find((w) => w.days.some((d) => d.dateKey >= today)) ?? weeks[weeks.length - 1];

  return (
    <div>
      {weeks.map((w) => (
        <WeekCard
          key={w.weekNumber}
          weekNumber={w.weekNumber}
          days={w.days}
          defaultOpen={w.weekNumber === current.weekNumber}
        />
      ))}
    </div>
  );
}
