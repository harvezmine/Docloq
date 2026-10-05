import { Router } from 'express';
import {
  getAllFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  moveDocumentToFolder,
  moveFolder,
  grantFolderPermission,
  revokeFolderPermission,
  listFolderPermissions,
} from '../controllers/folder.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', getAllFolders);                    // flat list — frontend builds the tree
router.post('/', createFolder);
router.post('/move-document', moveDocumentToFolder);
router.post('/move-folder', moveFolder);
router.get('/:id', validateUUID('id'), getFolder);
router.put('/:id', validateUUID('id'), updateFolder);
router.delete('/:id', validateUUID('id'), deleteFolder);   // soft-delete, includes descendants

router.get('/:id/permissions', validateUUID('id'), authorize(['owner', 'admin']), listFolderPermissions);
router.post('/:id/permissions', validateUUID('id'), authorize(['owner', 'admin']), grantFolderPermission);
router.delete('/:id/permissions/:permId', validateUUID('id'), validateUUID('permId'), authorize(['owner', 'admin']), revokeFolderPermission);

export default router;
