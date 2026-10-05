// Document anchoring and verification on Polygon

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import uploadConfig from '../config/upload.config.js';
import {
  anchorDocumentHandler,
  updateAnchorHandler,
  verifyDocumentHandler,
  getDocumentAnchorHandler,
  setAutoAnchorHandler,
  anchorBatchHandler,
  getStatsHandler,
  getTransactionsHandler,
  updateWalletHandler,
} from '../controllers/blockchain.controller.js';

const router = Router();

router.use((req, res, next) => {
  if (!uploadConfig.blockchain?.enabled) {
    return res.status(503).json({
      success: false,
      message: 'Blockchain service is not enabled on this instance',
    });
  }
  next();
});

router.use(authenticate);
router.use(requireFeature('blockchain'));

// Owner-only: blockchain is a trust/security feature reserved for the tenant owner.
router.get('/stats', authorize(['owner']), getStatsHandler);
router.get('/transactions', authorize(['owner']), getTransactionsHandler);
router.put('/wallet', authorize(['owner']), updateWalletHandler);
router.post('/anchor-batch', authorize(['owner']), anchorBatchHandler);

router.post('/anchor/:documentId', authorize(['owner']), validateUUID('documentId'), anchorDocumentHandler);
router.put('/anchor/:documentId', authorize(['owner']), validateUUID('documentId'), updateAnchorHandler);
router.post('/verify/:documentId', authorize(['owner']), validateUUID('documentId'), verifyDocumentHandler);
router.get('/anchor/:documentId', authorize(['owner']), validateUUID('documentId'), getDocumentAnchorHandler);
router.patch('/auto-anchor/:documentId', authorize(['owner']), validateUUID('documentId'), setAutoAnchorHandler);

export default router;
