import { Router } from 'express';
import { createInternship, getInternships, updateInternshipStatus } from '../controller/internshipcontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.post('/', requireAdmin, createInternship);
router.get('/', getInternships);
router.patch('/:id/status', requireAdmin, updateInternshipStatus);

export default router;
