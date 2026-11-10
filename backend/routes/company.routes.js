import { Router } from 'express';
import { createCompany, getCompanies, assignRepresentative } from '../controller/companycontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.post('/', createCompany);
router.get('/', getCompanies);
router.patch('/:id/representative', assignRepresentative);

export default router;
