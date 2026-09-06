import { useState } from 'react';
import type { BusyDayInput } from '../../types';
import { getLocalDateKey, getOffsetDateKey } from '../../utils/planDraft';
import './plan.css';

interface Props {
  busyDays: BusyDayInput[];
  weekdayLoad?: number;
  weekendLoad?: number;
  onChange: (busyDays: BusyDayInput[]) => void;
}

const PRESETS = [
  { label: 'Light',    pct: 30,  defaultReason: 'Light Day' },
  { label: 'Half',     pct: 50,  defaultReason: 'Half Day' },
  { label: 'Exam Day', pct: 60,  defaultReason: 'Exam Day' },
  { label: 'Heavy',    pct: 80,  defaultReason: 'Heavy Day' },
  { label: 'No Study', pct: 100, defaultReason: 'No Study / Off' },
];

export default function StepBusyDays({
  busyDays,
  weekdayLoad = 2.0,
  weekendLoad = 3.0,
  onChange,
}: Props) {
  // Default date to Today so the user can immediately click + Add Busy Day
  const [busyDate, setBusyDate] = useState<string>(() => getLocalDateKey());
  const [busyReason, setBusyReason] = useState('Exam Day');
  const [reductionPct, setReductionPct] = useState<number>(60);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

  function remainingLoadPreview(pct: number, wdLoad: number, weLoad: number) {
    const factor = (100 - pct) / 100;
    const wd = +(wdLoad * factor).toFixed(2);
    const we = +(weLoad * factor).toFixed(2);
    return { factor, wd, we };
  }

  const { wd, we } = remainingLoadPreview(reductionPct, weekdayLoad, weekendLoad);

  const handleAddBusyDay = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!busyDate) return;

    const entry: BusyDayInput = {
      date: busyDate,
      reason: busyReason.trim() || 'Exam / Busy Day',
      loadReduction: reductionPct / 100, // 0..1 contract for backend
    };

    const next = [
      ...busyDays.filter((d) => d.date !== entry.date),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date));

    onChange(next);
    setAddedNotice(`Added busy day for ${formatDate(busyDate)}!`);
    setTimeout(() => setAddedNotice(null), 3000);
  };

  const handlePresetSelect = (preset: typeof PRESETS[number]) => {
    setReductionPct(preset.pct);
    if (!busyReason.trim() || PRESETS.some((p) => p.defaultReason === busyReason)) {
      setBusyReason(preset.defaultReason);
    }
    if (!busyDate) {
      setBusyDate(getLocalDateKey());
    }
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

  const quickDates = [
    { label: 'Today', date: getOffsetDateKey(0) },
    { label: 'Tomorrow', date: getOffsetDateKey(1) },
    { label: '+3 Days', date: getOffsetDateKey(3) },
    { label: '+7 Days', date: getOffsetDateKey(7) },
  ];

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 4 of 5</div>
      <h2 className="step-card__heading">Exams &amp; Busy Days</h2>
      <p className="step-card__hint">
        Add exams or busy days — load is reduced automatically for those days.
      </p>

      <form onSubmit={handleAddBusyDay} className="busy-add-form">
        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="form-field">
            <label htmlFor="busy-date">
              Exam / Busy Date <span style={{ color: 'var(--brand)', fontWeight: 600 }}>*</span>
            </label>
            <input
              id="busy-date"
              type="date"
              className="field"
              value={busyDate}
              onChange={(e) => setBusyDate(e.target.value)}
              required
            />
            {/* Quick date shortcuts */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {quickDates.map((qd) => (
                <button
                  key={qd.label}
                  type="button"
                  className={`chip ${busyDate === qd.date ? 'is-on' : ''}`}
                  style={{ padding: '3px 9px', fontSize: 11 }}
                  onClick={() => setBusyDate(qd.date)}
                >
                  {qd.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="busy-reason">Reason (optional)</label>
            <input
              id="busy-reason"
              type="text"
              className="field"
              placeholder="e.g. Midterm Exam, End Sem, Travel..."
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
                onClick={() => handlePresetSelect(p)}
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

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {addedNotice ? (
              <span style={{ color: 'var(--success-text)', fontSize: 13, fontWeight: 600 }}>
                ✓ {addedNotice}
              </span>
            ) : !busyDate ? (
              <span style={{ color: 'var(--warning-text)', fontSize: 12 }}>
                ⚠️ Select a date to add your busy day
              </span>
            ) : null}
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={!busyDate}
            style={{ padding: '8px 20px' }}
          >
            + Add Exam / Busy Day
          </button>
        </div>
      </form>

      {busyDays.length === 0 ? (
        <div className="busy-empty t-meta" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8 }}>
          ℹ️ No busy days added yet. Tasks will follow standard daily targets. Select a date above and click <strong>+ Add Exam / Busy Day</strong> to add one.
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-secondary)' }}>
            Scheduled Exams &amp; Busy Days ({busyDays.length})
          </h4>
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
        </div>
      )}
    </section>
  );
}
