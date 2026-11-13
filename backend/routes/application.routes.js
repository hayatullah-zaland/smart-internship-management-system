import { Router } from 'express';
import { createApplication, getMyApplications, getApplications, reviewApplication } from '../controller/applicationcontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', requireAdmin, getApplications);
router.patch('/:id/decision', requireAdmin, reviewApplication);
router.use((req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can submit and view their own applications here.' });
  }
  next();
});
router.post('/', createApplication);
router.get('/me', getMyApplications);

export default router;
