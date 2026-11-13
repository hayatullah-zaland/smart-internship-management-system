import { Router } from 'express';
import { createDailyReport, getDailyReports, updateDailyReport, submitDailyReport, approveDailyReport, requestDailyReportChanges } from '../controller/dailyreportcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', getDailyReports);
router.patch('/:id/approve', approveDailyReport);
router.patch('/:id/request-changes', requestDailyReportChanges);
router.use((req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can write and submit daily reports.' });
  }
  next();
});
router.post('/', createDailyReport);
router.patch('/:id', updateDailyReport);
router.post('/:id/submit', submitDailyReport);

export default router;
