import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/error';

/** Ensure the task exists AND belongs to this user. */
async function assertTaskOwnership(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
  });
  if (!task) throw new NotFoundError('Task');
  return task;
}

export const notesController = {
  /** GET /api/tasks/:id/notes */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      await assertTaskOwnership(taskId, user.id);

      const notes = await prisma.note.findMany({
        where: { taskId, userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
      sendSuccess(res, notes);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/tasks/:id/notes */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      const { content } = req.body;

      if (typeof content !== 'string') {
        throw new ValidationError('content must be a string');
      }
      if (content.length > 20000) {
        throw new ValidationError('Notes must be under 20,000 characters');
      }

      await assertTaskOwnership(taskId, user.id);

      const note = await prisma.note.create({
        data: {
          taskId,
          userId: user.id,
          content,
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data: { notes: content },
      });

      sendCreated(res, note);
    } catch (err) {
      next(err);
    }
  },

  /** PUT /api/tasks/:id/notes (upsert) */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      const { content } = req.body;

      if (typeof content !== 'string') {
        throw new ValidationError('content must be a string');
      }
      if (content.length > 20000) {
        throw new ValidationError('Notes must be under 20,000 characters');
      }

      await assertTaskOwnership(taskId, user.id);

      const existing = await prisma.note.findFirst({
        where: { taskId, userId: user.id },
      });

      const note = existing
        ? await prisma.note.update({
            where: { id: existing.id },
            data: { content },
          })
        : await prisma.note.create({
            data: {
              taskId,
              userId: user.id,
              content,
            },
          });

      await prisma.task.update({
        where: { id: taskId },
        data: { notes: content },
      });

      sendSuccess(res, note);
    } catch (err) {
      next(err);
    }
  },
};
