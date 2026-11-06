import { Router } from 'express';
import { signup, signin, getProfile, updateProfile } from '../controller/authcontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/signup', signup);
router.post('/signin', signin);
router.get('/me', requireAuth, getProfile);
router.patch('/me', requireAuth, updateProfile);
router.post('/create-user', requireAuth, requireAdmin, signup);

export default router;
