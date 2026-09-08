import { useEffect, useRef, useState } from 'react';
import {
  quickDateOptions, isPastKey, parseTypedDate, calendarMatrix, RECURRENCE_OPTIONS,
} from '../../utils/todoDates';
import { todayKey } from '../../utils/dateKeys';
import type { Recurrence } from '../../types';
import './todo.css';

export interface DateSelection {
  dateKey: string | null;
  dueTime: string | null;
  recurrence: Recurrence | null;
}

interface Props {
  value: DateSelection;
  onApply: (sel: DateSelection) => void;
  onClose: () => void;
}

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export default function TodoDatePicker({ value, onApply, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayKey();

  const [dateKey, setDateKey] = useState<string | null>(value.dateKey);
  const [dueTime, setDueTime] = useState<string | null>(value.dueTime);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(value.recurrence);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');
  const [showTime, setShowTime] = useState(Boolean(value.dueTime));
  const [showRepeat, setShowRepeat] = useState(Boolean(value.recurrence));

  const anchor = dateKey ?? today;
  const [viewYear, setViewYear] = useState(Number(anchor.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(anchor.slice(5, 7)));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const apply = (next: Partial<DateSelection>) => {
    const merged: DateSelection = {
      dateKey: next.dateKey !== undefined ? next.dateKey : dateKey,
      dueTime: next.dueTime !== undefined ? next.dueTime : dueTime,
      recurrence: next.recurrence !== undefined ? next.recurrence : recurrence,
    };
    // Rules: repeat needs a date; no-date clears time+repeat
    if (merged.recurrence && merged.dateKey === null) merged.dateKey = today;
    if (merged.dateKey === null) { merged.recurrence = null; merged.dueTime = null; }
    onApply(merged);
  };

  const pickDate = (key: string | null) => { setDateKey(key); apply({ dateKey: key }); };

  const submitTyped = () => {
    const parsed = parseTypedDate(typed);
    if (!parsed) { setTypedError('Try 2026-09-12, 12-09-2026 or "12 sep"'); return; }
    if (isPastKey(parsed)) { setTypedError('Pick today or a future date'); return; }
    setTypedError('');
    pickDate(parsed);
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const currentYear = Number(today.slice(0, 4));
  const monthsAhead = (viewYear - currentYear) * 12 + (viewMonth - Number(today.slice(5, 7)));
  const weeks = calendarMatrix(viewYear, viewMonth);

  return (
    <div className="todo-datepicker todo-datepicker--v2" ref={ref} role="dialog" aria-label="Set date">
      {/* Type a date */}
      <div className="todo-datepicker__typed">
        <input
          className="todo-datepicker__typed-input"
          placeholder="Type a date"
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setTypedError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitTyped(); } }}
        />
        {typedError && <p className="todo-datepicker__error">{typedError}</p>}
      </div>

      {/* Quick options */}
      <ul className="todo-datepicker__list">
        {quickDateOptions().map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              className={`todo-datepicker__option${dateKey === opt.dateKey ? ' is-active' : ''}`}
              onClick={() => pickDate(opt.dateKey)}
            >
              <span>{opt.label}</span>
              <span className="todo-datepicker__hint">{opt.hint}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Calendar grid */}
      <div className="todo-cal">
        <div className="todo-cal__head">
          <span className="todo-cal__month">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
          <div className="todo-cal__nav">
            <button type="button" className="todo-cal__nav-btn" onClick={prevMonth}
              disabled={monthsAhead <= 0} aria-label="Previous month">‹</button>
            <button type="button" className="todo-cal__nav-btn" onClick={nextMonth}
              disabled={monthsAhead >= 12} aria-label="Next month">›</button>
          </div>
        </div>

        <div className="todo-cal__dows" aria-hidden="true">
          {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>

        {weeks.map((row, wi) => (
          <div key={wi} className="todo-cal__week">
            {row.map((cell) => (
              <button
                key={cell.key}
                type="button"
                className={[
                  'todo-cal__day',
                  cell.inMonth ? '' : 'is-out',
                  cell.isPast ? 'is-past' : '',
                  cell.key === today ? 'is-today' : '',
                  cell.key === dateKey ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                disabled={cell.isPast || !cell.inMonth}
                onClick={() => pickDate(cell.key)}
              >
                {cell.day}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Time */}
      <div className="todo-datepicker__section">
        <button type="button" className="todo-datepicker__expander"
          aria-expanded={showTime} onClick={() => setShowTime((v) => !v)}>
          🕐 Time {dueTime ? `· ${dueTime}` : ''}
        </button>
        {showTime && (
          <div className="todo-datepicker__section-body">
            <input
              type="time"
              className="field field--sm"
              value={dueTime ?? ''}
              onChange={(e) => { const v = e.target.value || null; setDueTime(v); apply({ dueTime: v }); }}
            />
            {dueTime && (
              <button type="button" className="t-link" onClick={() => { setDueTime(null); apply({ dueTime: null }); }}>
                Clear
              </button>
            )}
            <p className="todo-datepicker__note">Shown on the task — no reminders yet.</p>
          </div>
        )}
      </div>

      {/* Repeat */}
      <div className="todo-datepicker__section">
        <button type="button" className="todo-datepicker__expander"
          aria-expanded={showRepeat} onClick={() => setShowRepeat((v) => !v)}>
          ↻ Repeat {recurrence ? `· ${RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label}` : ''}
        </button>
        {showRepeat && (
          <div className="todo-datepicker__repeat">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={`todo-datepicker__option${recurrence === opt.value ? ' is-active' : ''}`}
                onClick={() => { setRecurrence(opt.value); apply({ recurrence: opt.value }); }}
              >
                <span>{opt.label}</span>
                {opt.value && recurrence === opt.value && <span className="todo-datepicker__hint">✓</span>}
              </button>
            ))}
            <p className="todo-datepicker__note">Repeats after you complete it. Needs a date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
