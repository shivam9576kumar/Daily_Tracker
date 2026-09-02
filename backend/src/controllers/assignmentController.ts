import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { NotFoundError } from '../utils/error';

export const assignmentController = {
  /** GET /api/assignments */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const assignments = await prisma.assignment.findMany({
        where: { userId: user.id },
        orderBy: { deadline: 'asc' },
      });
      sendSuccess(res, assignments);
    } catch (err) { next(err); }
  },

  /** POST /api/assignments */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { title, description, deadline } = req.body;
      const assignment = await prisma.assignment.create({
        data: {
          userId: user.id,
          title,
          description: description || null,
          deadline: new Date(deadline),
        },
      });
      sendCreated(res, assignment);
    } catch (err) { next(err); }
  },

  /** PATCH /api/assignments/:id */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const existing = await prisma.assignment.findFirst({
        where: { id, userId: user.id },
      });
      if (!existing) throw new NotFoundError('Assignment');

      const { title, description, deadline, status } = req.body;
      const assignment = await prisma.assignment.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(deadline && { deadline: new Date(deadline) }),
          ...(status && {
            status,
            completedAt: status === 'completed' ? new Date() : null,
          }),
        },
      });
      sendSuccess(res, assignment);
    } catch (err) { next(err); }
  },

  /** DELETE /api/assignments/:id */
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
    } catch (err) { next(err); }
  },
};
