import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { notificationController } from '../controllers/notificationController';

const router = Router();

router.use(authMiddleware);

router.get('/', notificationController.getAll);
router.get('/unread', notificationController.getUnread);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);

export default router;
