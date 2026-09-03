/**
 * Calendar-day keys ('YYYY-MM-DD') in the BROWSER's local time.
 *
 * Why not toISOString(): revision and manual tasks are stored at LOCAL midnight, which in
 * UTC is the previous evening. toISOString() would file them a day early. Local parts don't.
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function localKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return localKey(new Date());
}

/** 'YYYY-MM-DD' → local midnight Date (no timezone shift). */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from `fromKey` to `toKey` (DST-safe via rounding). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / 86_400_000);
}

export function formatKey(
  key: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
): string {
  return keyToDate(key).toLocaleDateString('en-IN', opts);
}
