import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  quickDateOptionsV3, parseTypedDate, isPastKey, calendarMatrix,
  repeatOptionsFor, monthSequence, DURATION_OPTIONS,
} from '../../utils/todoDates';
import { todayKey } from '../../utils/dateKeys';
import type { Recurrence } from '../../types';
import './todo.css';

export interface DateSelection {
  dateKey: string | null;
  dueTime: string | null;
  durationMin: number | null;
  recurrence: Recurrence | null;
}

interface Props {
  value: DateSelection;
  onApply: (sel: DateSelection) => void;
  onClose: () => void;
  /** Element the popover is anchored to (the chip). Omit for static/overlay use. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type Panel = 'main' | 'time' | 'repeat';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TodoDatePicker({ value, onApply, onClose, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayKey();

  const [sel, setSel] = useState<DateSelection>(value);
  const [panel, setPanel] = useState<Panel>('main');
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');
  const [headerMonth, setHeaderMonth] = useState(() => ({
    year: Number((value.dateKey ?? today).slice(0, 4)),
    month: Number((value.dateKey ?? today).slice(5, 7)),
  }));

  // Time panel draft (Cancel reverts)
  const [draftTime, setDraftTime] = useState<string | null>(value.dueTime);
  const [draftDuration, setDraftDuration] = useState<number | null>(value.durationMin);

  const months = useMemo(() => monthSequence(4), []);

  const TOPBAR_CLEARANCE = 68;   // TopBar height + gap
  const EDGE_MARGIN = 12;
  const GAP = 8;

  const [placement, setPlacement] = useState<{
    top?: number; bottom?: number; left: number; maxHeight: number;
  } | null>(null);

  const reposition = () => {
    const anchor = anchorRef?.current;
    const panelEl = ref.current;
    if (!anchor || !panelEl) return;

    const a = anchor.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const panelW = 300;

    const spaceBelow = vh - a.bottom - GAP - EDGE_MARGIN;
    const spaceAbove = a.top - GAP - TOPBAR_CLEARANCE;

    // Default: open downward. Flip up only if below is too small AND above is larger.
    const openDown = spaceBelow >= 320 || spaceBelow >= spaceAbove;

    const left = Math.min(Math.max(EDGE_MARGIN, a.left), vw - panelW - EDGE_MARGIN);

    if (openDown) {
      setPlacement({
        top: a.bottom + GAP,
        left,
        maxHeight: Math.max(240, spaceBelow),
      });
    } else {
      setPlacement({
        bottom: vh - a.top + GAP,
        left,
        maxHeight: Math.max(240, spaceAbove),
      });
    }
  };

  useLayoutEffect(() => {
    if (anchorRef?.current) reposition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]); // re-measure when switching main/time/repeat panels too

  useEffect(() => {
    if (!anchorRef?.current) return;
    const onWin = () => reposition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  const popStyle: React.CSSProperties | undefined =
    anchorRef && placement && !isMobile
      ? {
          position: 'fixed',
          top: placement.top,
          bottom: placement.bottom,
          left: placement.left,
          maxHeight: placement.maxHeight,
          overflowY: 'auto',
        }
      : undefined;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panel !== 'main') setPanel('main');
        else onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, panel]);

  const commit = (next: DateSelection) => {
    // repeat needs date; no date clears extras
    if (next.recurrence && next.dateKey === null) next.dateKey = today;
    if (next.dateKey === null) {
      next.recurrence = null; next.dueTime = null; next.durationMin = null;
    }
    setSel(next);
    onApply(next);
  };

  const pickDate = (key: string | null) => commit({ ...sel, dateKey: key });

  const submitTyped = () => {
    const parsed = parseTypedDate(typed);
    if (!parsed) return setTypedError('Try 2026-09-12, 12-09-2026 or "12 sep"');
    if (isPastKey(parsed)) return setTypedError('Pick today or a future date');
    setTypedError('');
    pickDate(parsed);
  };

  // Scroll-spy: update "Sep 2026" header from scroll position
  const onCalScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const blocks = el.querySelectorAll<HTMLElement>('[data-month]');
    for (const b of blocks) {
      if (b.offsetTop + b.offsetHeight - el.scrollTop > 40) {
        const [y, m] = (b.dataset.month ?? '').split('-').map(Number);
        if (y && m) setHeaderMonth({ year: y, month: m });
        break;
      }
    }
  };

  const jumpToToday = () => {
    const el = scrollRef.current;
    const first = el?.querySelector<HTMLElement>('[data-month]');
    if (el && first) el.scrollTo({ top: 0, behavior: 'smooth' });
    setHeaderMonth({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  };

  const scrollByMonth = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const blocks = [...el.querySelectorAll<HTMLElement>('[data-month]')];
    const idx = blocks.findIndex(
      (b) => b.dataset.month === `${headerMonth.year}-${headerMonth.month}`
    );
    const target = blocks[idx + dir];
    if (target) el.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };

  const returnToMain = () => setPanel('main');

  /* ────────────── TIME PANEL ────────────── */
  if (panel === 'time') {
    return (
      <div className="todo-datepicker todo-datepicker--v3" ref={ref} style={popStyle} role="dialog" aria-label="Set time">
        <div className="tdp-form">
          <label className="tdp-form__row">
            <span className="tdp-form__label">Time</span>
            <input
              type="time"
              className="field field--sm tdp-form__field"
              value={draftTime ?? ''}
              onChange={(e) => setDraftTime(e.target.value || null)}
            />
          </label>
          <label className="tdp-form__row">
            <span className="tdp-form__label">Duration</span>
            <div className="select-wrap tdp-form__field">
              <select
                className="field field--sm"
                value={draftDuration ?? ''}
                onChange={(e) => setDraftDuration(e.target.value ? Number(e.target.value) : null)}
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
            </div>
          </label>
          <div className="tdp-form__actions">
            <button type="button" className="btn-ghost btn-sm"
              onClick={() => { setDraftTime(sel.dueTime); setDraftDuration(sel.durationMin); returnToMain(); }}>
              Cancel
            </button>
            <button type="button" className="btn-primary btn-sm"
              onClick={() => { commit({ ...sel, dueTime: draftTime, durationMin: draftDuration }); returnToMain(); }}>
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────── REPEAT MENU ────────────── */
  if (panel === 'repeat') {
    return (
      <div className="todo-datepicker todo-datepicker--v3" ref={ref} style={popStyle} role="dialog" aria-label="Set repeat">
        <ul className="tdp-repeat">
          {repeatOptionsFor(sel.dateKey).map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={`tdp-repeat__option${sel.recurrence === opt.value ? ' is-active' : ''}`}
                onClick={() => { commit({ ...sel, recurrence: opt.value }); returnToMain(); }}
              >
                <span>{opt.label}</span>
                {opt.sub && <span className="tdp-repeat__sub">{opt.sub}</span>}
              </button>
            </li>
          ))}
          {sel.recurrence && (
            <li>
              <button type="button" className="tdp-repeat__option tdp-repeat__option--none"
                onClick={() => { commit({ ...sel, recurrence: null }); returnToMain(); }}>
                <span>None</span><span className="tdp-repeat__sub">remove repeat</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    );
  }

  /* ────────────── MAIN PANEL ────────────── */
  return (
    <div className="todo-datepicker todo-datepicker--v3" ref={ref} style={popStyle} role="dialog" aria-label="Set date">
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

      <ul className="todo-datepicker__list">
        {quickDateOptionsV3().map((opt) => (
          <li key={opt.id}>
            <button type="button"
              className={`todo-datepicker__option${sel.dateKey === opt.dateKey ? ' is-active' : ''}`}
              onClick={() => pickDate(opt.dateKey)}>
              <span className="tdp-opt__left">
                <span className="tdp-opt__icon" aria-hidden="true">{opt.icon}</span>
                {opt.label}
              </span>
              <span className="todo-datepicker__hint">{opt.hint}</span>
            </button>
          </li>
        ))}
        {sel.dateKey && (
          <li>
            <button type="button" className="todo-datepicker__option" onClick={() => pickDate(null)}>
              <span className="tdp-opt__left">
                <span className="tdp-opt__icon" aria-hidden="true">🚫</span>No date
              </span>
              <span className="todo-datepicker__hint">Inbox</span>
            </button>
          </li>
        )}
      </ul>

      {/* Continuous calendar */}
      <div className="tdp-cal">
        <div className="tdp-cal__bar">
          <span className="tdp-cal__month">
            {MONTH_SHORT[headerMonth.month - 1]} {headerMonth.year}
          </span>
          <div className="todo-cal__nav">
            <button type="button" className="todo-cal__nav-btn" aria-label="Previous month"
              onClick={() => scrollByMonth(-1)}>‹</button>
            <button type="button" className="todo-cal__nav-btn" aria-label="Jump to today"
              onClick={jumpToToday}>○</button>
            <button type="button" className="todo-cal__nav-btn" aria-label="Next month"
              onClick={() => scrollByMonth(1)}>›</button>
          </div>
        </div>

        <div className="todo-cal__dows" aria-hidden="true">
          {['M','T','W','T','F','S','S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>

        <div className="tdp-cal__scroll" ref={scrollRef} onScroll={onCalScroll}>
          {months.map(({ year, month }, mi) => (
            <div key={`${year}-${month}`} data-month={`${year}-${month}`} className="tdp-cal__block">
              {mi > 0 && (
                <div className="tdp-cal__label">{MONTH_SHORT[month - 1]}{month === 1 ? ` ${year}` : ''}</div>
              )}
              {calendarMatrix(year, month).map((row, wi) => (
                <div key={wi} className="todo-cal__week">
                  {row.map((cell) => (
                    <button key={cell.key} type="button"
                      className={[
                        'todo-cal__day',
                        cell.inMonth ? '' : 'is-out',
                        cell.isPast ? 'is-past' : '',
                        cell.key === today ? 'is-today' : '',
                        cell.key === sel.dateKey ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                      disabled={cell.isPast || !cell.inMonth}
                      onClick={() => pickDate(cell.key)}>
                      {cell.day}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer buttons */}
      <button type="button" className="tdp-footbtn" onClick={() => {
        setDraftTime(sel.dueTime); setDraftDuration(sel.durationMin); setPanel('time');
      }}>
        🕐 Time{sel.dueTime ? ` · ${sel.dueTime}` : ''}
        {sel.durationMin ? ` · ${DURATION_OPTIONS.find((o) => o.value === sel.durationMin)?.label}` : ''}
      </button>
      <button type="button" className="tdp-footbtn" onClick={() => setPanel('repeat')}>
        ↻ Repeat{sel.recurrence ? ` · ${repeatOptionsFor(sel.dateKey).find((o) => o.value === sel.recurrence)?.label ?? ''}` : ''}
      </button>
    </div>
  );
}
