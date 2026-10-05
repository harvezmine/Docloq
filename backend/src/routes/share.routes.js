// Public preview-only share links (mounted at /api/shares)

import { Router } from 'express';
import { manifestHandler, pageHandler, revokeShareHandler } from '../controllers/share.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

// Public — token is the credential (high-entropy, gated by active/expiry/maxViews).
router.get('/:token', manifestHandler);
router.get('/:token/page/:n', pageHandler);

// Revoke is org-scoped in the service.
router.delete('/:shareId', authenticate, validateUUID('shareId'), revokeShareHandler);

export default router;
