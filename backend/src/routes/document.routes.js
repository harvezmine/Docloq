import { Router } from 'express';
import multer from 'multer';
import {
  getAllDocuments,
  getDocument,
  uploadDocument,
  uploadDocumentSimple,
  serveDocument,
  downloadDocument,
  downloadDocumentDecrypted,
  downloadDocumentConverted,
  deleteDocument,
  getOnlyOfficeConfig,
  convertToEditable,
  onlyOfficeCallback,
  forceSaveDocument,
  getDocumentVersions,
  verifyByShortCode,
  verifyByQrImage,
  verifyByFile,
  getBlockchainIntegrity,
  verifyPreview,
  getDocumentQrImage,
  grantDocumentPermission,
  revokeDocumentPermission,
  listDocumentPermissions,
  toggleDocumentTracking,
  toggleQrOnDownload,
} from '../controllers/document.controller.js';
import {
  getPresenceHandler,
  postHeartbeatHandler,
  deletePresenceHandler,
  releaseLockHandler,
  forceReleaseLockHandler,
  pingLockOwnerHandler,
  getBreadcrumbHandler,
  renameDocumentHandler,
  listCommentsHandler,
  createCommentHandler,
  deleteCommentHandler,
  getMentionableUsersHandler,
} from '../controllers/document-collab.controller.js';
import { createShareHandler, listSharesHandler } from '../controllers/share.controller.js';
import { optionalAuth, authenticate, authorize } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import { isBlockedFile, isAllowedUpload } from '../config/upload.config.js';

const router = Router();

// Allow/block lists live in upload.config.js — shared with the pipeline validator and AI Project sources.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (isBlockedFile(file.originalname, file.mimetype)) {
      cb(new Error('File type is not allowed for security reasons (executable/script blocked)'), false);
      return;
    }
    if (isAllowedUpload(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not supported`), false);
    }
  },
});

router.get('/', optionalAuth, getAllDocuments);
// Document verification is owner-only (no public access) — every path requires an
// authenticated owner session, so it can't be reached from the public /verify URL,
// a QR scan by a non-owner, or a direct API call.
router.get('/verify', authenticate, authorize(['owner']), requireFeature('verification'), verifyByShortCode);
router.post('/verify-qr-image', authenticate, authorize(['owner']), requireFeature('verification'), upload.single('file'), verifyByQrImage);
router.post('/verify-file', authenticate, authorize(['owner']), requireFeature('verification'), upload.single('file'), verifyByFile);
router.get('/:id/blockchain-integrity', authenticate, authorize(['owner']), requireFeature('verification'), validateUUID('id'), getBlockchainIntegrity);
router.get('/:id/verify-preview', authenticate, authorize(['owner']), requireFeature('verification'), validateUUID('id'), verifyPreview);
router.get('/:id', authenticate, validateUUID('id'), getDocument);   // metadata read is authed-UI only; grants enforced in-controller
router.get('/:id/qr-image', authenticate, requireFeature('qr'), validateUUID('id'), getDocumentQrImage);   // authed + org-scoped in-controller (was optionalAuth → anonymous cross-tenant QR leak)
router.get('/:id/file', optionalAuth, validateUUID('id'), serveDocument);   // Auth via user JWT or OnlyOffice signed token

router.post('/upload', authenticate, upload.single('file'), uploadDocument);
router.post('/upload-simple', authenticate, upload.single('file'), uploadDocumentSimple);     // legacy
// Versions + downloads are user-initiated from the authed UI (client sends the Bearer
// token) — require a real session so a no-token caller can't pull a document by UUID,
// and so per-document/folder grants are actually enforced (assertDocumentAccess).
router.get('/:id/versions', authenticate, validateUUID('id'), getDocumentVersions);
router.get('/:id/download', authenticate, validateUUID('id'), downloadDocumentDecrypted);
router.get('/:id/download-as', authenticate, validateUUID('id'), downloadDocumentConverted);   // ?format=pdf|docx|xlsx|png|jpg
router.delete('/:id', authenticate, validateUUID('id'), deleteDocument);

router.post('/:id/shares', authenticate, validateUUID('id'), createShareHandler);
router.get('/:id/shares', authenticate, validateUUID('id'), listSharesHandler);

router.get('/:id/onlyoffice-config', authenticate, validateUUID('id'), getOnlyOfficeConfig);   // client-only; OO server uses /file + /callback with oo_token
router.post('/:id/convert-to-editable', authenticate, validateUUID('id'), convertToEditable);
router.post('/:id/callback', validateUUID('id'), onlyOfficeCallback);      // Auth via OnlyOffice signed token (oo_token query param)
router.post('/:id/force-save', optionalAuth, validateUUID('id'), forceSaveDocument);

router.get('/:id/permissions', authenticate, validateUUID('id'), authorize(['owner', 'admin']), listDocumentPermissions);
router.post('/:id/permissions', authenticate, validateUUID('id'), authorize(['owner', 'admin']), grantDocumentPermission);
router.delete('/:id/permissions/:permId', authenticate, validateUUID('id'), validateUUID('permId'), authorize(['owner', 'admin']), revokeDocumentPermission);

router.get('/:id/presence', authenticate, validateUUID('id'), getPresenceHandler);
router.post('/:id/presence', authenticate, validateUUID('id'), postHeartbeatHandler);
router.delete('/:id/presence', authenticate, validateUUID('id'), deletePresenceHandler);
router.post('/:id/edit-lock/release', authenticate, validateUUID('id'), releaseLockHandler);
router.post('/:id/edit-lock/force-release', authenticate, validateUUID('id'), forceReleaseLockHandler);
router.post('/:id/ping-editor', authenticate, validateUUID('id'), pingLockOwnerHandler);
router.get('/:id/breadcrumb', authenticate, validateUUID('id'), getBreadcrumbHandler);
router.patch('/:id', authenticate, validateUUID('id'), renameDocumentHandler);
router.get('/:id/comments', authenticate, validateUUID('id'), listCommentsHandler);
router.post('/:id/comments', authenticate, validateUUID('id'), createCommentHandler);
router.delete('/comments/:commentId', authenticate, validateUUID('commentId'), deleteCommentHandler);
router.get('/:id/mentionable-users', authenticate, validateUUID('id'), getMentionableUsersHandler);

// Owner or document creator only
router.patch('/:id/tracking', authenticate, validateUUID('id'), requireFeature('osint'), toggleDocumentTracking);

// Creator/admin/owner only
router.patch('/:id/qr-on-download', authenticate, validateUUID('id'), requireFeature('qr'), toggleQrOnDownload);

export default router;
