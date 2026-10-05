// OSINT Tracker routes.
// Authenticated UI endpoints (super_admin/admin/manager/auditor)
// + public webhook (x-osint-key API key, no session auth).

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  getStats,
  listLeaks,
  listTracked,
  checkDocumentOnDemand,
  reportWebhook,
} from '../controllers/osint.controller.js';

const router = Router();

// ── Public webhook (NO session auth) — mounted BEFORE authenticate guard ──
const webhookKeyMiddleware = (req, res, next) => {
  const expected = process.env.OSINT_WEBHOOK_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, message: 'Webhook disabled (OSINT_WEBHOOK_KEY not configured)' });
  }
  if (req.header('x-osint-key') !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid or missing x-osint-key' });
  }
  next();
};
router.post('/report', webhookKeyMiddleware, reportWebhook);

// ── Authenticated UI routes ──
router.use(authenticate);
router.use(authorize(['owner']));
router.use(requireFeature('osint'));

router.get('/stats', getStats);
router.get('/leaks', listLeaks);
router.get('/documents/tracked', listTracked);
router.post('/documents/:id/check', validateUUID('id'), checkDocumentOnDemand);

export default router;
