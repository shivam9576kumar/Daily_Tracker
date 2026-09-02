import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard/dashboardService';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';

export const dashboardController = {
  /** GET /api/dashboard/today */
  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const data = await dashboardService.getDashboardData(user.id, getTz(req));
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
};
