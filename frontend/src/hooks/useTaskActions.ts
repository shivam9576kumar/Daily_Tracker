import { useCallback, useMemo, useState } from 'react';
import { taskApi } from '../services/taskApi';
import { getErrorMessage } from '../services/api';
import { useUIStore } from '../store/uiStore';
import { usePlanStore } from '../store/planStore';
import { useTodoStore } from '../store/todoStore';
import { useDashboardStore } from '../store/dashboardStore';
import { createBusyTracker } from '../utils/busyTracker';
import type { Rating, Task } from '../types';

type Kind = 'success' | 'info' | 'error';

/**
 * One place for every solve / unsolve / rate / unrate call.
 *
 * Concurrency model:
 *  - Actions on DIFFERENT tasks run concurrently.
 *  - A second action on the SAME task while one is in flight is ignored.
 *  - busyIds is a snapshot, so each row's spinner is independent.
 */
export function useTaskActions(onChanged: () => void | Promise<void>) {
  const toast = useUIStore((s) => s.toast);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const tracker = useMemo(() => createBusyTracker(setBusyIds), []);

  const isBusy = useCallback((id: string) => busyIds.has(id), [busyIds]);

  const run = useCallback(
    async <T>(
      id: string,
      call: () => Promise<T>,
      message: (result: T) => string,
      kind: Kind,
    ): Promise<T | null> => {
      if (!tracker.start(id)) return null;

      let result: T;
      try {
        result = await call();
      } catch (err) {
        tracker.end(id);
        toast(getErrorMessage(err), 'error');
        return null;
      }

      // Release this row before the refresh round-trips, so the row shows its result immediately.
      tracker.end(id);
      toast(message(result), kind);

      await onChanged();
      usePlanStore.getState().fetchActive({ silent: true }).catch(() => {});
      useTodoStore.getState().fetch(true).catch(() => {});
      useDashboardStore.getState().fetch(true).catch(() => {});
      return result;
    },
    [tracker, toast, onChanged],
  );

  const solve = useCallback(
    (task: Task) =>
      run(
        task.id,
        () => taskApi.complete(task.id),
        (r) =>
          task.taskType === 'personal'
            ? 'Done ✓'
            : task.taskType === 'revision'
              ? `Revision done · +${r.coinsDelta} coins`
              : `Solved · +${r.coinsDelta} coins · pick Easy / Medium / Hard to schedule revisions`,
        'success',
      ),
    [run],
  );

  const unsolve = useCallback(
    (task: Task) =>
      run(
        task.id,
        () => taskApi.undo(task.id),
        (r) =>
          [
            'Marked as unsolved',
            r.task.status === 'backlog' ? 'back in your backlog' : null,
            task.rating ? 'revision plan cleared' : null,
            task.taskType === 'personal' || r.coinsDelta === 0 ? null : `${r.coinsDelta} coins`,
          ]
            .filter(Boolean)
            .join(' · '),
        'info',
      ),
    [run],
  );

  const toggleSolved = useCallback(
    (task: Task) => (task.status === 'completed' ? unsolve(task) : solve(task)),
    [solve, unsolve],
  );

  const rate = useCallback(
    (task: Task, rating: Rating) =>
      run(
        task.id,
        () => taskApi.rate(task.id, rating),
        (r) =>
          r.coinsDelta > 0
            ? `Rated ${rating} · +${r.coinsDelta} coins · revisions scheduled — see them on your Roadmap`
            : `Rated ${rating} · revisions scheduled — see them on your Roadmap`,
        'success',
      ),
    [run],
  );

  const unrate = useCallback(
    (task: Task) =>
      run(
        task.id,
        () => taskApi.unrate(task.id),
        (r) =>
          r.coinsDelta < 0
            ? `Rating removed · ${r.coinsDelta} coins · upcoming revisions cleared · still counts as solved`
            : 'Rating removed · upcoming revisions cleared · still counts as solved',
        'info',
      ),
    [run],
  );

  // DEPRECATED alias: the most recently started busy id. Remove once every
  // consumer uses isBusy(). Tracked in the acceptance criteria.
  const busyId = busyIds.size > 0 ? [...busyIds][busyIds.size - 1] : null;

  return { busyIds, isBusy, busyId, solve, unsolve, toggleSolved, rate, unrate };
}
