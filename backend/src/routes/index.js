// Route Aggregator

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import totpRoutes from './totp.routes.js';
import documentRoutes from './document.routes.js';
import folderRoutes from './folder.routes.js';
import formRoutes from './form.routes.js';
import taskRoutes from './task.routes.js';
import trashRoutes from './trash.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import departmentRoutes from './department.routes.js';
import signingRoutes from './signing.routes.js';
import roleRoutes from './role.routes.js';
import aiAnalysisRoutes from './ai-analysis.routes.js';
import aiProjectRoutes from './ai-project.routes.js';
import notificationRoutes from './notification.routes.js';
import watermarkScannerRoutes from './watermark-scanner.routes.js';
import osintRoutes from './osint.routes.js';
import blockchainRoutes from './blockchain.routes.js';
import organizationRoutes from './organization.routes.js';
import shareRoutes from './share.routes.js';
import superAdminRoutes from './superadmin.routes.js';
import activityRoutes from './activity.routes.js';

const router = Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/totp', totpRoutes);
router.use('/documents', documentRoutes);
router.use('/folders', folderRoutes);
router.use('/forms', formRoutes);
router.use('/tasks', taskRoutes);
router.use('/trash', trashRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/signing', signingRoutes);
router.use('/roles', roleRoutes);
router.use('/ai-analysis', aiAnalysisRoutes);
router.use('/ai-projects', aiProjectRoutes);
router.use('/notifications', notificationRoutes);
router.use('/watermark-scanner', watermarkScannerRoutes);
router.use('/osint', osintRoutes);
router.use('/blockchain', blockchainRoutes);
router.use('/organizations', organizationRoutes);
router.use('/shares', shareRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/activity', activityRoutes);

// Health Check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
