import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { dailyChallengesController } from '../controllers/dailyChallengesController';

const router = Router();
router.use(authMiddleware);

router.get('/settings', dailyChallengesController.getSettings);
router.patch('/settings', dailyChallengesController.updateSettings);

router.post('/cp31/one-more', dailyChallengesController.oneMore);
router.post('/cp31/skip/:taskId', dailyChallengesController.skip);
router.post('/cp31/advance-band', dailyChallengesController.advanceBand);

export default router;
