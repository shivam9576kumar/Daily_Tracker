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

  return (
    <section className="pcard">
      <div className="hm-header">
        <div className="hm-headline">
          <strong>{data.summary.totalCount}</strong> solved in {rangeLabel}
        </div>
        <div className="hm-meta">
          <span>
            Active days: <strong>{data.summary.activeDays}</strong>
          </span>
          <span>
            Max streak: <strong>{bestStreak}</strong>
          </span>
        </div>
      </div>

      <div className="hm-scroll" ref={scrollRef} onScroll={() => setTip(null)}>
        <div className="hm-months">
          {data.months.map((m) => (
            <div key={m.key} className="hm-month">
              <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${m.weeks}, 11px)` }}>
                {m.days.map((day, i) => {
                  const idx = m.firstWeekday + i; // i === dayOfMonth - 1
                  const col = Math.floor(idx / 7) + 1;
                  const row = (idx % 7) + 1; // row 1 = Sunday
                  const lvl = levelFor(day.count);
                  return (
                    <div
                      key={day.date}
                      className={`hm-cell${lvl ? ` hm-l${lvl}` : ''}`}
                      style={{ gridColumn: col, gridRow: row }}
                      onMouseEnter={(e) => showTip(e, day)}
                      onMouseLeave={() => setTip(null)}
                      aria-label={`${day.count} solved on ${day.date}`}
                    />
                  );
                })}
              </div>

              {m.badge === 'full-month' ? (
                <div className="hm-badge" title={`${m.label} ${m.year}: active every single day`}>
                  {m.month}
                </div>
              ) : (
                <div className="hm-month-label">{m.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hm-footer">
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
