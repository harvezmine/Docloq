// Rate limiters for sensitive auth endpoints. Uses express-rate-limit's in-memory
// store (single-process). `trust proxy` is set in index.js, so req.ip is the real
// client IP behind the reverse proxy. Limits are env-tunable.

import rateLimit from 'express-rate-limit';

const minutes = (m) => m * 60 * 1000;
const num = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const WINDOW_MS = minutes(num(process.env.AUTH_RECOVERY_WINDOW_MIN, 15));

const tooMany = (req, res) =>
  res.status(429).json({
    success: false,
    message: 'Too many attempts. Please wait a few minutes and try again.',
  });

const base = (limit) => ({
  windowMs: WINDOW_MS,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany,
});

// Public: request a reset link. Tight — this is the email-bomb / enumeration surface.
export const forgotPasswordLimiter = rateLimit(base(num(process.env.AUTH_FORGOT_LIMIT, 5)));

// Public: submit a token + new password. A bit looser (user may retype).
export const resetPasswordLimiter = rateLimit(base(num(process.env.AUTH_RESET_LIMIT, 10)));

// Authenticated: change own password. Guards against session-hijack brute force.
export const changePasswordLimiter = rateLimit(base(num(process.env.AUTH_CHANGE_PASSWORD_LIMIT, 10)));

export default {
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
};
