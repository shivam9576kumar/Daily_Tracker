import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError, ValidationError } from '../utils/error';

function assertTitle(title: unknown) {
  if (typeof title !== 'string' || !title.trim()) {
    throw new ValidationError('Title is required');
  }
  if (title.trim().length > 200) {
    throw new ValidationError('Title must be under 200 characters');
  }
  return title.trim();
}

function assertDeadline(deadline: unknown) {
  if (!deadline || typeof deadline !== 'string') {
    throw new ValidationError('Deadline is required');
  }
  const d = new Date(deadline);
  if (isNaN(d.getTime())) {
    throw new ValidationError('Deadline is not a valid date');
  }
  return d;
}

export const assignmentController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const assignments = await prisma.assignment.findMany({
        where: { userId: user.id },
        orderBy: { deadline: 'asc' },
      });
      sendSuccess(res, assignments);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const title = assertTitle(req.body.title);
      const deadline = assertDeadline(req.body.deadline);
      const description =
        typeof req.body.description === 'string' ? req.body.description.trim() : null;

      const assignment = await prisma.assignment.create({
        data: {
          userId: user.id,
          title,
          description: description || null,
          deadline,
        },
      });
      sendCreated(res, assignment);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const existing = await prisma.assignment.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) throw new NotFoundError('Assignment');

      const { title, description, deadline, status } = req.body;

      if (status && status !== 'pending' && status !== 'completed') {
        throw new ValidationError('status must be pending or completed');
      }

      const assignment = await prisma.assignment.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: assertTitle(title) } : {}),
          ...(description !== undefined
            ? { description: typeof description === 'string' ? description.trim() || null : null }
            : {}),
          ...(deadline !== undefined ? { deadline: assertDeadline(deadline) } : {}),
          ...(status
            ? {
                status,
                completedAt: status === 'completed' ? new Date() : null,
              }
            : {}),
        },
      });
      sendSuccess(res, assignment);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const existing = await prisma.assignment.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) throw new NotFoundError('Assignment');

      await prisma.assignment.delete({ where: { id } });
      sendMessage(res, 'Assignment deleted');
    } catch (err) {
      next(err);
    }
  },
};
