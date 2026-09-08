import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { todoService, normalizeUpcomingDays } from '../services/todo/todoService';

export const todoController = {
  /** GET /api/todo?upcomingDays=14|30 */
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const upcomingDays = normalizeUpcomingDays(req.query.upcomingDays);
      sendSuccess(res, await todoService.getTodo(user.id, getTz(req), upcomingDays));
    } catch (err) {
      next(err);
    }
  },
};
