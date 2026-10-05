import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  getActivityFeed,
  getActivityIntegrity,
  getActivityBlockchain,
} from '../controllers/activity.controller.js';

const router = Router();

// Owner-only, tenant-scoped activity log. org is always taken from the authenticated
// user's session inside the controllers — there is no cross-tenant path here.
router.use(authenticate, authorize(['owner']));

router.get('/', getActivityFeed);
router.get('/integrity', getActivityIntegrity);
router.get('/blockchain', getActivityBlockchain);

export default router;
