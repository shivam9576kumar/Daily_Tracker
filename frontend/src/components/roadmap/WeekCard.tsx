import { useState } from 'react';
import type { Task } from '../../types';
import RoadmapTaskRow from './RoadmapTaskRow';
import { formatKey, todayKey } from '../../utils/dateKeys';
import { IconChevron, IconLock } from '../common/icons';
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
  const weekPct = total ? Math.round((done / total) * 100) : 0;
  const hasBacklog = all.some((t) => t.isBacklog && t.status !== 'completed');
  const isCurrent = days.some((d) => d.dateKey === today);

  const first = days[0]?.dateKey;
  const last = days[days.length - 1]?.dateKey;
  const short = { day: 'numeric', month: 'short' } as const;
  const rangeLabel = first && last ? `${formatKey(first, short)} – ${formatKey(last, short)}` : '';

  return (
    <section className="card week">
      <div
        className="week__head"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
      >
        <span
          className={`week__dot${isCurrent ? ' is-current' : ''}${done === total && total > 0 ? ' is-complete' : ''}${hasBacklog ? ' has-backlog' : ''}`}
          aria-hidden="true"
        />
        <div className="week__text">
          <h2 className="t-h2">Week {weekNumber}</h2>
          <div className={`t-meta week__meta${done === total && total > 0 ? ' is-complete' : ''}`}>
            {rangeLabel} · {done}/{total} done
          </div>
        </div>
        <div className="progress week__bar" aria-hidden="true">
          <div
            className={`progress__fill${done === total && total > 0 ? ' is-success' : ''}`}
            style={{ width: `${weekPct}%` }}
          />
        </div>
        <button
          type="button"
          className="week__toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse week' : 'Expand week'}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <IconChevron />
        </button>
      </div>

      {open && (
        <div className="week__body">
          {days.map((day) => {
            const isToday = day.dateKey === today;
            const isFuture = day.dateKey > today;
            const isPast = day.dateKey < today;
            const dayTotal = day.tasks.length;
            const dayDone = day.tasks.filter((t) => t.status === 'completed').length;
            const allDone = dayDone === dayTotal && dayTotal > 0;
            const backlogCount = day.tasks.filter((t) => t.isBacklog && t.status !== 'completed').length;
            const expiredCount = day.tasks.filter((t) => t.status === 'expired').length;

            const dayState = isToday
              ? 'today'
              : isFuture
              ? 'locked'
              : allDone
              ? 'done'
              : backlogCount > 0
              ? 'backlog'
              : expiredCount > 0
              ? 'expired'
              : 'past';

            return (
              <div key={day.dateKey} className={`day is-${dayState}`}>
                <div className="day__head">
                  <span className="day__dot" aria-hidden="true" />
                  <h3 className="t-h3 day__label">{formatKey(day.dateKey)}</h3>
                  {dayState === 'today'  && <span className="pill pill-count is-brand">Today</span>}
                  {dayState === 'locked' && <span className="pill pill-locked"><IconLock /> Locked</span>}
                  {backlogCount > 0      && <span className="pill pill-outline-warning">{backlogCount} backlog</span>}
                  {expiredCount > 0      && <span className="pill pill-outline-danger">{expiredCount} expired</span>}
                  <span className={`t-meta day__count${allDone ? ' is-complete' : ''}`}>
                    {dayDone}/{dayTotal} done
                  </span>
                </div>
                {day.tasks.map((t) => (
                  <RoadmapTaskRow key={t.id} task={t} isToday={isToday} isFuture={isFuture} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
