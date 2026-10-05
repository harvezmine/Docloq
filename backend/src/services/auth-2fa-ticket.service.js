// Two-stage 2FA tickets (pending → verified short-lived JWTs, scope '2fa') so
// complete-login requires proof the 2FA step happened — closes the userId-only bypass.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import authConfig from '../config/auth.config.js';

const PENDING_TTL_SEC = 10 * 60; // 10 min to finish the 2FA step
const VERIFIED_TTL_SEC = 5 * 60; // 5 min to call complete-login

const STAGE_PENDING = 'pending';
const STAGE_VERIFIED = 'verified';

// In-memory single-use guard; back with Redis in multi-instance prod so a replay
// cannot land on a different replica.
const consumedJti = new Map(); // jti -> expiry epoch ms

const sweep = () => {
  const now = Date.now();
  for (const [jti, exp] of consumedJti) {
    if (exp <= now) consumedJti.delete(jti);
  }
};

const issue = (userId, stage, ttlSec) =>
  jwt.sign(
    { sub: userId, scope: '2fa', stage, jti: crypto.randomUUID() },
    authConfig.jwt.secret,
    { algorithm: 'HS256', expiresIn: ttlSec },
  );

export const issuePendingTicket = (userId) => issue(userId, STAGE_PENDING, PENDING_TTL_SEC);
export const issueVerifiedTicket = (userId) => issue(userId, STAGE_VERIFIED, VERIFIED_TTL_SEC);

// Returns { userId, jti }; throws INVALID_2FA_TICKET on any mismatch.
export const verifyStageTicket = (token, expectedStage) => {
  if (!token || typeof token !== 'string') throw new Error('INVALID_2FA_TICKET');
  let decoded;
  try {
    decoded = jwt.verify(token, authConfig.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    throw new Error('INVALID_2FA_TICKET');
  }
  if (decoded.scope !== '2fa' || decoded.stage !== expectedStage || !decoded.sub) {
    throw new Error('INVALID_2FA_TICKET');
  }
  return { userId: decoded.sub, jti: decoded.jti };
};

// Single-use consume; Node's single thread makes the check-then-set atomic per process.
export const consumeVerifiedTicket = (jti) => {
  sweep();
  if (!jti || consumedJti.has(jti)) return false;
  consumedJti.set(jti, Date.now() + VERIFIED_TTL_SEC * 1000);
  return true;
};

export const STAGES = { PENDING: STAGE_PENDING, VERIFIED: STAGE_VERIFIED };

export default {
  issuePendingTicket,
  issueVerifiedTicket,
  verifyStageTicket,
  consumeVerifiedTicket,
  STAGES,
};
