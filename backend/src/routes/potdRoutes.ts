import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { potdController } from '../controllers/potdController';

const router = Router();
router.use(authMiddleware);

router.get('/today', potdController.today);      // debug/manual refresh
router.get('/streak', potdController.streak);
router.post('/dismiss', potdController.dismiss); // { dateKey: 'YYYY-MM-DD' }

export default router;
