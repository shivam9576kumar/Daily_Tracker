import prisma from '../../config/database';
import { taskRepository } from '../../repositories/taskRepository';
import { NotFoundError, ValidationError } from '../../utils/error';
import { REVISION_RULES, BACKLOG_EXPIRY_DAYS } from '@dsa-planner/shared';
import logger from '../../utils/logger';

type RatingKey = 'easy' | 'medium' | 'hard';

/**
 * Task completion service — handles the mark-done, rating, re-rate, and undo flows.
 * This is one of the most critical backend services.
 */
export const taskCompletionService = {
  /**
   * Mark a task as done and trigger rating flow.
   * For NEW tasks: requires a rating, generates revisions.
   * For REVISION tasks: just marks complete, no further revisions.
   */
  async completeTask(taskId: string, userId: string, rating?: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status === 'completed') {
      throw new ValidationError('Task is already completed');
    }

    const isNewTask = task.taskType === 'new';
    const isRevision = task.taskType === 'revision';

    // New tasks MUST have a rating
    if (isNewTask && !rating) {
      throw new ValidationError('Rating is required for new tasks');
    }

    // Revisions don't need rating
    const now = new Date();

    // Update task status
    await taskRepository.updateTask(taskId, {
      status: 'completed',
      completedAt: now,
      rating: isNewTask ? rating : task.rating,
      isBacklog: false,
      isExpired: false,
      originalSolveDate: isNewTask ? now : task.originalSolveDate,
    });

    // Generate revisions only for NEW tasks
    if (isNewTask && rating) {
      await this.generateRevisions(task.id, userId, rating as RatingKey, now);
    }

    // Update revision record if this is a revision task
    if (isRevision) {
      await prisma.revision.updateMany({
        where: { revisionTaskId: taskId, status: 'pending' },
        data: { status: 'completed', completedAt: now },
      });
    }

    logger.info(`Task completed: ${task.title} (${task.taskType}, rating: ${rating || 'n/a'})`);

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * Generate revision tasks based on rating.
   * Easy:   Day +14, +28
   * Medium: Day +1, +3, +7, +14
   * Hard:   Day +1, +3, +7, +14, +28
   */
  async generateRevisions(
    parentTaskId: string,
    userId: string,
    rating: RatingKey,
    completionDate: Date
  ) {
    const dayOffsets = REVISION_RULES[rating];
    if (!dayOffsets || dayOffsets.length === 0) return;

    const parentTask = await prisma.task.findUnique({
      where: { id: parentTaskId },
    });

    if (!parentTask) return;

    for (let i = 0; i < dayOffsets.length; i++) {
      const scheduledDate = new Date(completionDate);
      scheduledDate.setDate(scheduledDate.getDate() + dayOffsets[i]);

      // Create the revision task
      const revisionTask = await prisma.task.create({
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
          revisionNumber: i + 1,
          notes: parentTask.notes, // Inherit notes from parent
        },
      });

      // Create revision record for tracking
      await prisma.revision.create({
        data: {
          parentTaskId,
          revisionTaskId: revisionTask.id,
          revisionNumber: i + 1,
          scheduledDate,
          status: 'pending',
        },
      });
    }

    logger.info(
      `Generated ${dayOffsets.length} revisions for task: ${parentTask.title} (rating: ${rating})`
    );
  },

  /**
   * Re-rate a completed task.
   * 1. Delete all pending revisions
   * 2. Keep completed revisions
   * 3. Generate new revisions based on new rating
   */
  async rerateTask(taskId: string, userId: string, newRating: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status !== 'completed') {
      throw new ValidationError('Can only re-rate completed tasks');
    }

    if (task.taskType !== 'new') {
      throw new ValidationError('Can only re-rate new tasks (not revisions)');
    }

    // Delete pending revision tasks
    const deletedCount = await taskRepository.deletePendingRevisions(taskId);

    // Delete pending revision records
    await prisma.revision.deleteMany({
      where: { parentTaskId: taskId, status: 'pending' },
    });

    // Update task rating
    await taskRepository.updateTask(taskId, { rating: newRating });

    // Generate new revisions
    const completionDate = task.completedAt || new Date();
    await this.generateRevisions(taskId, userId, newRating as RatingKey, completionDate);

    logger.info(`Re-rated task: ${task.title} → ${newRating} (deleted ${deletedCount.count} pending revisions)`);

    return taskRepository.getTaskById(taskId, userId);
  },

  /**
   * Undo task completion.
   * 1. Revert status to pending
   * 2. Delete all pending revisions
   * 3. Preserve notes and completed revisions
   */
  async undoTask(taskId: string, userId: string) {
    const task = await taskRepository.getTaskById(taskId, userId);
    if (!task) throw new NotFoundError('Task');

    if (task.status !== 'completed') {
      throw new ValidationError('Can only undo completed tasks');
    }

    // Delete pending revision tasks
    await taskRepository.deletePendingRevisions(taskId);

    // Delete pending revision records
    await prisma.revision.deleteMany({
      where: { parentTaskId: taskId, status: 'pending' },
    });

    // Revert task to pending
    await taskRepository.updateTask(taskId, {
      status: 'pending',
      completedAt: null,
      rating: null,
    });

    logger.info(`Undid completion: ${task.title}`);

    return taskRepository.getTaskById(taskId, userId);
  },
};
