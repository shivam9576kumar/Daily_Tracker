/**
 * All progress math works on "date keys" = 'YYYY-MM-DD' strings in the USER's timezone.
 * Never use new Date().setHours(0,0,0,0) or SQL DATE() for user-facing day math.
 */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
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

export function todayKey(tz: string): string {
  return dateKeyInTz(new Date(), tz);
}

/** Add days to a key without any timezone/DST drift. */
export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

/**
 * Safe DB lower bound for "everything on or after `key` in any timezone":
 * midnight UTC of that key minus one day. We filter precisely by key in JS afterwards.
 */
export function lowerBoundForKey(key: string): Date {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
