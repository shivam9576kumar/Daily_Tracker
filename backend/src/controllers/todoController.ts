import type { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { todoService, normalizeUpcomingDays } from '../services/todo/todoService';
import { personalTaskService } from '../services/todo/personalTaskService';

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

  async createPersonal(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await personalTaskService.create(user.id, req.body ?? {}), 201);
    } catch (err) {
      next(err);
    }
  },

  async updatePersonal(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await personalTaskService.update(user.id, req.params.id as string, req.body ?? {}));
    } catch (err) {
      next(err);
    }
  },
};
