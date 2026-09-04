import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { HeatmapData, HeatmapDay } from '../../types';
import { formatDateKey } from '../../utils/time';
import ProgressLegend from './ProgressLegend';
import './progress.css';

export function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

interface Tip {
  x: number;
  y: number;
  text: string;
}

interface Props {
  data: HeatmapData;
  bestStreak: number;
}

export default function Heatmap({ data, bestStreak }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  // Always land on the most recent month (right edge), like LeetCode
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data]);

  const showTip = (e: MouseEvent<HTMLDivElement>, day: HeatmapDay) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({
      x: r.left + r.width / 2,
      y: r.top,
      text: `${day.count} ${day.count === 1 ? 'problem' : 'problems'} solved on ${formatDateKey(day.date)}`,
    });
  };

  const rangeLabel = data.months.length === 12 ? 'the past year' : `the past ${data.months.length} months`;

  // Compute padded flat days array and column index for each month
  const padCount = data.months[0]?.firstWeekday ?? 0;
  let runningDays = padCount;
  const monthLabels: Array<{ label: string; weekIndex: number }> = [];

  for (const m of data.months) {
    const weekIndex = Math.floor(runningDays / 7);
    monthLabels.push({ label: m.label, weekIndex });
    runningDays += m.days.length;
  }

  const days: Array<HeatmapDay & { level: number; isPad?: boolean }> = [];
  for (let i = 0; i < padCount; i++) {
    days.push({
      date: `pad-${i}`,
      count: 0,
      level: 0,
      isPad: true,
    });
  }

  for (const m of data.months) {
    for (const d of m.days) {
      days.push({
        ...d,
        level: levelFor(d.count),
      });
    }
  }

  const totalWeeks = Math.max(53, Math.ceil(days.length / 7));

  return (
    <section className="progress-card heatmap-card">
      <div className="progress-card__header">
        <h2 className="progress-card__heading">
          <strong>{data.summary.totalCount}</strong> solved in {rangeLabel}
        </h2>
        <div className="progress-card__meta">
          <span>
            Active days: <strong>{data.summary.activeDays}</strong>
          </span>
          {' · '}
          <span>
            Max streak: <strong>{bestStreak}</strong>
          </span>
        </div>
      </div>

      <div className="heatmap-card__grid-wrap" ref={scrollRef} onScroll={() => setTip(null)}>
        <div className="heatmap-scroll">
          <div
            className="heatmap-months"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
          >
            {monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.weekIndex}`}
                className="heatmap-months__label"
                style={{ gridColumnStart: m.weekIndex + 1 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div
            className="heatmap-grid"
            style={{ gridTemplateColumns: `repeat(${totalWeeks}, 1fr)` }}
          >
            {days.map((day) => (
              <div
                key={day.date}
                className={`heatmap-cell hm-${day.level}`}
                style={day.isPad ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
                onMouseEnter={day.isPad ? undefined : (e) => showTip(e, day)}
                onMouseLeave={day.isPad ? undefined : () => setTip(null)}
                aria-label={day.isPad ? undefined : `${day.count} solved on ${day.date}`}
                title={day.isPad ? undefined : `${day.count} on ${day.date}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="heatmap-footer">
        <span>New problems and revisions both count · {data.tz}</span>
        <ProgressLegend />
      </div>

      {tip && (
        <div className="hm-tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
    </section>
  );
}
