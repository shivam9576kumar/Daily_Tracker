import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { planController } from '../controllers/planController';

const router = Router();
router.use(authMiddleware);

router.post('/ai-parse', planController.aiParse);
router.post('/ai-conversation', planController.aiConversation);
router.post('/preview', planController.preview);
router.post('/commit', planController.commit);

router.get('/active', planController.getActive);
router.get('/archived', planController.getArchived);

router.post('/:id/restore', planController.restore);
router.delete('/:id', planController.remove);

router.patch('/:id/archive', planController.archive);

export default router;
