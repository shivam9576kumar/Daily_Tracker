import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { todoController } from '../controllers/todoController';

const router = Router();
router.use(authMiddleware);

router.get('/', todoController.get);
router.post('/tasks', todoController.createPersonal);
router.patch('/tasks/:id', todoController.updatePersonal);

export default router;
