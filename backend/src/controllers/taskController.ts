import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/task/taskService';
import { taskCompletionService } from '../services/task/taskCompletionService';
import { getAuthUser } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendMessage } from '../utils/response';

export const taskController = {
  /** GET /api/tasks */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const { status, topic, taskType, planId } = req.query;
      const tasks = await taskService.getAllTasks(user.id, {
        status: status as string,
        topic: topic as string,
        taskType: taskType as string,
        planId: planId as string,
      });
      sendSuccess(res, tasks);
    } catch (err) { next(err); }
  },

  /** GET /api/tasks/:id */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const task = await taskService.getTaskById(id, user.id);
      sendSuccess(res, task);
    } catch (err) { next(err); }
  },

  /** POST /api/tasks */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const task = await taskService.createTask(user.id, req.body);
      sendCreated(res, task);
    } catch (err) { next(err); }
  },

  /** PATCH /api/tasks/:id */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const task = await taskService.updateTask(id, user.id, req.body);
      sendSuccess(res, task);
    } catch (err) { next(err); }
  },

  /** DELETE /api/tasks/:id */
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      await taskService.deleteTask(id, user.id);
      sendMessage(res, 'Task deleted');
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/complete */
  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const { rating } = req.body;
      const task = await taskCompletionService.completeTask(
        id, user.id, rating
      );
      sendSuccess(res, task);
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/rate */
  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const { rating } = req.body;
      const task = await taskCompletionService.rerateTask(
        id, user.id, rating
      );
      sendSuccess(res, task);
    } catch (err) { next(err); }
  },

  /** POST /api/tasks/:id/undo */
  async undo(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const task = await taskCompletionService.undoTask(id, user.id);
      sendSuccess(res, task);
    } catch (err) { next(err); }
  },

  /** GET /api/tasks/:id/revisions */
  async getRevisions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getAuthUser(req);
      const id = req.params.id as string;
      const task = await taskService.getTaskById(id, user.id);
      sendSuccess(res, task.revisions || []);
    } catch (err) { next(err); }
  },
};
