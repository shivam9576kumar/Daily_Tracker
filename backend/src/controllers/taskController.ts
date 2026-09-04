import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task/taskService';
import { taskCompletionService } from '../services/task/taskCompletionService';
import { getAuthUser } from '../middleware/authMiddleware';
import { getTz } from '../middleware/timezoneMiddleware';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';
import { ValidationError } from '../utils/error';

export const taskController = {
  /** GET /api/tasks */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { status, topic, taskType, planId } = req.query;
      sendSuccess(res, await taskService.getAllTasks(user.id, {
        status: status as string, topic: topic as string, taskType: taskType as string, planId: planId as string,
      }));
    } catch (err) { next(err); }
  },

  /** GET /api/tasks/:id */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await taskService.getTaskById(req.params.id as string, user.id));
    } catch (err) { next(err); }
  },

  /** POST /api/tasks */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendCreated(res, await taskService.createTask(user.id, req.body));
    } catch (err) { next(err); }
  },

  /** PATCH /api/tasks/:id */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await taskService.updateTask(req.params.id as string, user.id, req.body));
    } catch (err) { next(err); }
  },

  /** DELETE /api/tasks/:id */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      await taskService.deleteTask(req.params.id as string, user.id);
      sendMessage(res, 'Task deleted');
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/complete   body: { rating? }  — solve (rating optional, new problems only) */
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const rating = req.body?.rating;
      const tz = getTz(req);
      sendSuccess(res, await taskCompletionService.completeTask(user.id, req.params.id as string, rating, tz));
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/rate   body: { rating }  — rate or re-rate a solved problem */
  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const rating = req.body?.rating;
      if (!rating) throw new ValidationError('rating is required');
      const tz = getTz(req);
      sendSuccess(res, await taskCompletionService.completeTask(user.id, req.params.id as string, rating, tz));
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/unrate  — remove the revision plan, keep the solve */
  async unrate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await taskCompletionService.unrateTask(user.id, req.params.id as string));
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/undo  — unsolve */
  async undo(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      sendSuccess(res, await taskCompletionService.undoTask(user.id, req.params.id as string));
    } catch (err) { next(err); }
  },

  /** GET /api/tasks/:id/revisions */
  async getRevisions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const task = await taskService.getTaskById(req.params.id as string, user.id);
      sendSuccess(res, task.revisions || []);
    } catch (err) { next(err); }
  },
};
