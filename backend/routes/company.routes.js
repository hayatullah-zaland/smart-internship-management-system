import { Router } from 'express';
import { createCompany, getCompanies } from '../controller/companycontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.post('/', createCompany);
router.get('/', getCompanies);

export default router;
