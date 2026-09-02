import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import { REVISION_RULES } from '@dsa-planner/shared';
import { calculateCoins } from '../../config/rewards';
import logger from '../../utils/logger';

type RatingKey = 'easy' | 'medium' | 'hard';

const VALID_RATINGS: RatingKey[] = ['easy', 'medium', 'hard'];

function validateRating(rating: string): RatingKey {
  if (!VALID_RATINGS.includes(rating as RatingKey)) {
    throw new ValidationError(
      `Invalid rating. Must be one of: ${VALID_RATINGS.join(', ')}`
    );
  }

  return rating as RatingKey;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isFutureDate(scheduledDate: Date): boolean {
  const today = startOfDay(new Date());
  const scheduled = startOfDay(new Date(scheduledDate));
  return scheduled.getTime() > today.getTime();
}

function dateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function addDaysAtStartOfDay(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function adjustCoinsTx(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number
) {
  if (amount === 0) return;

  if (amount > 0) {
    await tx.user.update({
      where: { id: userId },
      data: {
        coins: {
          increment: amount,
        },
      },
    });
    return;
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  const nextCoins = Math.max(0, (user?.coins || 0) + amount);

  await tx.user.update({
    where: { id: userId },
    data: {
      coins: nextCoins,
    },
  });
}

/**
 * Delete all unfinished revision tasks and revision records for a parent.
 *
 * Completed revisions are intentionally preserved.
 */
async function deleteUnfinishedRevisionsTx(
  tx: Prisma.TransactionClient,
  parentTaskId: string
) {
  const revisionTasks = await tx.task.findMany({
    where: {
      parentTaskId,
      taskType: 'revision',
      status: {
        not: 'completed',
      },
    },
    select: {
      id: true,
    },
  });

  const ids = revisionTasks.map((t) => t.id);

  if (ids.length > 0) {
    await tx.task.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  const deletedRecords = await tx.revision.deleteMany({
    where: {
      parentTaskId,
      status: {
        not: 'completed',
      },
    },
  });

  return {
    deletedRevisionTasks: ids.length,
    deletedRevisionRecords: deletedRecords.count,
  };
}

/**
 * Create revision tasks and revision records safely.
 *
 * It prevents duplicate unfinished revisions for the same scheduled date.
 */
async function createRevisionGraphTx(
  tx: Prisma.TransactionClient,
  params: {
    parentTaskId: string;
    userId: string;
    rating: RatingKey;
    completionDate: Date;
  }
) {
  const { parentTaskId, userId, rating, completionDate } = params;

  const parentTask = await tx.task.findUnique({
    where: { id: parentTaskId },
  });

  if (!parentTask) {
    throw new NotFoundError('Parent task');
  }

  if (parentTask.taskType !== 'new') {
    throw new ValidationError('Only new tasks can generate revisions');
  }

  const dayOffsets = REVISION_RULES[rating];

  if (!dayOffsets) {
    return {
      created: 0,
    };
  }

  const existingRevisions = await tx.revision.findMany({
    where: {
      parentTaskId,
    },
    select: {
      scheduledDate: true,
      revisionNumber: true,
    },
  });

  const existingDateKeys = new Set(
    existingRevisions.map((r) => dateKey(r.scheduledDate))
  );

  let nextRevisionNumber =
    existingRevisions.length === 0
      ? 1
      : Math.max(...existingRevisions.map((r) => r.revisionNumber)) + 1;

  let created = 0;

  for (const offset of dayOffsets) {
    const scheduledDate = addDaysAtStartOfDay(completionDate, offset);
    const key = dateKey(scheduledDate);

    if (existingDateKeys.has(key)) {
      logger.info(
        `Skipping duplicate revision for ${parentTask.title} on ${key}`
      );
      continue;
    }

    const revisionNumber = nextRevisionNumber++;

    const revisionTask = await tx.task.create({
      data: {
        userId,
        planId: parentTask.planId,
        parentTaskId,
        title: parentTask.title,
        topic: parentTask.topic,
        difficulty: parentTask.difficulty,
        platform: parentTask.platform,
        problemUrl: parentTask.problemUrl,
        taskType: 'revision',
        status: 'pending',
        scheduledDate,
        originalSolveDate: completionDate,
        revisionNumber,
        notes: parentTask.notes,
      },
    });

    await tx.revision.create({
      data: {
        parentTaskId,
        revisionTaskId: revisionTask.id,
        revisionNumber,
        scheduledDate,
        status: 'pending',
      },
    });

    existingDateKeys.add(key);
    created++;
  }

  return {
    created,
  };
}

export const taskCompletionService = {
  /**
   * Complete a task.
   *
   * New task:
   * - requires rating
   * - generates revisions
   * - awards coins based on rating
   *
   * Revision task:
   * - must NOT receive rating
   * - updates matching revision record
   * - awards fixed revision coins
   */
  async completeTask(taskId: string, userId: string, rating?: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status === 'completed') {
      throw new ValidationError('Task is already completed');
    }

    // ─── FUTURE LOCK RULE ───
    const taskIsBacklog = task.isBacklog || task.status === 'backlog';
    const taskIsExpired = task.isExpired || task.status === 'expired';

    if (!taskIsBacklog && !taskIsExpired && isFutureDate(task.scheduledDate)) {
      throw new ValidationError(
        `Cannot complete this task yet. It is scheduled for ${new Date(
          task.scheduledDate
        ).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}. It will appear in your dashboard on that day.`
      );
    }

    const isNewTask = task.taskType === 'new';
    const isRevisionTask = task.taskType === 'revision';

    let validRating: RatingKey | undefined;

    if (isNewTask) {
      if (!rating) {
        throw new ValidationError('Rating is required for new tasks');
      }

      validRating = validateRating(rating);
    }

    if (isRevisionTask && rating) {
      throw new ValidationError('Revision tasks cannot be rated');
    }

    const now = new Date();
    const coins = calculateCoins(task.taskType, validRating ?? task.rating);

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          completedAt: now,
          rating: isNewTask ? validRating : task.rating,
          isBacklog: false,
          backlogSince: null,
          isExpired: false,
          originalSolveDate: isNewTask ? now : task.originalSolveDate,
        },
      });

      if (isNewTask && validRating) {
        const deleted = await deleteUnfinishedRevisionsTx(tx, task.id);

        if (
          deleted.deletedRevisionTasks > 0 ||
          deleted.deletedRevisionRecords > 0
        ) {
          logger.info(
            `Cleaned old unfinished revisions for "${task.title}": ${JSON.stringify(
              deleted
            )}`
          );
        }

        const result = await createRevisionGraphTx(tx, {
          parentTaskId: task.id,
          userId,
          rating: validRating,
          completionDate: now,
        });

        logger.info(
          `Generated ${result.created} revisions for "${task.title}" (${validRating})`
        );
      }

      if (isRevisionTask) {
        await tx.revision.updateMany({
          where: {
            revisionTaskId: taskId,
            status: {
              not: 'completed',
            },
          },
          data: {
            status: 'completed',
            completedAt: now,
          },
        });
      }

      await adjustCoinsTx(tx, userId, coins);
    });

    logger.info(
      `✅ Completed "${task.title}" (${task.taskType}, +${coins} coins)`
    );

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * Public helper for manual regeneration if ever needed internally.
   */
  async generateRevisions(
    parentTaskId: string,
    userId: string,
    rating: RatingKey,
    completionDate: Date
  ) {
    return prisma.$transaction(async (tx) => {
      await deleteUnfinishedRevisionsTx(tx, parentTaskId);

      return createRevisionGraphTx(tx, {
        parentTaskId,
        userId,
        rating,
        completionDate,
      });
    });
  },

  /**
   * Re-rate a completed new task.
   *
   * Rules:
   * - only new tasks can be re-rated
   * - completed revisions are preserved
   * - unfinished revisions are deleted and regenerated
   * - coin difference is adjusted
   */
  async rerateTask(taskId: string, userId: string, newRating: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status !== 'completed') {
      throw new ValidationError('Can only re-rate completed tasks');
    }

    if (task.taskType !== 'new') {
      throw new ValidationError('Revision tasks cannot be re-rated');
    }

    const validRating = validateRating(newRating);

    const oldCoins = task.rating ? calculateCoins('new', task.rating) : 0;
    const newCoins = calculateCoins('new', validRating);
    const coinDelta = newCoins - oldCoins;

    const completionDate = task.completedAt || new Date();

    await prisma.$transaction(async (tx) => {
      const deleted = await deleteUnfinishedRevisionsTx(tx, taskId);

      logger.info(
        `Re-rate cleanup for "${task.title}": ${JSON.stringify(deleted)}`
      );

      await tx.task.update({
        where: { id: taskId },
        data: {
          rating: validRating,
        },
      });

      const created = await createRevisionGraphTx(tx, {
        parentTaskId: taskId,
        userId,
        rating: validRating,
        completionDate,
      });

      await adjustCoinsTx(tx, userId, coinDelta);

      logger.info(
        `Re-rated "${task.title}" → ${validRating}, created ${created.created} revisions, coin delta ${coinDelta}`
      );
    });

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * Undo completion.
   *
   * New parent task:
   * - delete unfinished revisions
   * - preserve completed revisions
   * - refund coins
   *
   * Revision task:
   * - reopen its revision record
   * - refund revision coins
   */
  async undoTask(taskId: string, userId: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status !== 'completed') {
      throw new ValidationError('Can only undo completed tasks');
    }

    const coins = calculateCoins(task.taskType, task.rating);

    await prisma.$transaction(async (tx) => {
      if (task.taskType === 'new') {
        const deleted = await deleteUnfinishedRevisionsTx(tx, taskId);

        logger.info(
          `Undo cleanup for "${task.title}": ${JSON.stringify(deleted)}`
        );

        await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'pending',
            completedAt: null,
            rating: null,
            originalSolveDate: null,
            isBacklog: false,
            backlogSince: null,
            isExpired: false,
          },
        });
      } else if (task.taskType === 'revision') {
        await tx.revision.updateMany({
          where: {
            revisionTaskId: taskId,
          },
          data: {
            status: 'pending',
            completedAt: null,
          },
        });

        await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'pending',
            completedAt: null,
            isBacklog: false,
            backlogSince: null,
            isExpired: false,
          },
        });
      }

      await adjustCoinsTx(tx, userId, -coins);
    });

    logger.info(`↩️ Undid "${task.title}" (-${coins} coins)`);

    return taskRepository.getTaskById(taskId, userId);
  },
};
