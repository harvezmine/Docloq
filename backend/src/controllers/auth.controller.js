import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, userSessions, organizations, securityEvents, passwordResetTokens } from '../db/schema.js';
import { eq, and, ne, desc, gt, isNull } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';
import { generateTokens, issueSession, getUserOrganization } from '../services/auth-session.service.js';
import { verifyTurnstile } from '../services/turnstile.service.js';
import { sendPasswordResetEmail, PASSWORD_RESET_EXPIRY_MINUTES } from '../services/email.service.js';
import {
  issuePendingTicket,
  verifyStageTicket,
  consumeVerifiedTicket,
  STAGES,
} from '../services/auth-2fa-ticket.service.js';
import { processImageToDataUrl, imageErrorMessage } from '../services/image-upload.service.js';

const generateCompanyCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(8)).map(b => chars[b % chars.length]).join('');
};

export const login = async (req, res) => {
  try {
    const { email, password, captchaToken, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    try {
      await verifyTurnstile(captchaToken, req.ip);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Captcha verification failed',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${remainingTime} minutes`,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Block login if the tenant (organization) is disabled by the platform admin
    if (user.organizationId) {
      const [org] = await db.select({ isActive: organizations.isActive })
        .from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
      if (org && org.isActive === false) {
        return res.status(403).json({ success: false, code: 'TENANT_DISABLED', message: 'Organisasi ini dinonaktifkan. Hubungi DocLoq.' });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData = { failedLoginAttempts: newAttempts };

      if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }

      await db.update(users).set(updateData).where(eq(users.id, user.id));

      if (newAttempts >= 5) {
        try {
          await db.insert(securityEvents).values({
            organizationId: user.organizationId || null,
            userId: user.id,
            eventType: 'brute_force',
            severity: 'high',
            description: `Account locked after ${newAttempts} failed login attempts`,
            details: { attempts: newAttempts, lockedUntil: updateData.lockedUntil },
            ipAddress: req.ip || req.connection?.remoteAddress || null,
          });
        } catch (e) { console.warn('[Auth] securityEvent log failed:', e.message); }
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        attemptsRemaining: Math.max(0, 5 - newAttempts),
      });
    }

    // 2FA is always required; generate a secret on the fly if the user has none yet
    if (!user.twoFactorSecret) {
      const { generateSecret } = await import('otplib');
      const tempSecret = generateSecret();
      await db.update(users).set({ twoFactorSecret: tempSecret }).where(eq(users.id, user.id));
    }

    // Ticket binds the 2FA step to this password check, so complete-login can't be called with a bare userId
    const twoFactorToken = issuePendingTicket(user.id);

    return res.status(200).json({
      success: true,
      message: 'Password verified. 2FA verification required.',
      data: {
        requires2FA: true,
        userId: user.id,
        email: user.email,
        twoFactorToken,
      },
    });

    // Unreachable: kept only for when 2FA is no longer always-required
    await db.update(users).set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || req.connection.remoteAddress,
    }).where(eq(users.id, user.id));

    const { accessToken, refreshToken } = generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 30 : 7));

    await db.insert(userSessions).values({
      id: uuidv4(),
      userId: user.id,
      token: accessToken,
      refreshToken: refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      expiresAt: expiresAt,
    });

    let organization = null;
    if (user.organizationId) {
      [organization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
    }

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          ...safeUser,
          organization,
        },
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const completeLogin = async (req, res) => {
  try {
    const { rememberMe, twoFactorToken } = req.body;

    // Requires a VERIFIED ticket — the only proof password + 2FA were both checked (avoids auth bypass)
    let ticket;
    try {
      ticket = verifyStageTicket(twoFactorToken, STAGES.VERIFIED);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Sesi verifikasi 2FA tidak valid atau kedaluwarsa. Silakan login ulang.',
      });
    }

    // Single-use: a verified ticket can mint exactly one session.
    if (!consumeVerifiedTicket(ticket.jti)) {
      return res.status(401).json({
        success: false,
        message: 'Sesi verifikasi 2FA sudah dipakai. Silakan login ulang.',
      });
    }

    const userId = ticket.userId;

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

    // Defense-in-depth: never complete login for a locked or deactivated account
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account is locked. Please try again later.',
      });
    }

    // Block if the tenant (organization) is disabled by the platform admin
    if (user.organizationId) {
      const [org] = await db.select({ isActive: organizations.isActive })
        .from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);
      if (org && org.isActive === false) {
        return res.status(403).json({ success: false, code: 'TENANT_DISABLED', message: 'Organisasi ini dinonaktifkan. Hubungi DocLoq.' });
      }
    }

    await db.update(users).set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || req.connection?.remoteAddress,
    }).where(eq(users.id, user.id));

    const { accessToken, refreshToken, expiresAt } = await issueSession(user, req);
    const organization = await getUserOrganization(user.organizationId);

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...safeUser, organization },
        accessToken,
        refreshToken,
        expiresAt,
        idleTimeout: authConfig.session.idleTimeout,
      },
    });
  } catch (error) {
    console.error('Complete login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, companyCode, captchaToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Tenant assignment is mandatory — no null-org accounts, or unrelated users could share a document pool
    if (!companyName && !companyCode) {
      return res.status(400).json({
        success: false,
        message: 'Isi nama perusahaan (buat baru) atau kode perusahaan (gabung perusahaan)',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    // Only verify captcha when a token is supplied — public signup sends one, admin tenant-provisioning doesn't
    if (captchaToken) {
      try {
        await verifyTurnstile(captchaToken, req.ip);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Captcha verification failed',
        });
      }
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, authConfig.password.saltRounds);

    let organizationId;
    let isNewOrgAdmin = false;
    let orgCompanyCode = null;

    if (companyName) {
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Generate unique company code with retry on collision
      let generatedCode;
      let codeAttempts = 0;
      while (codeAttempts < 5) {
        const candidate = generateCompanyCode();
        const [existing] = await db.select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.companyCode, candidate))
          .limit(1);
        if (!existing) { generatedCode = candidate; break; }
        codeAttempts++;
      }
      if (!generatedCode) generatedCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

      const [newOrg] = await db.insert(organizations).values({
        id: uuidv4(),
        name: companyName,
        slug: `${slug}-${Date.now()}`,
        companyCode: generatedCode,
      }).returning();

      organizationId = newOrg.id;
      isNewOrgAdmin = true;
      orgCompanyCode = generatedCode;
    } else {
      const normalizedCode = String(companyCode).trim().toUpperCase();
      const [org] = await db.select({ id: organizations.id, companyCode: organizations.companyCode })
        .from(organizations)
        .where(eq(organizations.companyCode, normalizedCode))
        .limit(1);
      if (!org) {
        return res.status(400).json({
          success: false,
          message: 'Kode perusahaan tidak valid',
        });
      }
      organizationId = org.id;
      orgCompanyCode = org.companyCode;
    }

    const [newUser] = await db.insert(users).values({
      id: uuidv4(),
      organizationId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: isNewOrgAdmin ? 'owner' : 'user', // Founder of a new org is the owner; joiners are users
      isActive: true,
      isEmailVerified: false, // Will need email verification in production
    }).returning();

    const { accessToken, refreshToken } = generateTokens(newUser);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(userSessions).values({
      id: uuidv4(),
      userId: newUser.id,
      token: accessToken,
      refreshToken: refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      expiresAt: expiresAt,
    });

    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: safeUser,
        companyCode: orgCompanyCode,
        accessToken,
        refreshToken,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await db.delete(userSessions).where(eq(userSessions.token, token));
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
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

    let organization = null;
    if (user.organizationId) {
      [organization] = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          subscriptionTier: organizations.subscriptionTier,
        })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
    }

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...safeUser,
          organization,
        },
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.jwt.secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
    }

    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.refreshToken, token))
      .limit(1);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session not found',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.update(userSessions)
      .set({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiresAt,
      })
      .where(eq(userSessions.id, session.id));

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Updates only safe self-editable fields; role/email/organizationId/isActive can't be changed here
export const updateMe = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { firstName, lastName, phone, position, departmentId } = req.body || {};
    const updateData = { updatedAt: new Date() };
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (position !== undefined) updateData.position = position;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        position: users.position,
        departmentId: users.departmentId,
        role: users.role,
        avatarUrl: users.avatarUrl,
      });

    res.status(200).json({ success: true, message: 'Profile updated', data: { user: updated } });
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Avatar upload: multer (memory) hands us the raw buffer; the pipeline sniffs magic
// bytes and re-encodes to WebP, so nothing user-supplied survives into the stored value.
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: imageErrorMessage('EMPTY_FILE') });
    }

    let dataUrl;
    try {
      dataUrl = await processImageToDataUrl(req.file.buffer, 'avatar');
    } catch (e) {
      return res.status(400).json({ success: false, message: imageErrorMessage(e.code) });
    }

    const [updated] = await db
      .update(users)
      .set({ avatarUrl: dataUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, avatarUrl: users.avatarUrl });

    res.status(200).json({ success: true, message: 'Avatar updated', data: { avatarUrl: updated.avatarUrl } });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.status(200).json({ success: true, message: 'Avatar removed', data: { avatarUrl: null } });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const currentToken = (req) =>
  req.headers.authorization?.replace('Bearer ', '') || req.query?._t || null;

export const listSessions = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const token = currentToken(req);
    const rows = await db
      .select({
        id: userSessions.id,
        userAgent: userSessions.userAgent,
        ipAddress: userSessions.ipAddress,
        lastActivityAt: userSessions.lastActivityAt,
        createdAt: userSessions.createdAt,
        expiresAt: userSessions.expiresAt,
        token: userSessions.token,
      })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.lastActivityAt));

    const sessions = rows.map(({ token: t, ...s }) => ({
      ...s,
      current: !!token && t === token, // never expose the token itself
    }));

    res.status(200).json({ success: true, data: { sessions } });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;

    // Ownership enforced: row must match both this id and this user
    const deleted = await db
      .delete(userSessions)
      .where(and(eq(userSessions.id, id), eq(userSessions.userId, userId)))
      .returning({ id: userSessions.id });

    if (deleted.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.status(200).json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const revokeOtherSessions = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = currentToken(req);

    const conds = [eq(userSessions.userId, userId)];
    if (token) conds.push(ne(userSessions.token, token)); // keep the current session

    await db.delete(userSessions).where(and(...conds));
    res.status(200).json({ success: true, message: 'Signed out of other devices' });
  } catch (error) {
    console.error('Revoke other sessions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Reset tokens are stored HASHED — a DB leak never yields a usable link.
const hashResetToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

// Self-service password change (authenticated). Verifies the current password,
// rotates the hash, then signs out every OTHER device (current session kept).
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < authConfig.password.minLength) {
      return res.status(400).json({ success: false, message: `Password must be at least ${authConfig.password.minLength} characters` });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (sameAsOld) return res.status(400).json({ success: false, message: 'New password must be different from the current password' });

    const passwordHash = await bcrypt.hash(newPassword, authConfig.password.saltRounds);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    // Keep the caller signed in; drop every other device
    const token = currentToken(req);
    const conds = [eq(userSessions.userId, user.id)];
    if (token) conds.push(ne(userSessions.token, token));
    await db.delete(userSessions).where(and(...conds));

    res.status(200).json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Public. ALWAYS returns a generic 200 so the response can't be used to probe
// which emails are registered (user-enumeration defense).
export const forgotPassword = async (req, res) => {
  const generic = { success: true, message: 'If that email is registered, a password reset link has been sent.' };
  try {
    const { email, captchaToken } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Optional captcha — the public form sends one; verify only when supplied
    if (captchaToken) {
      try { await verifyTurnstile(captchaToken, req.ip); }
      catch { return res.status(400).json({ success: false, message: 'Captcha verification failed' }); }
    }

    const [user] = await db.select().from(users)
      .where(eq(users.email, String(email).toLowerCase())).limit(1);

    if (!user || !user.isActive) return res.status(200).json(generic);

    // One live token per user — clear any prior unused ones first
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);
    await db.insert(passwordResetTokens).values({
      id: uuidv4(),
      userId: user.id,
      token: hashResetToken(rawToken),
      expiresAt,
    });

    const frontendUrl = process.env.FRONTEND_URL || authConfig.google.frontendUrl || 'http://localhost:5173';
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

    await sendPasswordResetEmail(user.email, resetUrl, displayName);
    return res.status(200).json(generic);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Stay generic even on failure — never leak internal state
    return res.status(200).json(generic);
  }
};

// Public. Consumes a single-use, unexpired reset token, rotates the password,
// and invalidates every session so the account is forced to re-login everywhere.
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    if (password.length < authConfig.password.minLength) {
      return res.status(400).json({ success: false, message: `Password must be at least ${authConfig.password.minLength} characters` });
    }

    const invalid = { success: false, message: 'This reset link is invalid or has expired. Please request a new one.' };
    const [row] = await db.select().from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, hashResetToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      )).limit(1);
    if (!row) return res.status(400).json(invalid);

    const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user || !user.isActive) return res.status(400).json(invalid);

    const passwordHash = await bcrypt.hash(password, authConfig.password.saltRounds);
    await db.update(users).set({
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await db.delete(userSessions).where(eq(userSessions.userId, user.id));

    res.status(200).json({ success: true, message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  login,
  register,
  logout,
  getMe,
  refreshToken,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSession,
  revokeOtherSessions,
};
