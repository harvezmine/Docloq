// Gates /api/superadmin/* via a shared X-Admin-Gate secret (constant-time compare) —
// intentionally simpler/weaker than OTP admin auth; consider migrating to authenticateAdmin.

import crypto from 'crypto';
import { db } from '../db/index.js';
import { organizations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const GATE_SECRET = process.env.ADMIN_GATE_SECRET || 'IndonesiaRaya';

export const requireAdminGate = (req, res, next) => {
  const provided = String(req.header('X-Admin-Gate') || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(GATE_SECRET);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// Toggleable per-tenant features (stored in organizations.settings.features).
export const FEATURE_KEYS = ['blockchain', 'verification', 'qr', 'aiAnalysis', 'doki', 'osint'];

// A flag is ON unless explicitly set to false — so existing tenants default to enabled.
export const isFeatureEnabled = (org, key) => org?.settings?.features?.[key] !== false;

// Resolve all flags to booleans for API responses.
export const resolveFeatures = (org) =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, isFeatureEnabled(org, k)]));

// Fail-open on infra error — don't lock tenants out over a transient DB hiccup.
export const requireFeature = (key) => async (req, res, next) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return next();
    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (org && !isFeatureEnabled(org, key)) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_DISABLED',
        message: 'Fitur ini dinonaktifkan untuk organisasi Anda oleh admin DocLoq.',
      });
    }
    next();
  } catch (err) {
    console.error('requireFeature error:', err.message);
    next();
  }
};
