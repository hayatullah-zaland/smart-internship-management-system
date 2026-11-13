import { Router } from 'express';
import { createDepartment, getDepartments } from '../controller/departmentcontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', getDepartments);
router.post('/', requireAdmin, createDepartment);
export default router;
