import { Router } from 'express';
import { createOpportunity, getOpportunities } from '../controller/opportunitycontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.post('/', createOpportunity);
router.get('/', getOpportunities);

export default router;
