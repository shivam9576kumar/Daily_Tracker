import { randomUUID } from 'node:crypto';
import { Prisma, type Task } from '@prisma/client';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { dateKeyInTz } from '../../utils/dateKeys';
import { NotFoundError, ValidationError } from '../../utils/error';
import { invalidateUserCache } from '../../middleware/authMiddleware';
import { resolvePlatformValue } from '../../utils/platform';

export type Rating = 'easy' | 'medium' | 'hard';

const RATINGS = ['easy', 'medium', 'hard'] as const;
const RATING_BONUS: Record<Rating, number> = { easy: 0, medium: 5, hard: 10 };
const BASE_SOLVE_COINS = 10;

const REVISION_INTERVALS: Record<Rating, readonly number[]> = {
  easy:   [14, 28],
  medium: [1, 3, 7, 14],
  hard:   [1, 3, 7, 14, 28],
};

/** Tokyo RTTs are huge; default Prisma tx timeout (5s) is far too low. */
const TX_OPTIONS = { maxWait: 15_000, timeout: 60_000 } as const;

function parseRating(value: unknown): Rating {
  if (typeof value === 'string' && (RATINGS as readonly string[]).includes(value as Rating)) return value as Rating;
  throw new ValidationError(`rating must be one of: ${RATINGS.join(', ')}`);
}

function bonusFor(rating: string | null | undefined): number {
  return rating && rating in RATING_BONUS ? RATING_BONUS[rating as Rating] : 0;
}

/**
 * Given a timestamp instant `anchor` and user timezone `tz`,
 * resolve the calendar date key 'YYYY-MM-DD' on the user's wall clock,
 * and return UTC midnight of that calendar day.
 */
function solvedDateMidnightUtc(anchor: Date, tz: string = env.DEFAULT_TIMEZONE): Date {
  const dateKey = dateKeyInTz(anchor, tz);
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

type ParentTask = Pick<Task, 'id' | 'planId' | 'title' | 'topic' | 'difficulty' | 'platform' | 'problemUrl'>;

/**
 * Replace this task's pending/backlog revisions with a fresh rating-based set.
 * Idempotent: re-rating never duplicates.
 * Anchor is strictly the calendar date x of the solved-on day in the user's timezone.
 */
async function regenerateRevisions(
  tx: Prisma.TransactionClient,
  userId: string,
  parent: ParentTask,
  anchor: Date,
  rating: Rating,
  tz: string = env.DEFAULT_TIMEZONE,
): Promise<void> {
  await tx.revision.deleteMany({ where: { parentTaskId: parent.id, status: { in: ['pending', 'backlog'] } } });
  await tx.task.deleteMany({ where: { parentTaskId: parent.id, status: { in: ['pending', 'backlog'] } } });

  const intervals = REVISION_INTERVALS[rating];
  const base = solvedDateMidnightUtc(anchor, tz);
  const ids = intervals.map(() => randomUUID());

  await tx.task.createMany({
    data: intervals.map((days, i) => ({
      id: ids[i],
      userId,
      planId: parent.planId,
      parentTaskId: parent.id,
      title: parent.title,
      topic: parent.topic,
      difficulty: parent.difficulty,
      platform: resolvePlatformValue(parent.problemUrl, parent.platform),
      problemUrl: parent.problemUrl,
      taskType: 'revision',
      status: 'pending',
      scheduledDate: addUtcDays(base, days),
      revisionNumber: i + 1,
    })),
  });

  await tx.revision.createMany({
    data: intervals.map((days, i) => ({
      parentTaskId: parent.id,
      revisionTaskId: ids[i],
      revisionNumber: i + 1,
      scheduledDate: addUtcDays(base, days),
      status: 'pending',
    })),
  });
}

export const taskCompletionService = {
  /**
   * Solve (and optionally rate) a task. Serves POST /complete (rating optional) and POST /rate (rating required).
   *  - first solve  → +10 coins
   *  - rating given → bonus delta (new − previous), revisions regenerated (never duplicated)
   *  - anchor is the solved-on calendar day x in the user's timezone.
   */
  async completeTask(userId: string, taskId: string, ratingInput?: unknown, tz: string = env.DEFAULT_TIMEZONE) {
    const rating = ratingInput === undefined || ratingInput === null || ratingInput === '' ? undefined : parseRating(ratingInput);

    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundError('Task');
    // DECISION: revision tasks are marked done, never rated (rating one would spawn revisions of revisions).
    if (rating && task.taskType === 'revision') throw new ValidationError('Revision tasks are marked done, not rated');

    const now = new Date();
    const isFirstSolve = task.status !== 'completed';
    const nextRating: Rating | null = rating ?? (task.rating as Rating | null) ?? null;
    const coinDelta = (isFirstSolve ? BASE_SOLVE_COINS : 0) + (rating ? bonusFor(rating) - bonusFor(task.rating) : 0);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          rating: nextRating,
          completedAt: isFirstSolve ? now : (task.completedAt ?? now),   // re-rating must not move "completed today"
          originalSolveDate: task.originalSolveDate ?? now,
          isBacklog: false,
          backlogSince: null,
          isExpired: false,
        },
      });

      if (task.taskType === 'revision') {
        await tx.revision.updateMany({
          where: { revisionTaskId: taskId, status: { not: 'completed' } },
          data: { status: 'completed', completedAt: now },
        });
      }

      if (isFirstSolve || coinDelta !== 0) {
        if (coinDelta > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { coins: { increment: coinDelta } },
          });
        } else if (coinDelta < 0) {
          const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
          await tx.user.update({
            where: { id: userId },
            data: { coins: Math.max(0, (user?.coins ?? 0) + coinDelta) },
          });
        }
      }

      if (rating) {
        // DECISION: anchor revisions on the SOLVE date, not the plan's scheduledDate, so a backlog task
        // solved late never gets revisions in the past.
        const solvedOn = updated.originalSolveDate ?? updated.completedAt ?? now;
        await regenerateRevisions(tx, userId, updated, solvedOn, rating, tz);
      }

      return updated;
    }, TX_OPTIONS);
    invalidateUserCache(userId);
    return result;
  },

  /**
   * Un-rate: remove the revision plan, KEEP the solve.
   *  - rating cleared (null)
   *  - pending/backlog child revisions deleted
   *  - status stays 'completed', completedAt unchanged
   *  - bonus coins refunded (base solve coins kept)
   */
  async unrateTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundError('Task');

    const bonusRefund = bonusFor(task.rating);

    const result = await prisma.$transaction(async (tx) => {
      await tx.revision.deleteMany({ where: { parentTaskId: taskId, status: { in: ['pending', 'backlog'] } } });
      await tx.task.deleteMany({ where: { parentTaskId: taskId, status: { in: ['pending', 'backlog'] } } });

      const updated = await tx.task.update({
        where: { id: taskId },
        data: { rating: null },
      });

      if (bonusRefund > 0) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
        if (user) {
          await tx.user.update({
            where: { id: userId },
            data: { coins: Math.max(0, user.coins - bonusRefund) },
          });
        }
      }
      return updated;
    }, TX_OPTIONS);
    invalidateUserCache(userId);
    return result;
  },

  /**
   * Undo solve: full revert to pending.
   *  - status reverted to 'pending'
   *  - rating and completedAt cleared
   *  - pending/backlog child revisions deleted
   *  - base + bonus coins refunded
   */
  async undoTask(userId: string, taskId: string) {
    const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundError('Task');

    const wasCompleted = task.status === 'completed';
    const refund = wasCompleted ? BASE_SOLVE_COINS + bonusFor(task.rating) : 0;

    const result = await prisma.$transaction(async (tx) => {
      await tx.revision.deleteMany({ where: { parentTaskId: taskId, status: { in: ['pending', 'backlog'] } } });
      await tx.task.deleteMany({ where: { parentTaskId: taskId, status: { in: ['pending', 'backlog'] } } });

      if (task.taskType === 'revision') {
        await tx.revision.updateMany({
          where: { revisionTaskId: taskId },
          data: { status: 'pending', completedAt: null },
        });
      }

      const updated = await tx.task.update({
        where: { id: taskId },
        data: { status: 'pending', rating: null, completedAt: null, isBacklog: false },
      });

      if (wasCompleted && refund > 0) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
        if (user) {
          await tx.user.update({
            where: { id: userId },
            data: { coins: Math.max(0, user.coins - refund) },
          });
        }
      }
      return updated;
    }, TX_OPTIONS);
    invalidateUserCache(userId);
    return result;
  },

  /** Backward-compatible helper aliases */
  async rateTask(taskId: string, userId: string, rating: string, tz: string = env.DEFAULT_TIMEZONE) {
    return this.completeTask(userId, taskId, rating, tz);
  },
};
