import { useState } from 'react';
import type { BusyDayInput } from '../../types';
import './plan.css';

interface Props {
  busyDays: BusyDayInput[];
  weekdayLoad?: number;
  weekendLoad?: number;
  onChange: (busyDays: BusyDayInput[]) => void;
}

const PRESETS = [
  { label: 'Light',    pct: 30 },
  { label: 'Half',     pct: 50 },
  { label: 'Exam Day', pct: 60 },
  { label: 'Heavy',    pct: 80 },
  { label: 'No Study', pct: 100 },
];

export default function StepBusyDays({
  busyDays,
  weekdayLoad = 2.0,
  weekendLoad = 3.0,
  onChange,
}: Props) {
  const [busyDate, setBusyDate] = useState('');
  const [busyReason, setBusyReason] = useState('');
  const [reductionPct, setReductionPct] = useState<number>(60);

  const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

  function remainingLoadPreview(pct: number, wdLoad: number, weLoad: number) {
    const factor = (100 - pct) / 100;
    const wd = +(wdLoad * factor).toFixed(2);
    const we = +(weLoad * factor).toFixed(2);
    return { factor, wd, we };
  }

  const { wd, we } = remainingLoadPreview(reductionPct, weekdayLoad, weekendLoad);

  const addBusyDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busyDate) return;

    const entry: BusyDayInput = {
      date: busyDate,
      reason: busyReason.trim() || undefined,
      loadReduction: reductionPct / 100, // 0..1 contract for backend
    };

    const next = [
      ...busyDays.filter((d) => d.date !== entry.date),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date));

    onChange(next);
    setBusyDate('');
    setBusyReason('');
  };

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  }

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 4 of 5</div>
      <h2 className="step-card__heading">Exams &amp; Busy Days</h2>
      <p className="step-card__hint">
        Add exams or busy days — load is reduced automatically.
      </p>

      <form onSubmit={addBusyDay} className="busy-add-form">
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="form-field">
            <label htmlFor="busy-date">Date</label>
            <input
              id="busy-date"
              type="date"
              className="field"
              value={busyDate}
              onChange={(e) => setBusyDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="busy-reason">Reason (optional)</label>
            <input
              id="busy-reason"
              type="text"
              className="field"
              placeholder="e.g. Midterm exam, travel, quiz..."
              value={busyReason}
              onChange={(e) => setBusyReason(e.target.value)}
            />
          </div>
        </div>

        <div className="busy-load">
          <label htmlFor="busy-load-range">Load reduction</label>

          <div className="busy-load__row">
            <input
              id="busy-load-range"
              type="range"
              className="busy-load__range"
              min={0}
              max={100}
              step={5}
              value={reductionPct}
              onChange={(e) => setReductionPct(clampPct(+e.target.value))}
              aria-describedby="busy-load-hint"
            />

            <div className="busy-load__numwrap">
              <input
                type="number"
                className="field busy-load__num"
                min={0}
                max={100}
                step={1}
                value={reductionPct}
                onChange={(e) => setReductionPct(clampPct(+e.target.value))}
                aria-label="Load reduction percent"
              />
              <span className="busy-load__pct">%</span>
            </div>
          </div>

          <div className="busy-load__presets" role="group" aria-label="Quick load presets">
            {PRESETS.map((p) => (
              <button
                key={p.pct}
                type="button"
                className={`chip ${reductionPct === p.pct ? 'is-on' : ''}`}
                onClick={() => setReductionPct(p.pct)}
              >
                {p.label} · {p.pct}%
              </button>
            ))}
          </div>

          <p id="busy-load-hint" className="busy-load__hint">
            {reductionPct === 0 && (
              <>No reduction — a normal full day ({weekdayLoad} weekday / {weekendLoad} weekend load).</>
            )}
            {reductionPct > 0 && reductionPct < 100 && (
              <>
                Cut <strong>{reductionPct}%</strong> — you'll still do about <strong>{100 - reductionPct}%</strong> of that day:
                ≈ <strong>{wd}</strong> load on a weekday, <strong>{we}</strong> on a weekend.
              </>
            )}
            {reductionPct === 100 && (
              <>Full rest day — <strong>no DSA scheduled</strong>.</>
            )}
          </p>

          <p className="busy-load__legend t-meta">
            Load units: Easy = 0.5 · Medium = 1.0 · Hard = 1.5. So 2.0 load ≈ two Medium problems.
          </p>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn-brand-outline"
            disabled={!busyDate}
          >
            + Add Busy Day
          </button>
        </div>
      </form>

      {busyDays.length === 0 ? (
        <p className="busy-empty t-meta" style={{ marginTop: 16 }}>
          No busy days added yet. Tasks will follow standard daily targets.
        </p>
      ) : (
        <ul className="busy-list">
          {busyDays.map((d) => {
            const pct = Math.round(d.loadReduction * 100);
            return (
              <li key={d.date} className="busy-row">
                <span className="busy-row__date">{formatDate(d.date)}</span>
                <span className="busy-row__reason">{d.reason || '—'}</span>
                <span
                  className={`pill ${
                    pct === 100 ? 'pill-outline-danger' : 'pill-outline-warning'
                  }`}
                >
                  {pct === 100 ? 'No study' : `${pct}% less`}
                </span>
                <input
                  type="range"
                  className="busy-row__range"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) =>
                    onChange(
                      busyDays.map((x) =>
                        x.date === d.date
                          ? { ...x, loadReduction: clampPct(+e.target.value) / 100 }
                          : x
                      )
                    )
                  }
                  aria-label={`Adjust load reduction for ${d.date}`}
                />
                <button
                  type="button"
                  className="icon-btn is-danger"
                  aria-label={`Remove busy day ${d.date}`}
                  onClick={() => onChange(busyDays.filter((x) => x.date !== d.date))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
