import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { progressController } from '../controllers/progressController';

const router = Router();
router.use(authMiddleware);

router.get('/overview', progressController.overview);
router.get('/heatmap', progressController.heatmap);
router.get('/stats', progressController.stats);
router.get('/topics', progressController.topics);
router.get('/activity', progressController.activity);

export default router;
