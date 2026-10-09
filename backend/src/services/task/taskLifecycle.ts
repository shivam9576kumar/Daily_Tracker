import type { Prisma, Task } from '@prisma/client';
import { ValidationError } from '../../utils/error';
import {
  isValidDateKey,
  taskScheduleForKey,
  todayKey,
} from '../../utils/dateKeys';

export const BACKLOG_TASK_TYPES = [
  'new',
  'revision',
  'personal',
] as const;

const BACKLOG_TYPE_SET = new Set<string>(BACKLOG_TASK_TYPES);

export const LIVE_TASK_WHERE: Prisma.TaskWhereInput = {
  OR: [
    { planId: null },
    { plan: { status: 'active' } },
  ],
};

/**
 * Scheduling keys are validated by scheduling write paths.
 * Null and empty keys are explicitly excluded here.
 *
 * Malformed historical keys must be reported by the repair script;
 * do not silently reinterpret them as Today.
 */
export const DATED_BACKLOG_TYPE_WHERE: Prisma.TaskWhereInput = {
  taskType: {
    in: [...BACKLOG_TASK_TYPES],
  },
  AND: [
    { scheduledDateKey: { not: null } },
    { NOT: { scheduledDateKey: '' } },
  ],
};

export const OPEN_BACKLOG_WHERE: Prisma.TaskWhereInput = {
  AND: [
    DATED_BACKLOG_TYPE_WHERE,
    {
      status: 'backlog',
      isBacklog: true,
      isExpired: false,
    },
  ],
};

type BacklogTask = Pick<
  Task,
  | 'taskType'
  | 'scheduledDateKey'
  | 'status'
  | 'isBacklog'
  | 'isExpired'
>;

export function isOpenBacklogTask(task: BacklogTask): boolean {
  return (
    BACKLOG_TYPE_SET.has(task.taskType) &&
    task.scheduledDateKey !== null &&
    task.scheduledDateKey !== '' &&
    task.status === 'backlog' &&
    task.isBacklog === true &&
    task.isExpired === false
  );
}

export function isOverdueLifecycleTask(
  task: Pick<Task, 'taskType' | 'scheduledDateKey'>,
  today: string,
): boolean {
  return (
    BACKLOG_TYPE_SET.has(task.taskType) &&
    isValidDateKey(task.scheduledDateKey) &&
    task.scheduledDateKey < today
  );
}

export interface Cp31UndoSettings {
  cp31Enabled: boolean;
  cp31Band: number | null;
}

/**
 * Pure calculation only.
 *
 * Call this ONLY after verifying inside the transaction
 * that the task is currently completed.
 *
 * The transaction handles revisions, recurrence cleanup,
 * coin refunds and the actual write.
 */
export function getUndoLifecyclePatch(
  task: Pick<
    Task,
    'taskType' | 'scheduledDateKey' | 'cp31ProblemId'
  >,
  tz: string,
  now: Date,
  cp31Settings?: Cp31UndoSettings,
): Prisma.TaskUpdateInput {
  const reset: Prisma.TaskUpdateInput = {
    status: 'pending',
    rating: null,
    completedAt: null,
    originalSolveDate: null,
    isBacklog: false,
    backlogSince: null,
    isExpired: false,
    isSkipped: false,
    skippedAt: null,
  };

  if (task.taskType === 'cp31') {
    if (!cp31Settings) {
      throw new ValidationError(
        'CP31 settings are required when undoing a CP31 solve',
      );
    }

    const activeBand =
      cp31Settings.cp31Enabled &&
      cp31Settings.cp31Band !== null &&
      task.cp31ProblemId?.startsWith(
        `cp31-${cp31Settings.cp31Band}-`,
      ) === true;

    return {
      ...reset,
      ...(activeBand
        ? taskScheduleForKey(todayKey(tz, now), tz)
        : {
            scheduledDate: null,
            scheduledDateKey: null,
          }),
    };
  }

  // POTD retains its challenge identity and existing schedule.
  // Its domain, not generic maintenance, handles historical cleanup.
  if (task.taskType === 'potd') {
    return reset;
  }

  if (isOverdueLifecycleTask(task, todayKey(tz, now))) {
    return {
      ...reset,
      status: 'backlog',
      isBacklog: true,
      backlogSince: now,
    };
  }

  return reset;
}
