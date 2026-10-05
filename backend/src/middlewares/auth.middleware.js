import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users, userSessions } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';

export const authenticate = async (req, res, next) => {
  try {
    // Also accept ?_t= query token — sendBeacon requests can't set headers.
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else if (req.query?._t) {
      token = req.query._t;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    // Verify token (checks absolute expiry via JWT exp claim)
    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    const [session] = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.token, token),
          gt(userSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
        code: 'SESSION_INVALID',
      });
    }

    const idleTimeout = authConfig.session.idleTimeout || 3 * 60 * 60 * 1000;
    const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt) : new Date(session.createdAt);
    const idleMs = Date.now() - lastActivity.getTime();

    if (idleMs > idleTimeout) {
      await db.delete(userSessions).where(eq(userSessions.id, session.id));
      return res.status(401).json({
        success: false,
        message: 'Session expired due to inactivity',
        code: 'IDLE_TIMEOUT',
      });
    }

    // Update last activity timestamp (non-blocking)
    db.update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.id, session.id))
      .then(() => {})
      .catch(() => {});

    // Attach user info to request — normalise id/userId so controllers can use either
    req.user = { ...decoded, id: decoded.userId };
    req.sessionId = session.id;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const authorize = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, authConfig.jwt.secret);
      req.user = { ...decoded, id: decoded.userId };
    } catch (err) {
      // Token invalid, continue without user
    }

    next();
  } catch (error) {
    next();
  }
};

export default {
  authenticate,
  authorize,
  optionalAuth,
};
