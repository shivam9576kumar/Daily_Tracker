import { Router } from 'express';
import { assignmentController } from '../controllers/assignmentController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

router.get('/', assignmentController.getAll);
router.post('/', assignmentController.create);
router.patch('/:id', assignmentController.update);
router.delete('/:id', assignmentController.remove);

export default router;
