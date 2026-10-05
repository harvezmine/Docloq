// Shared session issuer used by both password login and Google OAuth flows.

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, userSessions, organizations } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';

export const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };

  const accessToken = jwt.sign(payload, authConfig.jwt.secret, {
    expiresIn: authConfig.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    authConfig.jwt.secret,
    { expiresIn: authConfig.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
};

// Issue a JWT pair + DB session row for an already-authenticated user.
export const issueSession = async (user, req) => {
  const { accessToken, refreshToken } = generateTokens(user);
  const expiresAt = new Date(Date.now() + authConfig.session.maxAge);

  await db.insert(userSessions).values({
    id: uuidv4(),
    userId: user.id,
    token: accessToken,
    refreshToken,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.connection?.remoteAddress,
    lastActivityAt: new Date(),
    expiresAt,
  });

  return { accessToken, refreshToken, expiresAt };
};

// Fetch organization info for a user (returns null if no org).
export const getUserOrganization = async (organizationId) => {
  if (!organizationId) return null;
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, companyCode: organizations.companyCode })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org || null;
};
