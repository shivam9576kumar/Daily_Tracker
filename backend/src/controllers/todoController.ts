import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { todoService } from '../services/todo/todoService';

export const todoController = {
  /** GET /api/todo */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await todoService.getTodo(user.id, getTz(req)));
    } catch (err) {
      next(err);
    }
  },
};
