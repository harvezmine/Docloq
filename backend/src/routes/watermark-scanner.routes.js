// Admin-only leak-detection watermark scanning.

import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  scanForWatermark,
  getWatermarkHistory,
  getWatermarkDetails,
} from '../controllers/watermark-scanner.controller.js';

const router = Router();

// Multer for in-memory file upload (scanner accepts any document)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

router.use(authenticate);
router.use(authorize(['owner']));
router.use(requireFeature('osint'));

router.post('/scan', upload.single('file'), scanForWatermark);
router.get('/history/:documentId', validateUUID('documentId'), getWatermarkHistory);
router.get('/details/:watermarkId', validateUUID('watermarkId'), getWatermarkDetails);

export default router;
