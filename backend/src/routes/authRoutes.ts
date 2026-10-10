import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  demoLogin,
  exchangeAuthCode,
  getMe,
  logout,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.post('/demo', demoLogin);
router.post('/exchange', exchangeAuthCode);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

export default router;
