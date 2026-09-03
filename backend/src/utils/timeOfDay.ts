/** All class times are naive "HH:MM" wall-clock strings. No timezones. */
export function parseHHMM(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(s ?? '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function formatHHMM(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(
    clamped % 60
  ).padStart(2, '0')}`;
}

export function assertHHMM(s: string, field: string): string {
  if (parseHHMM(s) === null) {
    throw new Error(`${field} must be HH:MM (00:00–23:59)`);
  }
  return String(s).trim();
}

export function assertDayOfWeek(n: unknown): number {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 6) {
    throw new Error('dayOfWeek must be 0–6 (0=Sun, 6=Sat)');
  }
  return v;
}
