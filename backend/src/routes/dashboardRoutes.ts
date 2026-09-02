import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/today', dashboardController.getToday);

export default router;
