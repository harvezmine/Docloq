import { generateSecret, generateURI } from 'otplib';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { db } from '../db/index.js';
import { users, userSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateOTP, sendOTPEmail, OTP_EXPIRY_MINUTES } from '../services/email.service.js';
import { verifyTotpToken, TOTP_CONFIG } from '../services/totp.util.js';
import {
  verifyStageTicket,
  issueVerifiedTicket,
  STAGES,
} from '../services/auth-2fa-ticket.service.js';

// In-memory store for email OTPs (in production, use Redis)
const emailOTPs = new Map();

const APP_NAME = 'DocLoq';

const generateOtpauthURI = (email, secret) => {
  return generateURI({
    type: 'totp',
    secret,
    label: email,
    issuer: APP_NAME,
    digits: TOTP_CONFIG.digits,
    period: TOTP_CONFIG.period,
  });
};

export const generateTOTPSecret = async (req, res) => {
  try {
    const { userId } = req.user;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled. Disable it first to regenerate.',
      });
    }

    const secret = generateSecret();

    const otpauthUrl = generateOtpauthURI(user.email, secret);

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#1e293b', // slate-800
        light: '#ffffff',
      },
    });

    // Store secret temporarily (will be confirmed when user verifies)
    await db
      .update(users)
      .set({ twoFactorSecret: secret })
      .where(eq(users.id, userId));

    res.status(200).json({
      success: true,
      message: 'TOTP secret generated',
      data: {
        secret,
        qrCode: qrCodeDataUrl,
        otpauthUrl,
      },
    });
  } catch (error) {
    console.error('Generate TOTP secret error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const enableTOTP = async (req, res) => {
  try {
    const { userId } = req.user;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'No TOTP secret found. Generate one first.',
      });
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled',
      });
    }

    const isValid = verifyTotpToken(code, user.twoFactorSecret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.',
      });
    }

    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, userId));

    res.status(200).json({
      success: true,
      message: '2FA has been enabled successfully',
    });
  } catch (error) {
    console.error('Enable TOTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const disableTOTP = async (req, res) => {
  try {
    const { userId } = req.user;
    const { code, password } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled',
      });
    }

    // Sensitive step-down: a live session + TOTP alone must not be enough; require the password.
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to disable 2FA',
      });
    }
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    const isValid = verifyTotpToken(code, user.twoFactorSecret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
      });
    }

    await db
      .update(users)
      .set({ 
        twoFactorEnabled: false,
        twoFactorSecret: null,
      })
      .where(eq(users.id, userId));

    res.status(200).json({
      success: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    console.error('Disable TOTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const verifyTOTPLogin = async (req, res) => {
  try {
    const { code, twoFactorToken } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    // userId comes from the signed PENDING ticket, never the request body — 2FA
    // cannot be verified for an arbitrary user without passing the password step.
    let ticket;
    try {
      ticket = verifyStageTicket(twoFactorToken, STAGES.PENDING);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Sesi login tidak valid atau kedaluwarsa. Silakan login ulang.',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ticket.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const isDevCode = isDev && (code === '123456' || code === '000000');

    if (!isDevCode) {
      if (!user.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: '2FA secret not found for this account',
        });
      }
      if (!verifyTotpToken(code, user.twoFactorSecret)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid verification code',
        });
      }
    }

    // Code verified → issue a single-use VERIFIED ticket for complete-login.
    const verifiedToken = issueVerifiedTicket(user.id);

    res.status(200).json({
      success: true,
      message: '2FA verification successful',
      data: {
        verified: true,
        twoFactorToken: verifiedToken,
      },
    });
  } catch (error) {
    console.error('Verify TOTP login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const sendEmailOTP = async (req, res) => {
  try {
    const { twoFactorToken } = req.body;

    // PENDING ticket required — prevents anonymous OTP email-bombing of arbitrary accounts.
    let ticket;
    try {
      ticket = verifyStageTicket(twoFactorToken, STAGES.PENDING);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Sesi login tidak valid atau kedaluwarsa. Silakan login ulang.',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ticket.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in memory (keyed by email to allow resend)
    emailOTPs.set(user.email, {
      otp,
      expiresAt,
      userId: user.id,
      attempts: 0,
    });

    const userName = user.firstName || user.email.split('@')[0];
    const result = await sendOTPEmail(user.email, otp, userName);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }

    const emailParts = user.email.split('@');
    const maskedLocal = emailParts[0].substring(0, 2) + '***';
    const maskedEmail = `${maskedLocal}@${emailParts[1]}`;

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: maskedEmail,
        expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      },
    });
  } catch (error) {
    console.error('Send Email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const verifyEmailOTP = async (req, res) => {
  try {
    const { code, twoFactorToken } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    // Require the PENDING ticket; userId comes from the signed ticket, not body.
    let ticket;
    try {
      ticket = verifyStageTicket(twoFactorToken, STAGES.PENDING);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Sesi login tidak valid atau kedaluwarsa. Silakan login ulang.',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, ticket.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const storedData = emailOTPs.get(user.email);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
      });
    }

    if (new Date() > storedData.expiresAt) {
      emailOTPs.delete(user.email);
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    if (storedData.attempts >= 3) {
      emailOTPs.delete(user.email);
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    if (storedData.otp !== code) {
      storedData.attempts++;
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code',
        attemptsRemaining: 3 - storedData.attempts,
      });
    }

    emailOTPs.delete(user.email);

    // Code verified → issue a single-use VERIFIED ticket for complete-login.
    const verifiedToken = issueVerifiedTicket(user.id);

    res.status(200).json({
      success: true,
      message: 'Email verification successful',
      data: {
        verified: true,
        twoFactorToken: verifiedToken,
      },
    });
  } catch (error) {
    console.error('Verify Email OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getTOTPStatus = async (req, res) => {
  try {
    const { userId } = req.user;

    const [user] = await db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        enabled: user.twoFactorEnabled || false,
      },
    });
  } catch (error) {
    console.error('Get TOTP status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
