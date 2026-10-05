import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  listDocuments,
  grant,
  revoke,
  analyze,
  history,
  status,
  pageInfo,
  quota,
} from '../controllers/ai-analysis.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireFeature('aiAnalysis'));

router.get('/quota', quota);
router.get('/documents', listDocuments);
router.post('/documents/:id/grant', validateUUID('id'), grant);
router.post('/documents/:id/revoke', validateUUID('id'), revoke);
router.post('/documents/:id/analyze', validateUUID('id'), analyze);
router.get('/documents/:id/page-info', validateUUID('id'), pageInfo);
router.get('/documents/:id/history', validateUUID('id'), history);
router.get('/documents/:id/status', validateUUID('id'), status);

export default router;
