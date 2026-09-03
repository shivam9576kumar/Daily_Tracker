import prisma from '../../config/database';
import { ValidationError } from '../../utils/error';
import { assertDayOfWeek, assertHHMM, parseHHMM } from '../../utils/timeOfDay';

export interface ClassInput {
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  location?: string | null;
}

function normalizeAndValidate(c: ClassInput): ClassInput {
  const dayOfWeek = assertDayOfWeek(c.dayOfWeek);
  const startTime = assertHHMM(c.startTime, 'startTime');
  const endTime = assertHHMM(c.endTime, 'endTime');

  if (parseHHMM(endTime)! <= parseHHMM(startTime)!) {
    throw new ValidationError(
      `endTime must be after startTime (${startTime}–${endTime})`
    );
  }

  const subject = String(c.subject ?? '').trim();
  if (!subject) throw new ValidationError('subject is required');
  if (subject.length > 120) throw new ValidationError('subject must be ≤ 120 characters');

  const location = c.location ? String(c.location).trim().slice(0, 120) : null;
  return { dayOfWeek, subject, startTime, endTime, location };
}

/** Reject overlaps on the same day. Names both classes in the error. */
function assertNoOverlaps(classes: ClassInput[]) {
  const byDay = new Map<number, ClassInput[]>();
  for (const c of classes) {
    const arr = byDay.get(c.dayOfWeek) ?? [];
    arr.push(c);
    byDay.set(c.dayOfWeek, arr);
  }

  for (const [, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.startTime < prev.endTime) {
        throw new ValidationError(
          `Overlapping classes on the same day: "${prev.subject}" (${prev.startTime}–${prev.endTime}) and "${cur.subject}" (${cur.startTime}–${cur.endTime})`
        );
      }
    }
  }
}

export const classesService = {
  /** Returns ALL classes for the user. Browser filters "today". */
  async list(userId: string) {
    return prisma.classSchedule.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  },

  /**
   * Full replace. If `classes` is empty, wipes the user's timetable.
   * Runs inside a transaction so a validation failure never leaves half-saved state.
   */
  async replaceAll(userId: string, raw: ClassInput[]) {
    if (!Array.isArray(raw)) throw new ValidationError('classes must be an array');
    if (raw.length > 100) throw new ValidationError('Maximum 100 classes');

    const validated = raw.map(normalizeAndValidate);
    assertNoOverlaps(validated);

    return prisma.$transaction(async (tx) => {
      await tx.classSchedule.deleteMany({ where: { userId } });
      if (validated.length === 0) return [];
      await tx.classSchedule.createMany({
        data: validated.map((c) => ({ ...c, userId })),
      });
      return tx.classSchedule.findMany({
        where: { userId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  },

  async clear(userId: string) {
    await prisma.classSchedule.deleteMany({ where: { userId } });
    return { ok: true };
  },
};
