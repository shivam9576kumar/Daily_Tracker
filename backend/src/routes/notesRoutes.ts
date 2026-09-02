import { Router } from 'express';
import { notesController } from '../controllers/notesController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
router.use(authMiddleware);

// Notes are nested under tasks: /api/tasks/:id/notes
router.get('/:id/notes', notesController.get);
router.post('/:id/notes', notesController.create);
router.put('/:id/notes', notesController.update);

export default router;
