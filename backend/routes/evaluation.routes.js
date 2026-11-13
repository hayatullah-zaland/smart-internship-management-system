import { Router } from 'express';
import { createEvaluation, getEvaluations } from '../controller/evaluationcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.post('/', createEvaluation);
router.get('/', getEvaluations);
export default router;
