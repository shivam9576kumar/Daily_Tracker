import { Router } from 'express';
import {
  googleLogin,
  googleCallback,
  getMe,
  logout,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);

// Protected routes
router.get('/me', authMiddleware, getMe);
router.post('/logout', authMiddleware, logout);

export default router;
