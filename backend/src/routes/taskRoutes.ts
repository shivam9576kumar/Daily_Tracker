import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', taskController.getAll);
router.get('/:id', taskController.getById);
router.post('/', taskController.create);
router.patch('/:id', taskController.update);
router.delete('/:id', taskController.remove);

// Task actions
router.post('/:id/complete', taskController.complete);
router.post('/:id/rate', taskController.rate);
router.post('/:id/undo', taskController.undo);
router.get('/:id/revisions', taskController.getRevisions);

export default router;
