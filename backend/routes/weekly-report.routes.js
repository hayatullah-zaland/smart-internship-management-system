import { Router } from 'express';
import { createWeeklyReport, getWeeklyReports, updateWeeklyReport, submitWeeklyReport } from '../controller/weeklyreportcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.post('/', createWeeklyReport);
router.get('/', getWeeklyReports);
router.patch('/:id', updateWeeklyReport);
router.post('/:id/submit', submitWeeklyReport);

export default router;
