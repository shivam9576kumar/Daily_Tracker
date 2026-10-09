import { useCallback, useState } from 'react';
import { taskApi } from '../services/taskApi';
import { getErrorMessage } from '../services/api';
import { useUIStore } from '../store/uiStore';
import { usePlanStore } from '../store/planStore';
import { useTodoStore } from '../store/todoStore';
import type { Rating, Task, TaskMutationResult } from '../types';

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
    async <T>(
      id: string,
      call: () => Promise<T>,
      message: (result: T) => string,
      kind: Kind,
    ): Promise<T | null> => {
      if (busyId) return null;
      setBusyId(id);
      try {
        const result = await call();
        toast(message(result), kind);
        await onChanged();
        // Keep active plan & roadmap revisions synchronized
        usePlanStore.getState().fetchActive().catch(() => {});
        useTodoStore.getState().fetch(true).catch(() => {});
        return result;
      } catch (err) {
        toast(getErrorMessage(err), 'error');
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [toast, onChanged, busyId]
  );

  const solve = useCallback((task: Task) => run<TaskMutationResult>(
    task.id,
    () => taskApi.complete(task.id),
    (result) =>
      task.taskType === 'personal'
        ? 'Done ✓'
        : task.taskType === 'revision'
          ? `Revision done · +${result.coinsDelta} coins`
          : `Solved · +${result.coinsDelta} coins · pick Easy / Medium / Hard to schedule revisions`,
    'success'
  ), [run]);

  const unsolve = useCallback((task: Task) => run<TaskMutationResult>(
    task.id,
    () => taskApi.undo(task.id),
    (result) => [
      'Marked as unsolved',
      result.task.status === 'backlog' ? 'back in your backlog' : null,
      task.rating ? 'revision plan cleared' : null,
      task.taskType === 'personal' || result.coinsDelta === 0 ? null : `${result.coinsDelta} coins`,
    ].filter(Boolean).join(' · '),
    'info'
  ), [run]);

  const toggleSolved = useCallback(
    (task: Task) => (task.status === 'completed' ? unsolve(task) : solve(task)),
    [solve, unsolve]
  );

  const rate = useCallback((task: Task, rating: Rating) => run<TaskMutationResult>(
    task.id,
    () => taskApi.rate(task.id, rating),
    (result) =>
      result.coinsDelta > 0
        ? `Rated ${rating} · +${result.coinsDelta} coins · revisions scheduled — see them on your Roadmap`
        : `Rated ${rating} · revisions scheduled — see them on your Roadmap`,
    'success'
  ), [run]);

  const unrate = useCallback((task: Task) => run<TaskMutationResult>(
    task.id,
    () => taskApi.unrate(task.id),
    (result) =>
      result.coinsDelta < 0
        ? `Rating removed · ${result.coinsDelta} coins · upcoming revisions cleared · still counts as solved`
        : 'Rating removed · upcoming revisions cleared · still counts as solved',
    'info'
  ), [run]);

  return { busyId, solve, unsolve, toggleSolved, rate, unrate };
}
