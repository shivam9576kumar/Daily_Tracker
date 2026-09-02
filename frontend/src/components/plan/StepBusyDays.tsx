import { useState } from 'react';
import Button from '../common/Button';
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
    <div className="wizard-card">
      <div className="wizard-section-title">
        <span>📅 Step 4: Exams & Busy Days (Optional)</span>
      </div>

      <form
        onSubmit={handleAdd}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto',
          gap: 12,
          alignItems: 'end',
          marginBottom: 16,
        }}
      >
        <div className="form-field">
          <label>Date</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Reason (e.g. Midterm, Travel)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Semester Exam..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Load Reduction</label>
          <select
            className="form-select"
            value={reduction}
            onChange={(e) => setReduction(parseFloat(e.target.value))}
          >
            <option value={0.3}>Light Busy (30% less load)</option>
            <option value={0.6}>Exam Day (60% less load)</option>
            <option value={1.0}>No Study (100% off)</option>
          </select>
        </div>

        <Button type="submit" variant="secondary" disabled={!date}>
          + Add Day
        </Button>
      </form>

      {busyDays.length > 0 ? (
        <div>
          {busyDays.map((b) => (
            <div key={b.date} className="busy-day-row">
              <span className="busy-day-date">{b.date}</span>
              <span className="busy-day-reason">{b.reason}</span>
              <span className="busy-day-reduction">
                {Math.round(b.loadReduction * 100)}% load reduction
              </span>
              <button
                type="button"
                onClick={() => handleRemove(b.date)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          No busy days added yet. Tasks will be distributed according to standard weekday/weekend targets.
        </div>
      )}
    </div>
  );
}
