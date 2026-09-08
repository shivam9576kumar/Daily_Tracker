import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { dailyChallengesController } from '../controllers/dailyChallengesController';

const router = Router();
router.use(authMiddleware);

router.get('/settings', dailyChallengesController.getSettings);
router.patch('/settings', dailyChallengesController.updateSettings);

export default router;
