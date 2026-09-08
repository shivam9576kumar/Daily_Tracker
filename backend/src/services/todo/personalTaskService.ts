import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';
import { RECURRENCE_VALUES, type Recurrence } from '../../utils/dateKeys';

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

function scheduleFields(dateKey: string | null) {
  return dateKey === null
    ? { scheduledDate: null, scheduledDateKey: null }
    : { scheduledDate: new Date(`${dateKey}T00:00:00.000Z`), scheduledDateKey: dateKey };
}

export const personalTaskService = {
  async create(userId: string, body: {
    title?: unknown; scheduledDateKey?: unknown; recurrence?: unknown; dueTime?: unknown;
  }) {
    const title = assertTitle(body.title);
    let dateKey = parseDateKey(body.scheduledDateKey) ?? null;
    const recurrence = parseRecurrence(body.recurrence) ?? null;
    const dueTime = parseDueTime(body.dueTime) ?? null;

    if (recurrence && dateKey === null) {
      throw new ValidationError('A repeating task needs a date');
    }

    return prisma.task.create({
      data: {
        userId,
        title,
        topic: 'Personal',
        difficulty: null,
        platform: null,
        problemUrl: null,
        taskType: 'personal',
        status: 'pending',
        recurrence,
        dueTime,
        ...scheduleFields(dateKey),
      },
    });
  },

  async update(
    userId: string,
    taskId: string,
    body: { title?: unknown; scheduledDateKey?: unknown; recurrence?: unknown; dueTime?: unknown },
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId, taskType: 'personal' },
    });
    if (!task) throw new NotFoundError('Personal task');

    const dateKey = parseDateKey(body.scheduledDateKey);
    const recurrence = parseRecurrence(body.recurrence);
    const dueTime = parseDueTime(body.dueTime);

    if (recurrence && dateKey === null && task.scheduledDateKey === null && dateKey !== undefined) {
      throw new ValidationError('A repeating task needs a date');
    }

    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: assertTitle(body.title) } : {}),
        ...(recurrence !== undefined ? { recurrence } : {}),
        ...(dueTime !== undefined ? { dueTime } : {}),
        ...(dateKey !== undefined
          ? {
              ...scheduleFields(dateKey),
              ...(dateKey === null ? { recurrence: null } : {}),   // no-date ⇒ no repeat
              isBacklog: false,
              backlogSince: null,
              ...(task.status === 'backlog' ? { status: 'pending' } : {}),
            }
          : {}),
      },
    });
  },
};
