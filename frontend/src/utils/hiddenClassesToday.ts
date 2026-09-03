import { todayLocalKey } from './timeFormat';

/**
 * Cancelled classes for TODAY only.
 * Storage shape: { date: 'YYYY-MM-DD', ids: string[] }
 * When today's date changes, the store resets automatically on first read.
 */
const KEY = 'my_classes_hidden_today';

interface Blob {
  date: string;
  ids: string[];
}

function read(): Blob {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: todayLocalKey(), ids: [] };
    const parsed = JSON.parse(raw) as Blob;
    if (parsed.date !== todayLocalKey()) return { date: todayLocalKey(), ids: [] };
    return { date: parsed.date, ids: Array.isArray(parsed.ids) ? parsed.ids : [] };
  } catch {
    return { date: todayLocalKey(), ids: [] };
  }
}

function write(b: Blob) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* quota / private mode */
  }
}

export const hiddenToday = {
  get(): Set<string> {
    return new Set(read().ids);
  },
  hide(id: string) {
    const b = read();
    if (!b.ids.includes(id)) b.ids.push(id);
    write(b);
  },
  unhide(id: string) {
    const b = read();
    b.ids = b.ids.filter((x) => x !== id);
    write(b);
  },
  clearAll() {
    write({ date: todayLocalKey(), ids: [] });
  },
};
