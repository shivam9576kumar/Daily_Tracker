import { useState } from 'react';
import type { BusyDayInput } from '../../types';
import './plan.css';

interface Props {
  busyDays: BusyDayInput[];
  onChange: (busyDays: BusyDayInput[]) => void;
}

export default function StepBusyDays({ busyDays, onChange }: Props) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [reduction, setReduction] = useState(0.6);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    const next = [
      ...busyDays.filter((b) => b.date !== date),
      {
        date,
        reason: reason.trim() || 'Exam / Busy',
        loadReduction: reduction,
      },
    ].sort((a, b) => a.date.localeCompare(b.date));

    onChange(next);
    setDate('');
    setReason('');
  };

  const handleRemove = (targetDate: string) => {
    onChange(busyDays.filter((b) => b.date !== targetDate));
  };

  return (
    <section className="card step-card">
      <div className="step-card__kicker">Step 4 of 5</div>
      <h2 className="step-card__heading">Exams & Busy Days</h2>
      <p className="step-card__hint">
        Add exams or heavy days — load is reduced automatically.
      </p>

      <form onSubmit={handleAdd} className="busy-form">
        <div className="form-field">
          <label htmlFor="busy-date">Date</label>
          <input
            id="busy-date"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="busy-reason">Reason (optional)</label>
          <input
            id="busy-reason"
            type="text"
            className="field"
            placeholder="e.g. Midterm exam, travel..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor="busy-reduction">Load</label>
          <div className="select-wrap">
            <select
              id="busy-reduction"
              className="field"
              value={reduction}
              onChange={(e) => setReduction(parseFloat(e.target.value))}
            >
              <option value={0.3}>Light (30% less load)</option>
              <option value={0.6}>Exam Day (60% less load)</option>
              <option value={1.0}>No Study (100% off)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn-brand-outline"
          disabled={!date}
        >
          + Add Day
        </button>
      </form>

      {busyDays.length > 0 ? (
        <div className="busy-list">
          {busyDays.map((b) => (
            <div key={b.date} className="busy-row">
              <span className="busy-row__date">{b.date}</span>
              <span className="busy-row__reason">{b.reason}</span>
              <span className="pill pill-warning">
                {Math.round(b.loadReduction * 100)}% load reduction
              </span>
              <button
                type="button"
                className="icon-btn is-danger"
                aria-label={`Remove busy day ${b.date}`}
                onClick={() => handleRemove(b.date)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="busy-empty">
          No busy days added yet. Tasks will follow standard daily targets.
        </p>
      )}
    </section>
  );
}
