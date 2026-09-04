import { useEffect, useMemo, useState } from 'react';
import type { ClassRow } from '../../types';
import { DAY_NAMES, hhmmToMinutes, to12h } from '../../utils/timeFormat';
import { hiddenToday } from '../../utils/hiddenClassesToday';
import './classes.css';

type Status = 'done' | 'live' | 'upcoming' | 'hidden';

function statusOf(row: ClassRow, nowMins: number, hidden: Set<string>): Status {
  if (hidden.has(row.id)) return 'hidden';
  if (nowMins >= hhmmToMinutes(row.endTime)) return 'done';
  if (nowMins >= hhmmToMinutes(row.startTime)) return 'live';
  return 'upcoming';
}

interface Props {
  /** ALL rows for the user. This component filters "today". */
  classes: ClassRow[];
}

export default function TodayClassStrip({ classes }: Props) {
  // Re-render every 30s so LIVE/DONE flip without a page reload
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Local force-refresh key when the user hides/unhides
  const [tick, setTick] = useState(0);

  const dayOfWeek = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const todays = useMemo(
    () =>
      classes
        .filter((c) => c.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [classes, dayOfWeek]
  );

  // Tomorrow's first class (for the one-liner)
  const tomorrowFirst = useMemo(() => {
    const d = (dayOfWeek + 1) % 7;
    return (
      classes
        .filter((c) => c.dayOfWeek === d)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
    );
  }, [classes, dayOfWeek]);

  // Recompute hidden set each render (cheap; the local write triggers `tick`)
  const hidden = useMemo(() => hiddenToday.get(), [tick, dayOfWeek]);

  const active = todays.filter((c) => !hidden.has(c.id));
  const done = active.filter((c) => nowMins >= hhmmToMinutes(c.endTime)).length;
  const live = active.filter((c) => {
    const s = hhmmToMinutes(c.startTime),
      e = hhmmToMinutes(c.endTime);
    return nowMins >= s && nowMins < e;
  }).length;
  const left = active.length - done - live;

  const hide = (id: string) => {
    hiddenToday.hide(id);
    setTick((t) => t + 1);
  };

  const unhide = (id: string) => {
    hiddenToday.unhide(id);
    setTick((t) => t + 1);
  };

  return (
    <section className="cl-card">
      <div className="cl-head">
        <div className="cl-title">🎓 Today · {DAY_NAMES[dayOfWeek]}</div>
        {todays.length > 0 && (
          <div className="cl-sub">
            {live > 0 ? `${live} live · ` : `${done} done · `}
            {left} left
          </div>
        )}
      </div>

      {todays.length === 0 ? (
        <div className="cl-empty">🎉 No classes today. Full day is yours.</div>
      ) : (
        <div className="cl-list">
          {todays.map((c) => {
            const st = statusOf(c, nowMins, hidden);
            return (
              <div key={c.id} className={`cl-row ${st}`}>
                <span className={`cl-dot ${st}`} />
                <span className="cl-subject">{c.subject}</span>
                <span className="cl-time">
                  {to12h(c.startTime)}–{to12h(c.endTime)}
                </span>
                {c.location && <span className="cl-loc">{c.location}</span>}
                {st === 'live' && <span className="cl-badge live">Live</span>}
                {st === 'hidden' && (
                  <span className="cl-badge cancelled">Cancelled</span>
                )}
                {st === 'upcoming' || st === 'live' ? (
                  <button className="cl-mini" onClick={() => hide(c.id)}>
                    Cancel today
                  </button>
                ) : null}
                {st === 'hidden' && (
                  <button className="cl-link" onClick={() => unhide(c.id)}>
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tomorrowFirst && (
        <div className="cl-tomorrow">
          Tomorrow first class · {to12h(tomorrowFirst.startTime)}{' '}
          {tomorrowFirst.subject}
        </div>
      )}
    </section>
  );
}
