import { useCallback, useState } from 'react';
import { taskApi } from '../services/taskApi';
import { getErrorMessage } from '../services/api';
import { useUIStore } from '../store/uiStore';
import { coinsFor } from '../utils/coins';
import type { Rating, Task } from '../types';

type Kind = 'success' | 'info' | 'error';

/**
 * One place for every solve / unsolve / rate / unrate call.
 * Used by the hitlist rows AND the drawer so both behave identically.
 * `onChanged` runs after every successful mutation (refresh dashboard, reload drawer, …).
 */
export function useTaskActions(onChanged: () => void | Promise<void>) {
  const toast = useUIStore((s) => s.toast);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, call: () => Promise<Task>, message: (updated: Task) => string, kind: Kind): Promise<Task | null> => {
      setBusyId(id);
      try {
        const updated = await call();
        toast(message(updated), kind);
        await onChanged();
        return updated;
      } catch (err) {
        toast(getErrorMessage(err), 'error');
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [toast, onChanged]
  );

  const solve = useCallback((task: Task) => run(
    task.id,
    () => taskApi.complete(task.id),
    () => task.taskType === 'revision'
      ? `Revision done · +${coinsFor(task)} coins`
      : `Solved · +${coinsFor(task)} coins · pick Easy / Medium / Hard to schedule revisions`,
    'success'
  ), [run]);

  const unsolve = useCallback((task: Task) => run(
    task.id,
    () => taskApi.undo(task.id),
    (u) => [
      'Marked as unsolved',
      u.status === 'backlog' ? 'back in your backlog' : null,
      task.rating ? 'revision plan cleared' : null,
      `−${coinsFor(task)} coins`,
    ].filter(Boolean).join(' · '),
    'info'
  ), [run]);

  const toggleSolved = useCallback(
    (task: Task) => (task.status === 'completed' ? unsolve(task) : solve(task)),
    [solve, unsolve]
  );

  const rate = useCallback((task: Task, rating: Rating) => run(
    task.id,
    () => taskApi.rate(task.id, rating),
    () => `Rated ${rating} · revisions scheduled — see them on your Roadmap`,
    'success'
  ), [run]);

  const unrate = useCallback((task: Task) => run(
    task.id,
    () => taskApi.unrate(task.id),
    () => 'Rating removed · upcoming revisions cleared · still counts as solved',
    'info'
  ), [run]);

  return { busyId, solve, unsolve, toggleSolved, rate, unrate };
}
