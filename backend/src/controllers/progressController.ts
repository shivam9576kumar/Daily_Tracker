import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess } from '../utils/response';
import { progressService } from '../services/progress/progressService';
import { heatmapService } from '../services/progress/heatmapService';
import { topicProgressService } from '../services/progress/topicProgressService';

function parseScope(v: unknown): 'plan' | 'all' | 'auto' {
  return v === 'plan' || v === 'all' ? v : 'auto';
}

function parseInt_(v: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

export const progressController = {
  /** GET /api/progress/overview?scope=plan|all&months=12 */
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const data = await progressService.getOverview(
        user.id,
        getTz(req),
        parseScope(req.query.scope),
        parseInt_(req.query.months, 12, 1, 12)
      );
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/progress/heatmap?months=12 */
  async heatmap(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(
        res,
        await heatmapService.getHeatmap(user.id, getTz(req), parseInt_(req.query.months, 12, 1, 12))
      );
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/progress/stats */
  async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await progressService.getStats(user.id, getTz(req)));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/progress/topics?scope=plan|all */
  async topics(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(
        res,
        await topicProgressService.getTopicProgress(user.id, parseScope(req.query.scope))
      );
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/progress/activity?limit=10 */
  async activity(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(
        res,
        await progressService.getRecentActivity(user.id, parseInt_(req.query.limit, 10, 1, 50))
      );
    } catch (err) {
      next(err);
    }
  },
};
