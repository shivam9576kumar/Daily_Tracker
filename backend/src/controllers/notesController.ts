import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated } from '../utils/response';
import { NotFoundError } from '../utils/error';

export const notesController = {
  /** GET /api/tasks/:id/notes */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      const notes = await prisma.note.findMany({
        where: { taskId, userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
      sendSuccess(res, notes);
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/notes */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      const { content } = req.body;

      // Check task ownership
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId: user.id },
      });
      if (!task) throw new NotFoundError('Task');

      const note = await prisma.note.create({
        data: {
          taskId,
          userId: user.id,
          content,
        },
      });

      // Also update the task's inline notes field
      await prisma.task.update({
        where: { id: taskId },
        data: { notes: content },
      });

      sendCreated(res, note);
    } catch (err) { next(err); }
  },

  /** PUT /api/tasks/:id/notes */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const taskId = req.params.id as string;
      const { content } = req.body;

      // Upsert: find existing note or create new
      const existing = await prisma.note.findFirst({
        where: { taskId, userId: user.id },
      });

      let note;
      if (existing) {
        note = await prisma.note.update({
          where: { id: existing.id },
          data: { content },
        });
      } else {
        note = await prisma.note.create({
          data: {
            taskId,
            userId: user.id,
            content,
          },
        });
      }

      // Also update the task's inline notes field
      await prisma.task.update({
        where: { id: taskId },
        data: { notes: content },
      });

      sendSuccess(res, note);
    } catch (err) { next(err); }
  },
};
