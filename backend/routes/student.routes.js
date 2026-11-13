import { Router } from 'express';
import { saveStudentProfile, getStudentProfile, getStudents } from '../controller/studentcontroller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', requireAdmin, getStudents);
router.use((req, res, next) => {
  if (req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Only students can manage their academic profile.' });
  next();
});
router.get('/me', getStudentProfile);
router.put('/me', saveStudentProfile);
export default router;
