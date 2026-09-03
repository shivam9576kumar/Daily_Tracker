import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendMessage } from '../utils/response';
import { classesService } from '../services/classes/classesService';

export const classesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await classesService.list(getAuthUser(req).id));
    } catch (e) {
      next(e);
    }
  },

  async replaceAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const classes = Array.isArray(req.body?.classes) ? req.body.classes : [];
      sendSuccess(res, await classesService.replaceAll(user.id, classes));
    } catch (e) {
      next(e);
    }
  },

  async clear(req: Request, res: Response, next: NextFunction) {
    try {
      await classesService.clear(getAuthUser(req).id);
      sendMessage(res, 'Timetable cleared');
    } catch (e) {
      next(e);
    }
  },
};
