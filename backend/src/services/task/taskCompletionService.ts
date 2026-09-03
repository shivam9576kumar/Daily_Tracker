import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import { REVISION_RULES } from '@dsa-planner/shared';
import { calculateCoins } from '../../config/rewards';
import logger from '../../utils/logger';

type RatingKey = 'easy' | 'medium' | 'hard';
const VALID_RATINGS: RatingKey[] = ['easy', 'medium', 'hard'];

/* ───────────────────────── helpers ───────────────────────── */

function validateRating(rating: unknown): RatingKey {
  if (!VALID_RATINGS.includes(rating as RatingKey)) {
    throw new ValidationError(`Invalid rating. Must be one of: ${VALID_RATINGS.join(', ')}`);
  }
  return rating as RatingKey;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDaysAtStartOfDay(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 'YYYY-MM-DD' from LOCAL parts — the same grouping the Roadmap uses. */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isFutureDay(scheduledDate: Date): boolean {
  return startOfDay(new Date(scheduledDate)).getTime() > startOfDay(new Date()).getTime();
}

function fmtDay(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Where a task goes when it is un-solved.
 * If its scheduled day already passed it goes straight to BACKLOG, so it is visible on
 * today's hitlist immediately instead of disappearing until the midnight cron.
 */
function revertedStatusFields(scheduledDate: Date) {
  const isPast = startOfDay(new Date(scheduledDate)).getTime() < startOfDay(new Date()).getTime();
  return isPast
    ? { status: 'backlog', isBacklog: true, backlogSince: new Date(), isExpired: false }
    : { status: 'pending', isBacklog: false, backlogSince: null, isExpired: false };
}

/* ───────────────────── transactional helpers ───────────────────── */

async function adjustCoinsTx(tx: Prisma.TransactionClient, userId: string, amount: number) {
  if (amount === 0) return;
  if (amount > 0) {
    await tx.user.update({ where: { id: userId }, data: { coins: { increment: amount } } });
    return;
  }
  const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
  await tx.user.update({ where: { id: userId }, data: { coins: Math.max(0, (user?.coins ?? 0) + amount) } });
}

/**
 * Delete every UNFINISHED revision (pending/backlog) of a parent — the revision tasks AND
 * their revision records. Completed revisions are always preserved.
 */
async function deleteUnfinishedRevisionsTx(tx: Prisma.TransactionClient, parentTaskId: string) {
  const unfinished = await tx.task.findMany({
    where: { parentTaskId, taskType: 'revision', status: { not: 'completed' } },
    select: { id: true },
  });
  const ids = unfinished.map((t) => t.id);
  if (ids.length) await tx.task.deleteMany({ where: { id: { in: ids } } });
  const records = await tx.revision.deleteMany({ where: { parentTaskId, status: { not: 'completed' } } });
  return { deletedRevisionTasks: ids.length, deletedRevisionRecords: records.count };
}

/**
 * Create revision tasks + records for a rating.
 *  - offsets from REVISION_RULES[rating], counted from `anchorDate`
 *  - never two unfinished revisions on the same calendar day
 *  - numbering continues after any completed revisions that were kept
 */
async function createRevisionGraphTx(
  tx: Prisma.TransactionClient,
  p: { parentTaskId: string; userId: string; rating: RatingKey; anchorDate: Date }
) {
  const parent = await tx.task.findUnique({ where: { id: p.parentTaskId } });
  if (!parent) throw new NotFoundError('Parent task');
  if (parent.taskType !== 'new') throw new ValidationError('Only new problems can have revisions');

  const offsets = (REVISION_RULES[p.rating] ?? []) as readonly number[];
  if (offsets.length === 0) return { created: 0 };

  const existing = await tx.revision.findMany({
    where: { parentTaskId: p.parentTaskId },
    select: { scheduledDate: true, revisionNumber: true },
  });
  const takenDays = new Set(existing.map((r) => localDateKey(r.scheduledDate)));
  let nextNumber = existing.length ? Math.max(...existing.map((r) => r.revisionNumber)) + 1 : 1;

  let created = 0;
  for (const offset of offsets) {
    const scheduledDate = addDaysAtStartOfDay(p.anchorDate, offset);
    const key = localDateKey(scheduledDate);
    if (takenDays.has(key)) continue;

    const revisionNumber = nextNumber++;
    const revTask = await tx.task.create({
      data: {
        userId: p.userId,
        planId: parent.planId,
        parentTaskId: parent.id,
        title: parent.title,
        topic: parent.topic,
        difficulty: parent.difficulty,
        platform: parent.platform,
        problemUrl: parent.problemUrl,
        taskType: 'revision',
        status: 'pending',
        scheduledDate,
        originalSolveDate: parent.completedAt ?? p.anchorDate,
        revisionNumber,
        notes: parent.notes,
      },
    });
    await tx.revision.create({
      data: { parentTaskId: parent.id, revisionTaskId: revTask.id, revisionNumber, scheduledDate, status: 'pending' },
    });
    takenDays.add(key);
    created++;
  }
  return { created };
}

/* ───────────────────────── the service ───────────────────────── */

export const taskCompletionService = {
  /**
   * SOLVE.
   * Rating is OPTIONAL for new problems (rate later with rateTask) and FORBIDDEN for revisions.
   * Coins are awarded by the task's own difficulty, never by rating.
   */
  async completeTask(taskId: string, userId: string, rating?: string | null) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');
    if (task.status === 'completed') throw new ValidationError('Task is already marked as solved');

    const isNew = task.taskType === 'new';
    const isRevision = task.taskType === 'revision';

    let validRating: RatingKey | undefined;
    if (rating !== undefined && rating !== null && rating !== '') {
      if (!isNew) throw new ValidationError('Only new problems can be rated');
      validRating = validateRating(rating);
    }

    // Future lock: a task can only be solved on/after its scheduled day (backlog is past by definition)
    const isOpenBacklog = task.isBacklog || task.status === 'backlog';
    if (!isOpenBacklog && isFutureDay(task.scheduledDate)) {
      throw new ValidationError(`This task is scheduled for ${fmtDay(task.scheduledDate)}. It unlocks on that day.`);
    }

    const now = new Date();
    const coins = calculateCoins(task.taskType, task.difficulty);

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          completedAt: now,
          isBacklog: false,
          backlogSince: null,
          isExpired: false,
          ...(isNew ? { originalSolveDate: now, rating: validRating ?? null } : {}),
        },
      });

      if (isNew && validRating) {
        await deleteUnfinishedRevisionsTx(tx, taskId);
        const r = await createRevisionGraphTx(tx, { parentTaskId: taskId, userId, rating: validRating, anchorDate: now });
        logger.info(`🔁 ${r.created} revisions for "${task.title}" (${validRating})`);
      }

      if (isRevision) {
        await tx.revision.updateMany({
          where: { revisionTaskId: taskId, status: { not: 'completed' } },
          data: { status: 'completed', completedAt: now },
        });
      }

      await adjustCoinsTx(tx, userId, coins);
    });

    logger.info(`✅ Solved "${task.title}" (${task.taskType}/${task.difficulty ?? '-'}, +${coins} coins${validRating ? `, rated ${validRating}` : ''})`);
    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * RATE / RE-RATE a solved problem. Works for the first rating and for switching.
   *  - unfinished revisions are replaced; completed ones are kept
   *  - anchored on the LATER of solve time and now → no revision is ever created in the past
   *  - coins are NOT touched
   */
  async rateTask(taskId: string, userId: string, rating: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');
    if (task.taskType !== 'new') throw new ValidationError('Only new problems can be rated');
    if (task.status !== 'completed') throw new ValidationError('Mark the problem as solved before rating it');

    const validRating = validateRating(rating);
    if (task.rating === validRating) return task; // idempotent

    const solvedAt = task.completedAt ?? new Date();
    const anchorDate = new Date(Math.max(solvedAt.getTime(), Date.now()));

    await prisma.$transaction(async (tx) => {
      const removed = await deleteUnfinishedRevisionsTx(tx, taskId);
      await tx.task.update({ where: { id: taskId }, data: { rating: validRating } });
      const created = await createRevisionGraphTx(tx, { parentTaskId: taskId, userId, rating: validRating, anchorDate });
      logger.info(`⭐ "${task.title}" rated ${validRating} (was ${task.rating ?? 'unrated'}): -${removed.deletedRevisionTasks} +${created.created} revisions`);
    });

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * UNRATE — remove the revision plan but KEEP the solve.
   * rating → null, unfinished revisions deleted, completed revisions kept.
   * Task stays completed: streak, heatmap, total and coins are unchanged.
   */
  async unrateTask(taskId: string, userId: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');
    if (task.taskType !== 'new') throw new ValidationError('Only new problems have a rating');
    if (task.status !== 'completed') throw new ValidationError('Task is not marked as solved');

    await prisma.$transaction(async (tx) => {
      const removed = await deleteUnfinishedRevisionsTx(tx, taskId);
      await tx.task.update({ where: { id: taskId }, data: { rating: null } });
      logger.info(`☆ "${task.title}" unrated (was ${task.rating ?? 'unrated'}): -${removed.deletedRevisionTasks} revisions`);
    });

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * UNSOLVE (undo) — one step from any state, rated or not.
   *  new task:      unfinished revisions deleted (completed kept), rating/completedAt cleared, coins refunded
   *  revision task: its revision record reopened, coins refunded
   *  either:        → pending, or → backlog if its scheduled day already passed
   */
  async undoTask(taskId: string, userId: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');
    if (task.status !== 'completed') throw new ValidationError('Task is not marked as solved');

    const coins = calculateCoins(task.taskType, task.difficulty);
    const revert = revertedStatusFields(task.scheduledDate);
    let removed = { deletedRevisionTasks: 0, deletedRevisionRecords: 0 };

    await prisma.$transaction(async (tx) => {
      if (task.taskType === 'new') {
        removed = await deleteUnfinishedRevisionsTx(tx, taskId);
        await tx.task.update({
          where: { id: taskId },
          data: { ...revert, completedAt: null, rating: null, originalSolveDate: null },
        });
      } else if (task.taskType === 'revision') {
        await tx.revision.updateMany({
          where: { revisionTaskId: taskId },
          data: { status: 'pending', completedAt: null },
        });
        await tx.task.update({ where: { id: taskId }, data: { ...revert, completedAt: null } });
      } else {
        await tx.task.update({ where: { id: taskId }, data: { ...revert, completedAt: null } });
      }
      await adjustCoinsTx(tx, userId, -coins);
    });

    logger.info(`↩️ Unsolved "${task.title}" → ${revert.status} (-${coins} coins, -${removed.deletedRevisionTasks} revisions)`);
    return taskRepository.getTaskById(taskId, userId);
  },
};
