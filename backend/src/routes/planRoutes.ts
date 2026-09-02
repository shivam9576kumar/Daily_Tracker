import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { planController } from '../controllers/planController';

const router = Router();

router.use(authMiddleware);

router.post('/ai-parse', planController.aiParse);
router.post('/preview', planController.preview);
router.post('/commit', planController.commit);
router.get('/active', planController.getActive);
router.patch('/:id/archive', planController.archive);

export default router;
