import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';
import {
  RECURRENCE_VALUES,
  resolveTimeZone,
  taskScheduleForKey,
  todayKey,
  type Recurrence,
} from '../../utils/dateKeys';
import { isOverdueLifecycleTask } from '../task/taskLifecycle';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function assertTitle(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new ValidationError('Title is required');
  const t = raw.trim();
  if (t.length > 200) throw new ValidationError('Title must be under 200 characters');
  return t;
}

/** dateKey: undefined = don't touch, null = clear (Inbox), 'YYYY-MM-DD' = schedule */
function parseDateKey(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw === 'string' && DATE_KEY_RE.test(raw)) return raw;
  throw new ValidationError('scheduledDateKey must be YYYY-MM-DD or null');
}

function parseRecurrence(raw: unknown): Recurrence | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw === 'string' && (RECURRENCE_VALUES as string[]).includes(raw)) {
    return raw as Recurrence;
  }
  throw new ValidationError(`recurrence must be one of: ${RECURRENCE_VALUES.join(', ')}, or null`);
}

function parseDueTime(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw === 'string' && TIME_RE.test(raw)) return raw;
  throw new ValidationError('dueTime must be HH:MM (00:00–23:59) or null');
}

const DURATION_ALLOWED = [15, 30, 45, 60, 90, 120];

function parseDurationMin(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (Number.isInteger(n) && DURATION_ALLOWED.includes(n)) return n;
  throw new ValidationError(`durationMin must be one of: ${DURATION_ALLOWED.join(', ')}, or null`);
}

function scheduleFields(dateKey: string | null, tz: string) {
  if (dateKey === null) {
    return { scheduledDate: null, scheduledDateKey: null };
  }
  const schedule = taskScheduleForKey(dateKey, resolveTimeZone(tz));
  return {
    scheduledDate: schedule.scheduledDate,
    scheduledDateKey: schedule.scheduledDateKey,
  };
}

export const personalTaskService = {
  async create(userId: string, body: {
    title?: unknown; scheduledDateKey?: unknown; recurrence?: unknown; dueTime?: unknown; durationMin?: unknown;
  }, tz?: string) {
    const effectiveTz = resolveTimeZone(tz);
    const title = assertTitle(body.title);
    let dateKey = parseDateKey(body.scheduledDateKey) ?? null;
    const recurrence = parseRecurrence(body.recurrence) ?? null;
    const dueTime = parseDueTime(body.dueTime) ?? null;
    const durationMin = parseDurationMin(body.durationMin) ?? null;

    if (recurrence && dateKey === null) {
      throw new ValidationError('A repeating task needs a date');
    }

    const today = todayKey(effectiveTz);
    const isOverdue = dateKey !== null && isOverdueLifecycleTask({ taskType: 'personal', scheduledDateKey: dateKey }, today);

    return prisma.task.create({
      data: {
        userId,
        title,
        topic: 'Personal',
        difficulty: null,
        platform: null,
        problemUrl: null,
        taskType: 'personal',
        status: isOverdue ? 'backlog' : 'pending',
        isBacklog: isOverdue,
        backlogSince: isOverdue ? new Date() : null,
        isExpired: false,
        recurrence,
        dueTime,
        durationMin,
        ...scheduleFields(dateKey, effectiveTz),
      },
    });
  },

  async update(
    userId: string,
    taskId: string,
    body: { title?: unknown; scheduledDateKey?: unknown; recurrence?: unknown; dueTime?: unknown; durationMin?: unknown },
    tz?: string
  ) {
    const effectiveTz = resolveTimeZone(tz);
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId, taskType: 'personal' },
    });
    if (!task) throw new NotFoundError('Personal task');

    const dateKey = parseDateKey(body.scheduledDateKey);
    const recurrence = parseRecurrence(body.recurrence);
    const dueTime = parseDueTime(body.dueTime);
    const durationMin = parseDurationMin(body.durationMin);

    // Compute the EFFECTIVE post-update values, not just the patch fields,
    // so an omitted scheduledDateKey on an already-Inbox task is still
    // caught when recurrence is being set in the same request.
    // Moving a task to Inbox (dateKey === null) clears recurrence unless
    // a new recurrence was explicitly provided.
    const effectiveDateKey = dateKey !== undefined ? dateKey : task.scheduledDateKey;
    const effectiveRecurrence =
      recurrence !== undefined ? recurrence : (dateKey === null ? null : task.recurrence);

    if (effectiveRecurrence && effectiveDateKey === null) {
      throw new ValidationError('A repeating task needs a date');
    }

    const isExplicitReschedule = dateKey !== undefined;

    let lifecyclePatch: {
      status?: string;
      isBacklog?: boolean;
      backlogSince?: Date | null;
      isExpired?: boolean;
    } = {};

    if (isExplicitReschedule && task.status !== 'completed') {
      const today = todayKey(effectiveTz);
      const isOverdue = dateKey !== null && isOverdueLifecycleTask({ taskType: 'personal', scheduledDateKey: dateKey }, today);

      if (isOverdue) {
        lifecyclePatch = {
          status: 'backlog',
          isBacklog: true,
          backlogSince: task.status === 'backlog' && task.scheduledDateKey === dateKey
            ? task.backlogSince ?? new Date()
            : new Date(),
          isExpired: false,
        };
      } else {
        lifecyclePatch = {
          status: 'pending',
          isBacklog: false,
          backlogSince: null,
          isExpired: false,
        };
      }
    }

    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: assertTitle(body.title) } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(dueTime !== undefined ? { dueTime } : {}),
        ...(durationMin !== undefined ? { durationMin } : {}),
        ...(isExplicitReschedule
          ? {
              ...scheduleFields(dateKey, effectiveTz),
              ...(dateKey === null ? { recurrence: null, dueTime: null, durationMin: null } : {}),
              ...lifecyclePatch,
            }
          : {}),
      },
    });
  },
};
