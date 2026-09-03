import { useState } from 'react';
import type { Task } from '../../types';
import RoadmapTaskRow from './RoadmapTaskRow';
import { formatKey, todayKey } from '../../utils/dateKeys';
import './roadmap.css';

export interface DayGroup {
  dateKey: string;   // 'YYYY-MM-DD' local
  tasks: Task[];
}

interface Props {
  weekNumber: number;
  days: DayGroup[];
  defaultOpen?: boolean;
}

export default function WeekCard({ weekNumber, days, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const today = todayKey();

  const all = days.flatMap((d) => d.tasks);
  const total = all.length;
  const done = all.filter((t) => t.status === 'completed').length;
  const revCount = all.filter((t) => t.taskType === 'revision').length;
  const onlyRevisions = revCount > 0 && revCount === total;

  const first = days[0]?.dateKey;
  const last = days[days.length - 1]?.dateKey;
  const short = { day: 'numeric', month: 'short' } as const;

  return (
    <div className="week-card">
      <div className="week-header" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="week-title">
            Week {weekNumber}
            {onlyRevisions && <span className="week-rev-hint">revisions only</span>}
          </div>
          <div className="week-meta">
            {first && formatKey(first, short)} – {last && formatKey(last, short)} · {done}/{total} done
            {revCount > 0 && ` · ${revCount} rev`}
          </div>
        </div>
        <span style={{ color: '#9ca3af' }}>{open ? '−' : '+'}</span>
      </div>

      {open && days.map((day) => {
        const isToday = day.dateKey === today;
        const isFuture = day.dateKey > today;      // string compare is safe for YYYY-MM-DD
        const isPast = day.dateKey < today;
        const pendingPast = isPast && day.tasks.some((t) => t.status !== 'completed');

        return (
          <div key={day.dateKey} className={`day-group ${isToday ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`}>
            <div className="day-header">
              <span className="day-date">{formatKey(day.dateKey)}</span>
              {isToday && <span className="day-badge badge-today">Today</span>}
              {isFuture && <span className="day-badge badge-future">Locked</span>}
              {pendingPast && <span className="day-badge badge-past">Pending</span>}
            </div>
            {day.tasks.map((t) => (
              <RoadmapTaskRow key={t.id} task={t} isToday={isToday} isFuture={isFuture} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
