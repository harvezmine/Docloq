// Google OAuth 2.0 Controller — invite-only, no auto-registration

import crypto from 'crypto';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';
import { getAuthUrl, exchangeCode } from '../services/google-oauth.service.js';
import { issueSession } from '../services/auth-session.service.js';
import { verifyTurnstile } from '../services/turnstile.service.js';

const FRONTEND = authConfig.google.frontendUrl;
const COOKIE_NAME = 'gstate';
const COOKIE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// GET /api/auth/google?captcha=<token>
export const initiateGoogleLogin = async (req, res) => {
  const token = req.query.captcha;
  try {
    await verifyTurnstile(token, req.ip);
  } catch (err) {
    console.warn('[Google OAuth] Turnstile reject:', err.message);
    return res.redirect(302, `${FRONTEND}/login?error=captcha_failed`);
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_TTL_MS,
    secure: process.env.NODE_ENV === 'production',
  });
  return res.redirect(302, getAuthUrl(state));
};

// GET /api/auth/google/callback — enforces the invite-only gate, NEVER inserts users
export const googleCallback = async (req, res) => {
  const redirectError = (code) =>
    res.redirect(302, `${FRONTEND}/login?error=${code}`);

  try {
    const { code, state } = req.query;

    console.log('[google-oauth] callback hit — code:', !!code, 'state:', state?.slice(0,8), 'cookie:', req.cookies?.[COOKIE_NAME]?.slice(0,8));

    // Validate code + CSRF state
    if (!code) { console.log('[google-oauth] missing code'); return redirectError('server_error'); }
    if (!state || state !== req.cookies?.[COOKIE_NAME]) {
      console.log('[google-oauth] state mismatch — query:', state?.slice(0,8), 'cookie:', req.cookies?.[COOKIE_NAME]?.slice(0,8));
      return redirectError('server_error');
    }

    res.clearCookie(COOKIE_NAME);

    let profile;
    try {
      profile = await exchangeCode(code);
      console.log('[google-oauth] profile email:', profile.email);
    } catch (e) {
      console.error('[google-oauth] exchangeCode failed:', e.message);
      return redirectError('server_error');
    }

    // Invite-only gate: unknown email = hard block, zero DB writes
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);

    if (!user) {
      return redirectError('unregistered_email');
    }

    if (!user.isActive) return redirectError('account_disabled');

    // Prevent one Google account hijacking a different DB email row
    if (user.googleId && user.googleId !== profile.googleId) {
      return redirectError('account_conflict');
    }

    // First-time Google login: link googleId + update login metadata
    if (!user.googleId) {
      await db.update(users).set({
        googleId: profile.googleId,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip || req.connection?.remoteAddress,
      }).where(eq(users.id, user.id));
    } else {
      await db.update(users).set({
        lastLoginAt: new Date(),
        lastLoginIp: req.ip || req.connection?.remoteAddress,
      }).where(eq(users.id, user.id));
    }

    // Issue JWT + session row (same mechanism as password login, 2FA skipped for OAuth)
    const { accessToken, refreshToken, expiresAt } = await issueSession(user, req);

    // Hand off tokens via URL hash — hash never sent to server in subsequent requests
    const successUrl = `${FRONTEND}/auth/google/success#accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&expiresAt=${encodeURIComponent(expiresAt.toISOString())}`;
    return res.redirect(302, successUrl);

  } catch (err) {
    console.error('[google-oauth] callback error:', err);
    return res.redirect(302, `${FRONTEND}/login?error=server_error`);
  }
};
