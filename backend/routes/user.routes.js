import { Router } from 'express';
import { getUsers, updateUserStatus, updateUser, deleteUser } from '../controller/usercontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/', requireAuth, requireAdmin, getUsers);
router.patch('/:id/status', requireAuth, requireAdmin, updateUserStatus);
router.patch('/:id', requireAuth, requireAdmin, updateUser);
router.delete('/:id', requireAuth, requireAdmin, deleteUser);

export default router;
