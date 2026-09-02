import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { notificationService } from '../services/notification/notificationService';
import { sendSuccess } from '../utils/response';

export const notificationController = {
  async getUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const notifications = await notificationService.getUnread(user.id);
      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  },

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const notifications = await notificationService.getAll(user.id);
      sendSuccess(res, notifications);
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      await notificationService.markRead(user.id, id);
      sendSuccess(res, { message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      await notificationService.markAllRead(user.id);
      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  },
};
