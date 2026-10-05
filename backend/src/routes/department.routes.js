// Department Management Routes

import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  getDepartmentMembers,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

// All users can view departments (needed for dropdowns)
router.get('/', getDepartments);

// Admin-only CRUD
router.get('/:id', authorize(['owner', 'admin']), validateUUID('id'), getDepartmentById);
router.get('/:id/members', authorize(['owner', 'admin']), validateUUID('id'), getDepartmentMembers);
router.post('/', authorize(['owner', 'admin']), createDepartment);
router.put('/:id', authorize(['owner', 'admin']), validateUUID('id'), updateDepartment);
router.delete('/:id', authorize(['owner', 'admin']), validateUUID('id'), deleteDepartment);

export default router;
