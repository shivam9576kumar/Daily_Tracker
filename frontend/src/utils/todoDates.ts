import { addDaysToKey, formatKey, todayKey } from './dateKeys';

export interface QuickDateOption {
  id: string;
  label: string;
  hint: string;          // e.g. "Tue", "Sat 13"
  dateKey: string | null;
}

/** Next Saturday; if today is Sat/Sun, the weekend is "now" → today. */
function weekendKey(today: string): string {
  const dow = new Date(`${today}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  if (dow === 6 || dow === 0) return today;
  return addDaysToKey(today, 6 - dow);
}

/** Next Monday strictly after today. */
function nextMondayKey(today: string): string {
  const dow = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const delta = dow === 0 ? 1 : 8 - dow; // Sun→+1, Mon→+7, Tue→+6, ...
  return addDaysToKey(today, delta);
}

function shortHint(key: string): string {
  return formatKey(key, { weekday: 'short', day: 'numeric' });
}

export function quickDateOptions(): QuickDateOption[] {
  const today = todayKey();
  const tomorrow = addDaysToKey(today, 1);
  const plus3 = addDaysToKey(today, 3);
  const weekend = weekendKey(today);
  const monday = nextMondayKey(today);

  return [
    { id: 'today', label: 'Today', hint: shortHint(today), dateKey: today },
    { id: 'tomorrow', label: 'Tomorrow', hint: shortHint(tomorrow), dateKey: tomorrow },
    { id: 'plus3', label: '+3 days', hint: shortHint(plus3), dateKey: plus3 },
    { id: 'weekend', label: 'This weekend', hint: shortHint(weekend), dateKey: weekend },
    { id: 'monday', label: 'Next Monday', hint: shortHint(monday), dateKey: monday },
    { id: 'none', label: 'No date', hint: 'Inbox', dateKey: null },
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
