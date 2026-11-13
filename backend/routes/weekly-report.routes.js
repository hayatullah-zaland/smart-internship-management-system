import { Router } from 'express';
import { createWeeklyReport, getWeeklyReports } from '../controller/weeklyreportcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.post('/', createWeeklyReport);
router.get('/', getWeeklyReports);

export default router;
