import { Router } from 'express';
import { getInbox, markInboxRead } from '../controller/inboxcontroller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', getInbox);
router.patch('/read', markInboxRead);
export default router;
