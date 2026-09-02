import type { Task } from '../../types';
import WeekCard from './WeekCard';

interface Props {
  tasks: Task[];
  startDate: Date;
}

function groupIntoWeeks(tasks: Task[], planStart: Date) {
  // Group tasks by date string first
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = new Date(t.scheduledDate).toISOString().split('T')[0];
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(t);
  }

  // Sort dates
  const sortedDates = Array.from(byDate.keys()).sort();

  // Chunk into weeks (7 days from plan start)
  const weeks: { weekNumber: number; days: { dateStr: string; date: Date; tasks: Task[] }[] }[] = [];

  let currentWeek: (typeof weeks)[0] | null = null;
  let weekNumber = 1;

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr);
    const diffDays = Math.floor((date.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    const expectedWeek = Math.floor(diffDays / 7) + 1;

    if (!currentWeek || expectedWeek !== weekNumber) {
      if (currentWeek) weeks.push(currentWeek);
      weekNumber = expectedWeek;
      currentWeek = { weekNumber, days: [] };
    }

    currentWeek.days.push({ dateStr, date, tasks: byDate.get(dateStr)! });
  }

  if (currentWeek) weeks.push(currentWeek);

  // If no week grouping worked (gaps), fallback to 7-day chunks
  if (weeks.length === 0 && sortedDates.length > 0) {
    const days = sortedDates.map((ds) => ({
      dateStr: ds,
      date: new Date(ds),
      tasks: byDate.get(ds)!,
    }));
    weeks.push({ weekNumber: 1, days });
  }

  return weeks;
}

export default function Roadmap({ tasks, startDate }: Props) {
  const weeks = groupIntoWeeks(tasks, startDate);

  return (
    <div>
      {weeks.map((w) => (
        <WeekCard key={w.weekNumber} weekNumber={w.weekNumber} days={w.days} defaultOpen={w.weekNumber === 1} />
      ))}
    </div>
  );
}
