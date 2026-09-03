import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { classesController } from '../controllers/classesController';

const router = Router();
router.use(authMiddleware);

router.get('/', classesController.list);
router.put('/', classesController.replaceAll); // full-replace save
router.delete('/', classesController.clear);

export default router;
