// Google OAuth 2.0 helper — URL generation + code exchange + id_token verification

import { OAuth2Client } from 'google-auth-library';
import authConfig from '../config/auth.config.js';

const client = new OAuth2Client(
  authConfig.google.clientId,
  authConfig.google.clientSecret,
  authConfig.google.callbackUrl
);

// Build Google consent URL with CSRF state param.
export const getAuthUrl = (state) => {
  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile'],
    prompt: 'select_account',
    state,
    redirect_uri: authConfig.google.callbackUrl,
  });
};

// Exchange authorization code → verify id_token → return profile; throws if invalid/unverified.
export const exchangeCode = async (code) => {
  const { tokens } = await client.getToken(code);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: authConfig.google.clientId,
  });

  const payload = ticket.getPayload();

  if (!payload.email_verified) {
    throw new Error('Google email not verified');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    firstName: payload.given_name || null,
    lastName: payload.family_name || null,
    avatarUrl: payload.picture || null,
  };
};
