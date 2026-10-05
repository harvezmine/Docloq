import { Router } from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
  addTaskComment,
  getTaskDocumentConfig,
  getTaskDocumentPreview,
  getTaskDocumentPreviewPage,
  submitTaskAction,
} from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/:id', validateUUID('id'), getTask);
router.put('/:id', validateUUID('id'), updateTask);
router.put('/:id/complete', validateUUID('id'), completeTask);
router.put('/:id/submit', validateUUID('id'), submitTaskAction);
router.delete('/:id', validateUUID('id'), deleteTask);
router.post('/:id/comments', validateUUID('id'), addTaskComment);
router.get('/:id/document-config', validateUUID('id'), getTaskDocumentConfig);
router.get('/:id/document/preview', validateUUID('id'), getTaskDocumentPreview);
router.get('/:id/document/preview/:n', validateUUID('id'), getTaskDocumentPreviewPage);

export default router;
