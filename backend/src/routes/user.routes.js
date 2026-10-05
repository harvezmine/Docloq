// User Management Routes

import { Router } from 'express';
import { 
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
  transferOwnership,
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

// User CRUD
router.get('/', getUsers);
router.get('/:id', validateUUID('id'), getUserById);
router.post('/', authorize(['owner', 'admin']), createUser);
router.put('/:id', authorize(['owner', 'admin']), validateUUID('id'), updateUser);
router.patch('/:id', authorize(['owner', 'admin']), validateUUID('id'), updateUser);
router.delete('/:id', authorize(['owner', 'admin']), validateUUID('id'), deleteUser);

// User Actions (Admin only)
router.post('/:id/reset-password', authorize(['owner', 'admin']), validateUUID('id'), resetUserPassword);
router.patch('/:id/toggle-status', authorize(['owner', 'admin']), validateUUID('id'), toggleUserStatus);

// Ownership transfer (owner-only): target becomes owner, caller demoted to admin.
router.post('/:id/transfer-ownership', authorize(['owner']), validateUUID('id'), transferOwnership);

export default router;
