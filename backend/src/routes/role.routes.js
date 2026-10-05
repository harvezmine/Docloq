import { Router } from 'express';
import {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignUsersToRole,
  removeUserFromRole,
  getUserPermissions,
} from '../controllers/role.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/my-permissions', getUserPermissions);

router.get('/', authorize(['owner', 'admin']), getRoles);
router.get('/:id', authorize(['owner', 'admin']), validateUUID('id'), getRole);
router.post('/', authorize(['owner', 'admin']), createRole);
router.put('/:id', authorize(['owner', 'admin']), validateUUID('id'), updateRole);
router.delete('/:id', authorize(['owner', 'admin']), validateUUID('id'), deleteRole);

router.post('/:id/assign', authorize(['owner', 'admin']), validateUUID('id'), assignUsersToRole);
router.delete('/:id/users/:userId', authorize(['owner', 'admin']), validateUUID('id', 'userId'), removeUserFromRole);
router.get('/user/:userId/permissions', authorize(['owner', 'admin']), validateUUID('userId'), getUserPermissions);

export default router;
