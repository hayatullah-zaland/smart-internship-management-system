import { Router } from 'express';
import { signup, signin } from '../controller/authcontroller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/signup', signup);
router.post('/signin', signin);
router.post('/create-user', requireAdmin, signup);

export default router;
