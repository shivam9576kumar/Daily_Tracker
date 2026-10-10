import { Temporal } from '@js-temporal/polyfill';
import { env } from '../config/env';
import { ValidationError } from './error';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

import { Recurrence, RECURRENCE_VALUES } from '@dsa-planner/shared';
export { type Recurrence, RECURRENCE_VALUES };

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) {
    return false;
  }

  try {
    const date = Temporal.PlainDate.from(value, {
      overflow: 'reject',
    });

    return date.toString() === value;
  } catch {
    return false;
  }
}

export function assertDateKey(
  value: unknown,
  field = 'dateKey',
): string {
  if (!isValidDateKey(value)) {
    throw new ValidationError(
      `${field} must be a real calendar date in YYYY-MM-DD format`,
    );
  }

  return value;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(
  candidate?: string | null,
): string {
  if (candidate && isValidTimeZone(candidate)) {
    return candidate;
  }

  const fallback = env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

  if (!isValidTimeZone(fallback)) {
    throw new Error(
      'DEFAULT_TIMEZONE must be a valid IANA timezone',
    );
  }

  return fallback;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Instant → 'YYYY-MM-DD' as seen on the wall clock in `tz`. */
export function dateKeyInTz(date: Date, tz: string): string {
  const parts = formatter(tz).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function todayKey(
  tz?: string,
  now: Date = new Date(),
): string {
  return dateKeyInTz(now, resolveTimeZone(tz));
}

export function addDaysToKey(
  key: string,
  days: number,
): string {
  if (!Number.isInteger(days)) {
    throw new ValidationError('days must be an integer');
  }

  const date = Temporal.PlainDate.from(assertDateKey(key));
  const result = date.add({ days });

  return assertDateKey(result.toString());
}

function calendarDayStart(
  key: string,
  tz: string,
): Temporal.ZonedDateTime {
  const validKey = assertDateKey(key);

  if (!isValidTimeZone(tz)) {
    throw new ValidationError('Invalid timezone');
  }

  const date = Temporal.PlainDate.from(validKey);
  const start = date.toZonedDateTime(tz).startOfDay();

  // Some historical timezone changes skipped a whole calendar day.
  // Never silently schedule such an input onto a different date.
  if (start.toPlainDate().toString() !== validKey) {
    throw new ValidationError(
      `${validKey} does not exist in timezone ${tz}`,
    );
  }

  return start;
}

/**
 * The first valid instant of the requested local calendar day.
 *
 * Usually this is 00:00 local time. A midnight DST transition can
 * make the first valid time later than 00:00.
 */
export function zonedDayStartUtc(
  key: string,
  tz: string,
): Date {
  const start = calendarDayStart(key, tz);

  return new Date(Number(start.epochMilliseconds));
}

/**
 * Half-open interval [start, end) covering the local calendar day.
 *
 * Never calculate end as start + 24 hours.
 */
export function zonedDayRangeUtc(
  key: string,
  tz: string,
): { start: Date; end: Date } {
  const start = calendarDayStart(key, tz);
  const end = start.add({ days: 1 }).startOfDay();

  return {
    start: new Date(Number(start.epochMilliseconds)),
    end: new Date(Number(end.epochMilliseconds)),
  };
}

export function taskScheduleForKey(
  key: string,
  tz: string,
): {
  scheduledDate: Date;
  scheduledDateKey: string;
} {
  const validKey = assertDateKey(key, 'scheduledDateKey');

  return {
    scheduledDateKey: validKey,
    scheduledDate: zonedDayStartUtc(validKey, tz),
  };
}

/**
 * Manual DSA-task scheduling input:
 *
 * - undefined: use local Today on CREATE only
 * - YYYY-MM-DD: logical calendar date
 * - ISO timestamp with an explicit offset: derive its local day
 *
 * Callers must not invoke this on an omitted UPDATE field.
 */
export function taskScheduleFromInput(
  raw: unknown,
  tz: string,
  now: Date = new Date(),
): {
  scheduledDate: Date;
  scheduledDateKey: string;
} {
  if (raw === undefined) {
    return taskScheduleForKey(todayKey(tz, now), tz);
  }

  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ValidationError(
      'scheduledDate must be YYYY-MM-DD or an ISO timestamp with an explicit timezone',
    );
  }

  if (DATE_KEY_RE.test(raw)) {
    return taskScheduleForKey(
      assertDateKey(raw, 'scheduledDate'),
      tz,
    );
  }

  let instant: Temporal.Instant;

  try {
    // Rejects ambiguous datetimes without an explicit offset.
    instant = Temporal.Instant.from(raw);
  } catch {
    throw new ValidationError(
      'scheduledDate must be YYYY-MM-DD or an ISO timestamp with an explicit timezone',
    );
  }

  const date = new Date(Number(instant.epochMilliseconds));
  const key = dateKeyInTz(date, tz);

  return taskScheduleForKey(key, tz);
}

/** Later of two 'YYYY-MM-DD' keys (lexicographic = chronological). */
export function maxKey(a: string, b: string): string {
  return a >= b ? a : b;
}

export function keyToParts(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day }; // month is 1-12
}

/** month is 1-12 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for a calendar date key. */
export function weekdayOfKey(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function monthLabel(month: number): string {
  return MONTH_LABELS[month - 1];
}

/** Next occurrence strictly after `fromKey`. */
export function nextOccurrenceKey(fromKey: string, recurrence: Recurrence): string {
  if (recurrence === 'daily') return addDaysToKey(fromKey, 1);

  if (recurrence === 'weekly') return addDaysToKey(fromKey, 7);

  if (recurrence === 'weekdays') {
    let k = addDaysToKey(fromKey, 1);
    while (weekdayOfKey(k) === 0 || weekdayOfKey(k) === 6) k = addDaysToKey(k, 1);
    return k;
  }

  if (recurrence === 'yearly') {
    const { year, month, day } = keyToParts(fromKey);
    const ny = year + 1;
    const clamped = Math.min(day, daysInMonth(ny, month)); // Feb 29 → Feb 28
    return `${ny}-${pad2(month)}-${pad2(clamped)}`;
  }

  // monthly: same day next month, clamped to that month's length
  const { year, month, day } = keyToParts(fromKey);
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const clamped = Math.min(day, daysInMonth(ny, nm));
  return `${ny}-${pad2(nm)}-${pad2(clamped)}`;
}

/**
 * Safe DB lower bound for "everything on or after `key` in any timezone":
 * midnight UTC of that key minus one day. We filter precisely by key in JS afterwards.
 */
export function lowerBoundForKey(key: string): Date {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
