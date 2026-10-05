import { Router } from 'express';
import multer from 'multer';
import {
  getFormTemplates,
  getFormTemplate,
  createFormTemplate,
  updateFormTemplate,
  deleteFormTemplate,
  createBlankTemplate,
  uploadExistingTemplate,
  getTemplateDocument,
  getFormInstances,
  getFormInstance,
  createFormInstance,
  updateFormInstance,
  deleteFormInstance,
  updateWorkflowStep,
  getOrgUsers,
} from '../controllers/form.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticate);

const ALLOWED_TEMPLATE_EXTS = ['.pdf', '.docx', '.doc', '.odt', '.rtf'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
      'text/rtf',
      // Browsers/OSes sometimes send a generic type for office files — fall back to extension.
      'application/octet-stream',
    ];
    const ext = (file.originalname.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    if (allowedMime.includes(file.mimetype) && ALLOWED_TEMPLATE_EXTS.includes(ext)) {
      cb(null, true);
    } else if (ALLOWED_TEMPLATE_EXTS.includes(ext)) {
      // Trust the extension when the mimetype is generic/unknown.
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, ODT, RTF files are allowed'));
    }
  },
});

// Turn multer/fileFilter errors into a clear 400 JSON instead of a generic 500.
const uploadTemplateFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large (max 50MB)'
        : err.message || 'Upload failed';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.get('/templates', getFormTemplates);
router.post('/templates', createFormTemplate);
router.post('/templates/create-blank', createBlankTemplate);
router.post('/templates/upload-file', uploadTemplateFile, uploadExistingTemplate);
router.get('/templates/:id', validateUUID('id'), getFormTemplate);
router.get('/templates/:id/document', validateUUID('id'), getTemplateDocument);
router.put('/templates/:id', validateUUID('id'), updateFormTemplate);
router.delete('/templates/:id', validateUUID('id'), deleteFormTemplate);

router.get('/instances', getFormInstances);
router.post('/instances', createFormInstance);
router.get('/instances/:id', validateUUID('id'), getFormInstance);
router.put('/instances/:id', validateUUID('id'), updateFormInstance);
router.delete('/instances/:id', validateUUID('id'), deleteFormInstance);

router.put('/workflow-steps/:id', validateUUID('id'), updateWorkflowStep);

router.get('/users', getOrgUsers);

export default router;
