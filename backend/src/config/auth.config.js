import 'dotenv/config';
import crypto from 'crypto';

// Falls back to a random secret if JWT_SECRET is unset — fine for dev, but sessions won't survive restarts
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(48).toString('base64url');
if (!process.env.JWT_SECRET) {
  console.warn('[Auth] JWT_SECRET not set — using random ephemeral secret (sessions reset on restart)');
}

export const authConfig = {
  jwt: {
    secret: jwtSecret,
    expiresIn: '12h', // absolute expiry
    refreshExpiresIn: '12h', // same as access token (single session)
    idleTimeout: 3 * 60 * 60 * 1000, // 3h, in ms
  },

  password: {
    saltRounds: 12,
    minLength: 8,
  },

  session: {
    maxAge: 12 * 60 * 60 * 1000, // 12h, in ms (absolute)
    idleTimeout: 3 * 60 * 60 * 1000, // 3h, in ms
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};

export default authConfig;
