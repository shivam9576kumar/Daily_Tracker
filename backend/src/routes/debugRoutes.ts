import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { debugController } from '../controllers/debugController';

const router = Router();

router.use(authMiddleware);

router.get('/revisions', debugController.revisionReport);
router.post('/cron/backlog', debugController.runBacklog);
router.post('/cron/expiry', debugController.runExpiry);

export default router;
