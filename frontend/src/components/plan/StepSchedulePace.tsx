import type { PlanPace } from '../../types';
import { getLocalDateKey } from '../../utils/planDraft';
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

const DURATION_PRESETS = [7, 14, 21, 30, 45, 60];

const PACES: Array<{
  id: PlanPace;
  name: string;
  icon: string;
  range: string;
  desc: string;
}> = [
  {
    id: 'relaxed',
    name: 'Relaxed',
    icon: '🌱',
    range: '1.5–2.5 load/day',
    desc: 'Weekday: 1.5 load · Weekend: 2.5 load',
  },
  {
    id: 'moderate',
    name: 'Moderate (Recommended)',
    icon: '⚡',
    range: '2.0–3.0 load/day',
    desc: 'Weekday: 2.0 load · Weekend: 3.0 load',
  },
  {
    id: 'intensive',
    name: 'Intensive',
    icon: '🔥',
    range: '3.0–4.5 load/day',
    desc: 'Weekday: 3.0 load · Weekend: 4.5 load',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    range: 'Custom target',
    desc: 'Custom daily target weights',
  },
];

export default function StepSchedulePace({
  startDate,
  durationDays,
  pace,
  weekdayLoad,
  weekendLoad,
  bufferDay,
  onChange,
}: Props) {
  const today = getLocalDateKey();
  const isPreset = DURATION_PRESETS.includes(durationDays);

  const applyDuration = (raw: string | number) => {
    const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
    if (Number.isNaN(n)) {
      onChange({ durationDays: 0 });
      return;
    }
    onChange({ durationDays: Math.min(365, Math.max(1, n)) });
  };

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
    <section className="card step-card">
      <div className="step-card__kicker">Step 2 of 5</div>
      <h2 className="step-card__heading">Schedule & Pace</h2>
      <p className="step-card__hint">
        Set your start date, plan length, and target problem load.
      </p>

      <div className="pace-grid">
        {PACES.map((p) => {
          const isSel = pace === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`option-card${isSel ? ' is-selected' : ''}`}
              onClick={() => handlePaceClick(p.id)}
              aria-pressed={isSel}
            >
              <span className="option-card__check" aria-hidden="true">✓</span>
              <span className="option-card__icon" aria-hidden="true">{p.icon}</span>
              <span className="option-card__title">{p.name}</span>
              <span className="pace-card__range">{p.range}</span>
              <span className="option-card__desc">{p.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="plan-start-date">Start Date</label>
          <input
            id="plan-start-date"
            type="date"
            className="field"
            value={startDate}
            min={today}
            onChange={(e) => {
              const val = e.target.value;
              if (val) onChange({ startDate: val });
            }}
            aria-label="Select start date"
          />
          <p className="form-hint" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Plan starts on this day.
          </p>
        </div>

        <div className="form-field">
          <label htmlFor="duration-input">Duration (Days)</label>

          <div className="duration-control">
            <input
              id="duration-input"
              type="number"
              inputMode="numeric"
              className="field duration-control__input"
              min={1}
              max={365}
              value={durationDays || ''}
              placeholder="e.g. 25"
              onChange={(e) => applyDuration(e.target.value)}
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isNaN(n) || n < 1) onChange({ durationDays: 1 });
              }}
              aria-describedby="duration-hint"
            />
            <span className="duration-control__unit">days</span>
          </div>

          <div className="duration-presets" role="group" aria-label="Duration quick picks">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${durationDays === d ? 'is-on' : ''}`}
                onClick={() => applyDuration(d)}
              >
                {d}
              </button>
            ))}
            <span className={`duration-presets__badge ${!isPreset && durationDays ? 'is-visible' : ''}`}>
              Custom
            </span>
          </div>

          <span id="duration-hint" className="form-field__hint">
            Type any number of days (1–365), or tap a quick pick.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="plan-weekday-load">Weekday Load Target</label>
          <input
            id="plan-weekday-load"
            type="number"
            step="0.5"
            min="0.5"
            max="10"
            className="field"
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
          <label htmlFor="plan-weekend-load">Weekend Load Target</label>
          <input
            id="plan-weekend-load"
            type="number"
            step="0.5"
            min="0.5"
            max="10"
            className="field"
            value={weekendLoad}
            onChange={(e) =>
              onChange({
                weekendLoad: parseFloat(e.target.value) || 3.0,
                pace: 'custom',
              })
            }
          />
        </div>

        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="plan-buffer-day">Weekly Buffer Day</label>
          <div className="select-wrap">
            <select
              id="plan-buffer-day"
              className="field"
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
    </section>
  );
}
