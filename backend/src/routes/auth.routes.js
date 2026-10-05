import { Router } from 'express';
import multer from 'multer';
import {
  login,
  register,
  logout,
  getMe,
  refreshToken,
  completeLogin,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
} from '../controllers/auth.controller.js';
import { MAX_IMAGE_BYTES } from '../services/image-upload.service.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
} from '../middlewares/rate-limit.middleware.js';
import { initiateGoogleLogin, googleCallback } from '../controllers/google-oauth.controller.js';

const router = Router();

router.post('/login', login);
router.post('/complete-login', completeLogin);
router.post('/register', register);
router.post('/refresh-token', refreshToken);

// Public password recovery (no auth): request a reset link, then set a new password
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

// Google OAuth is invite-only
router.get('/google', initiateGoogleLogin);
router.get('/google/callback', googleCallback);

// Avatar upload: in-memory only (never touches disk), 5MB cap, image/* pre-filter;
// real validation (magic bytes + re-encode) happens in the controller pipeline.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype || '')),
});
const avatarUploadSingle = (req, res, next) => {
  avatarUpload.single('image')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran gambar maksimal 5MB' : 'Upload gagal';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.post('/me/avatar', authenticate, avatarUploadSingle, uploadAvatar);
router.delete('/me/avatar', authenticate, deleteAvatar);
router.post('/change-password', authenticate, changePasswordLimiter, changePassword);

router.get('/sessions', authenticate, listSessions);
router.delete('/sessions', authenticate, revokeOtherSessions);
router.delete('/sessions/:id', authenticate, validateUUID('id'), revokeSession);
router.post('/heartbeat', authenticate, (req, res) => {
  // lastActivityAt is already updated by authenticate middleware
  res.json({ success: true, message: 'Session active' });
});

export default router;
