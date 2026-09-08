import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../utils/error';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function scheduleFields(dateKey: string | null) {
  return dateKey === null
    ? { scheduledDate: null, scheduledDateKey: null }
    : { scheduledDate: new Date(`${dateKey}T00:00:00.000Z`), scheduledDateKey: dateKey };
}

export const personalTaskService = {
  async create(userId: string, body: { title?: unknown; scheduledDateKey?: unknown }) {
    const title = assertTitle(body.title);
    const dateKey = parseDateKey(body.scheduledDateKey) ?? null; // default: Inbox

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
        ...scheduleFields(dateKey),
      },
    });
  },

  async update(
    userId: string,
    taskId: string,
    body: { title?: unknown; scheduledDateKey?: unknown },
  ) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId, taskType: 'personal' },
    });
    if (!task) throw new NotFoundError('Personal task');

    const dateKey = parseDateKey(body.scheduledDateKey);

    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: assertTitle(body.title) } : {}),
        ...(dateKey !== undefined
          ? {
              ...scheduleFields(dateKey),
              // scheduling/unscheduling resets backlog state
              isBacklog: false,
              backlogSince: null,
              ...(task.status === 'backlog' ? { status: 'pending' } : {}),
            }
          : {}),
      },
    });
  },
};
