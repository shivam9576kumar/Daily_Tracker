import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { dailyChallengesController } from '../controllers/dailyChallengesController';

const router = Router();
router.use(authMiddleware);

router.get('/settings', dailyChallengesController.getSettings);
router.patch('/settings', dailyChallengesController.updateSettings);

router.post('/cp31/one-more', dailyChallengesController.oneMore);
router.post('/cp31/skip/:taskId', dailyChallengesController.skip);
router.post('/cp31/retry/:taskId', dailyChallengesController.retry);
router.get('/cp31/skipped', dailyChallengesController.getSkipped);
router.post('/cp31/advance-band', dailyChallengesController.advanceBand);
router.get('/cp31/streak', dailyChallengesController.getStreak);

export default router;
