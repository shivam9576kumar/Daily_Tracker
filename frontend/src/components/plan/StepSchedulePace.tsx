import type { PlanPace } from '../../types';
import './plan.css';

interface Props {
  startDate: string;
  durationDays: number;
  pace: PlanPace;
  weekdayLoad: number;
  weekendLoad: number;
  bufferDay: number;
  onChange: (fields: {
    startDate?: string;
    durationDays?: number;
    pace?: PlanPace;
    weekdayLoad?: number;
    weekendLoad?: number;
    bufferDay?: number;
  }) => void;
}

export default function StepSchedulePace({
  startDate,
  durationDays,
  pace,
  weekdayLoad,
  weekendLoad,
  bufferDay,
  onChange,
}: Props) {
  const handlePaceClick = (selectedPace: PlanPace) => {
    if (selectedPace === 'relaxed') {
      onChange({ pace: 'relaxed', weekdayLoad: 1.5, weekendLoad: 2.5 });
    } else if (selectedPace === 'moderate') {
      onChange({ pace: 'moderate', weekdayLoad: 2.0, weekendLoad: 3.0 });
    } else if (selectedPace === 'intensive') {
      onChange({ pace: 'intensive', weekdayLoad: 3.0, weekendLoad: 4.5 });
    } else {
      onChange({ pace: 'custom' });
    }
  };

  return (
    <div className="wizard-card">
      <div className="wizard-section-title">
        <span>⏱️ Step 2: Schedule & Pace</span>
      </div>

      <div className="pace-cards">
        <div
          className={`pace-card ${pace === 'relaxed' ? 'active' : ''}`}
          onClick={() => handlePaceClick('relaxed')}
        >
          <div className="pace-card-title">🌱 Relaxed</div>
          <div className="pace-card-desc">Weekday: 1.5 load • Weekend: 2.5 load</div>
        </div>

        <div
          className={`pace-card ${pace === 'moderate' ? 'active' : ''}`}
          onClick={() => handlePaceClick('moderate')}
        >
          <div className="pace-card-title">⚡ Moderate (Recommended)</div>
          <div className="pace-card-desc">Weekday: 2.0 load • Weekend: 3.0 load</div>
        </div>

        <div
          className={`pace-card ${pace === 'intensive' ? 'active' : ''}`}
          onClick={() => handlePaceClick('intensive')}
        >
          <div className="pace-card-title">🔥 Intensive</div>
          <div className="pace-card-desc">Weekday: 3.0 load • Weekend: 4.5 load</div>
        </div>

        <div
          className={`pace-card ${pace === 'custom' ? 'active' : ''}`}
          onClick={() => handlePaceClick('custom')}
        >
          <div className="pace-card-title">⚙️ Custom</div>
          <div className="pace-card-desc">Custom daily target weights</div>
        </div>
      </div>

      <div className="wizard-grid">
        <div className="form-field">
          <label>Start Date</label>
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>

        <div className="form-field">
          <label>Duration (Days)</label>
          <select
            className="form-select"
            value={durationDays}
            onChange={(e) => onChange({ durationDays: parseInt(e.target.value, 10) })}
          >
            <option value={7}>7 Days (Fast Sprint)</option>
            <option value={14}>14 Days (Balanced)</option>
            <option value={21}>21 Days</option>
            <option value={30}>30 Days (Standard Month)</option>
            <option value={45}>45 Days</option>
            <option value={60}>60 Days</option>
          </select>
        </div>

        <div className="form-field">
          <label>Weekday Load Target</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="10"
            className="form-input"
            value={weekdayLoad}
            onChange={(e) =>
              onChange({
                weekdayLoad: parseFloat(e.target.value) || 2.0,
                pace: 'custom',
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Weekend Load Target</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="10"
            className="form-input"
            value={weekendLoad}
            onChange={(e) =>
              onChange({
                weekendLoad: parseFloat(e.target.value) || 3.0,
                pace: 'custom',
              })
            }
          />
        </div>

        <div className="form-field">
          <label>Weekly Buffer Day</label>
          <select
            className="form-select"
            value={bufferDay}
            onChange={(e) => onChange({ bufferDay: parseInt(e.target.value, 10) })}
          >
            <option value={0}>Sunday (Recommended catch-up)</option>
            <option value={6}>Saturday</option>
            <option value={1}>Monday</option>
            <option value={5}>Friday</option>
          </select>
        </div>
      </div>
    </div>
  );
}
