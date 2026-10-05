// Two-Factor Auth Routes

import { Router } from 'express';
import {
  generateTOTPSecret,
  enableTOTP,
  disableTOTP,
  verifyTOTPLogin,
  getTOTPStatus,
  sendEmailOTP,
  verifyEmailOTP,
} from '../controllers/totp.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Public - Verify saat login
router.post('/verify-login', verifyTOTPLogin);

// Public - Email OTP
router.post('/send-email-otp', sendEmailOTP);
router.post('/verify-email-otp', verifyEmailOTP);

// Protected - Butuh authentication
router.use(authenticate);
router.get('/status', getTOTPStatus);
router.post('/generate', generateTOTPSecret);
router.post('/enable', enableTOTP);
router.post('/disable', disableTOTP);

export default router;
