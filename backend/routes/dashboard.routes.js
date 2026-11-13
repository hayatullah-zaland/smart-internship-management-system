import { Router } from 'express';
import { getDashboard } from '../controller/dashboardcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/stats', requireAuth, getDashboard);
export default router;
