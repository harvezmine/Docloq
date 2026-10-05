// Organization Routes

import { Router } from 'express';
import multer from 'multer';
import { getCompanyProfile, updateCompanyProfile, getFeatures, uploadProfileImage } from '../controllers/organization.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { MAX_IMAGE_BYTES } from '../services/image-upload.service.js';

const router = Router();

router.use(authenticate);

// Logo/cover upload: in-memory only, 5MB cap, image/* pre-filter; real validation
// (magic bytes + re-encode) happens in the controller pipeline.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype || '')),
});
const imageUploadSingle = (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 5MB' : 'Upload gagal';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.get('/profile', getCompanyProfile);
router.get('/features', getFeatures);
router.put('/profile', authorize(['owner', 'admin']), updateCompanyProfile);
router.post('/profile/upload-image', authorize(['owner', 'admin']), imageUploadSingle, uploadProfileImage);

export default router;
