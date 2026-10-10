import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { planController } from '../controllers/planController';

import { requireAiEnabled } from '../middleware/aiEnabledMiddleware';

const router = Router();
router.use(authMiddleware);

router.get('/ai-status', planController.aiStatus);
router.post('/ai-parse', requireAiEnabled(), planController.aiParse);
router.post('/ai-conversation', requireAiEnabled(), planController.aiConversation);
router.post('/preview', planController.preview);
router.post('/commit', planController.commit);

router.get('/active', planController.getActive);
router.get('/archived', planController.getArchived);
router.get('/topics', planController.topics);

router.post('/:id/restore', planController.restore);
router.delete('/:id', planController.remove);

router.patch('/:id/archive', planController.archive);

export default router;
