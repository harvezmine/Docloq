// Dashboard Routes

import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

router.get('/stats', getDashboardStats);

export default router;
