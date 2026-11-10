import { Router } from 'express';
import { getUsers, updateUserStatus } from '../controller/usercontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/', requireAuth, requireAdmin, getUsers);
router.patch('/:id/status', requireAuth, requireAdmin, updateUserStatus);

export default router;
