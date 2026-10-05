// DocuSeal e-signing integration

import { Router } from 'express';
import {
  createSigningRequest,
  getSigningStatus,
  manualCheckStatus,
  handleWebhook,
  getSignedDocuments,
  serveSignedDocumentFile,
  removeSignatureBackground,
} from '../controllers/signing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

// Public — called by external services
router.post('/webhook', handleWebhook);
router.get('/:signatureId/file', validateUUID('signatureId'), serveSignedDocumentFile); // OnlyOffice calls this to load signed PDFs

router.use(authenticate);

router.post('/request', createSigningRequest);
router.post('/remove-bg', removeSignatureBackground);
router.get('/:taskId/status', validateUUID('taskId'), getSigningStatus);
router.post('/:taskId/check', validateUUID('taskId'), manualCheckStatus);
router.get('/:signatureId/documents', validateUUID('signatureId'), getSignedDocuments);

export default router;
