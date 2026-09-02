import { useState } from 'react';
import type { Task } from '../../types';
import RoadmapTaskRow from './RoadmapTaskRow';
import './roadmap.css';

interface DayGroup {
  dateStr: string; // YYYY-MM-DD
  date: Date;
  tasks: Task[];
}

interface Props {
  weekNumber: number;
  days: DayGroup[];
  defaultOpen?: boolean;
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().split('T')[0] === b.toISOString().split('T')[0];
}

export default function WeekCard({ weekNumber, days, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? weekNumber === 1);
  const today = new Date();

  const total = days.reduce((acc, d) => acc + d.tasks.length, 0);
  const done = days.reduce((acc, d) => acc + d.tasks.filter(t => t.status === 'completed').length, 0);

  return (
    <div className="week-card">
      <div className="week-header" onClick={() => setOpen(!open)}>
        <div>
          <div className="week-title">Week {weekNumber}</div>
          <div className="week-meta">
            {days[0]?.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {days[days.length-1]?.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {done}/{total} done
          </div>
        </div>
        <span style={{ color: '#9ca3af' }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div>
          {days.map((day) => {
            const isToday = isSameDay(day.date, today);
            const isFuture = day.date > today && !isToday;
            const isPast = day.date < today && !isToday;

            return (
              <div key={day.dateStr} className={`day-group ${isToday ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}`}>
                <div className="day-header">
                  <span className="day-date">
                    {day.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  {isToday && <span className="day-badge badge-today">Today</span>}
                  {isFuture && <span className="day-badge badge-future">Locked</span>}
                  {isPast && day.tasks.some(t => t.status !== 'completed') && <span className="day-badge badge-past">Pending</span>}
                </div>

                {day.tasks.map((task) => (
                  <RoadmapTaskRow key={task.id} task={task} isToday={isToday} isFuture={isFuture} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
