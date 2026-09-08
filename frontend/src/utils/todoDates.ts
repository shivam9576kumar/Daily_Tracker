import type { Recurrence } from '../types';
import { addDaysToKey, formatKey, todayKey } from './dateKeys';

export interface QuickDateOption {
  id: string;
  icon: string;
  label: string;
  hint: string;
  dateKey: string;
}

/** Next Saturday; if today is Sat/Sun, the weekend is "now" → today. */
export function weekendKeyOf(today: string): string {
  const dow = new Date(`${today}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  if (dow === 6 || dow === 0) return today;
  return addDaysToKey(today, 6 - dow);
}

/** Next Monday strictly after today. */
export function nextMondayKeyOf(today: string): string {
  const dow = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const delta = dow === 0 ? 1 : 8 - dow; // Sun→+1, Mon→+7, Tue→+6, ...
  return addDaysToKey(today, delta);
}

export function quickDateOptionsV3(): QuickDateOption[] {
  const today = todayKey();
  const tomorrow = addDaysToKey(today, 1);
  const weekend = weekendKeyOf(today);
  const nextWeek = nextMondayKeyOf(today);
  const dow = (k: string) => formatKey(k, { weekday: 'short' });
  return [
    { id: 'today', icon: '📅', label: 'Today', hint: dow(today), dateKey: today },
    { id: 'tomorrow', icon: '☀️', label: 'Tomorrow', hint: dow(tomorrow), dateKey: tomorrow },
    { id: 'weekend', icon: '🛋', label: 'This weekend', hint: dow(weekend), dateKey: weekend },
    { id: 'nextweek', icon: '➡️', label: 'Next week', hint: formatKey(nextWeek, { weekday: 'short', day: 'numeric', month: 'short' }), dateKey: nextWeek },
  ];
}

/** Chip label for the currently selected date. */
export function dateChipLabel(dateKey: string | null): string {
  if (dateKey === null) return 'Inbox';
  const today = todayKey();
  if (dateKey === today) return 'Today';
  if (dateKey === addDaysToKey(today, 1)) return 'Tomorrow';
  return formatKey(dateKey, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function isPastKey(dateKey: string): boolean {
  return dateKey < todayKey();
}

const ORDINALS = ['th','st','nd','rd'];
export function ordinal(n: number): string {
  const v = n % 100;
  return n + (ORDINALS[(v - 20) % 10] ?? ORDINALS[v] ?? ORDINALS[0]);
}

export interface RepeatOption { value: Recurrence; label: string; sub?: string }

/** Contextual repeat labels derived from anchor date. */
export function repeatOptionsFor(dateKey: string | null): RepeatOption[] {
  const anchor = dateKey ?? todayKey();
  const weekday = formatKey(anchor, { weekday: 'long' });
  const day = Number(anchor.slice(8, 10));
  const monthName = formatKey(anchor, { month: 'long' });
  return [
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: 'Every week', sub: `on ${weekday}` },
    { value: 'weekdays', label: 'Every weekday', sub: '(Mon - Fri)' },
    { value: 'monthly', label: 'Every month', sub: `on the ${ordinal(day)}` },
    { value: 'yearly', label: 'Every year', sub: `on ${monthName} ${ordinal(day)}` },
  ];
}

export function recurrenceChipLabel(r: Recurrence | null | undefined): string | null {
  if (!r) return null;
  return { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[r];
}

export const recurrenceLabel = recurrenceChipLabel;

export const DURATION_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No duration' },
  { value: 15, label: '15 min' }, { value: 30, label: '30 min' },
  { value: 45, label: '45 min' }, { value: 60, label: '1 h' },
  { value: 90, label: '1 h 30 min' }, { value: 120, label: '2 h' },
];

export function durationLabel(min: number | null | undefined): string | null {
  if (!min) return null;
  return DURATION_OPTIONS.find((o) => o.value === min)?.label ?? `${min} min`;
}

/** Months for continuous calendar: current + next `count`. */
export function monthSequence(count = 4): { year: number; month: number }[] {
  const t = todayKey();
  let y = Number(t.slice(0, 4));
  let m = Number(t.slice(5, 7));
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse "2026-09-12", "12-09-2026", "12 sep", "sep 12" → dateKey or null. */
export function parseTypedDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return buildKey(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return buildKey(+m[3], +m[2], +m[1]);

  m = s.match(/^(\d{1,2})\s+([a-z]+)$/);
  if (m && MONTHS[m[2].slice(0, 4)] !== undefined) {
    return withYear(+m[1], MONTHS[m[2].slice(0, 4)] ?? MONTHS[m[2].slice(0, 3)]);
  }
  m = s.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4)] ?? MONTHS[m[1].slice(0, 3)];
    if (mo !== undefined) return withYear(+m[2], mo);
  }
  return null;
}

function buildKey(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const check = new Date(`${key}T00:00:00.000Z`);
  return check.toISOString().slice(0, 10) === key ? key : null;
}

/** Day+month without year → this year, or next year if already past. */
function withYear(d: number, mo: number): string | null {
  const today = todayKey();
  const year = Number(today.slice(0, 4));
  const thisYear = buildKey(year, mo, d);
  if (!thisYear) return null;
  return thisYear >= today ? thisYear : buildKey(year + 1, mo, d);
}

export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
  isPast: boolean;
}

/** Monday-first calendar matrix for a given year/month (1-12). */
export function calendarMatrix(year: number, month: number): CalendarDay[][] {
  const today = todayKey();
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const firstDow = new Date(`${first}T00:00:00.000Z`).getUTCDay();  // 0=Sun
  const lead = (firstDow + 6) % 7;                                   // Monday-first offset
  const start = addDaysToKey(first, -lead);

  const weeks: CalendarDay[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const mo = Number(cursor.slice(5, 7));
      row.push({
        key: cursor,
        day: Number(cursor.slice(8, 10)),
        inMonth: mo === month,
        isPast: cursor < today,
      });
      cursor = addDaysToKey(cursor, 1);
    }
    weeks.push(row);
    if (Number(cursor.slice(5, 7)) !== month && weeks.length >= 5 && !row.some((c) => c.inMonth)) break;
  }
  return weeks.filter((row) => row.some((c) => c.inMonth) || weeks.indexOf(row) < 5);
}
