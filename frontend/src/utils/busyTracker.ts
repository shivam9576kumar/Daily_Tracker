/**
 * Tracks in-flight mutations per entity id.
 * - start(id) returns false if that id is already in flight (double-submit guard).
 * - end(id) removes only that id, so concurrent completions never clear each other.
 * - onChange receives an immutable snapshot after every change.
 */
export interface BusyTracker {
  start(id: string): boolean;
  end(id: string): void;
  has(id: string): boolean;
  snapshot(): ReadonlySet<string>;
}

export function createBusyTracker(
  onChange?: (ids: ReadonlySet<string>) => void,
): BusyTracker {
  const ids = new Set<string>();
  const emit = () => onChange?.(new Set(ids));

  return {
    start(id) {
      if (ids.has(id)) return false;
      ids.add(id);
      emit();
      return true;
    },
    end(id) {
      if (ids.delete(id)) emit();
    },
    has(id) {
      return ids.has(id);
    },
    snapshot() {
      return new Set(ids);
    },
  };
}
