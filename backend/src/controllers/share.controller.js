// Public preview-only share endpoints.

import {
  createShare, listShares, revokeShare,
  ShareNotFoundError, ShareGoneError,
} from '../services/share.service.js';
import { getManifest, renderPage } from '../services/share-preview.service.js';

const mapError = (err, res) => {
  if (err instanceof ShareGoneError) return res.status(410).json({ success: false, code: 'SHARE_GONE', message: err.message });
  if (err instanceof ShareNotFoundError) return res.status(404).json({ success: false, code: 'SHARE_NOT_FOUND', message: err.message });
  if (err?.code === 'NOT_PREVIEWABLE') return res.status(415).json({ success: false, code: 'NOT_PREVIEWABLE', message: err.message });
  console.error('[share]', err);
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
};

const authedOrg = (req, res) => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!orgId || !userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return null; }
  return { orgId, userId };
};

// ── Authed (org member) ──────────────────────────────────────────────

export const createShareHandler = async (req, res) => {
  const auth = authedOrg(req, res); if (!auth) return;
  try {
    const { expiresInDays, maxViews } = req.body || {};
    const share = await createShare(req.params.id, auth.userId, auth.orgId, { expiresInDays, maxViews });
    return res.status(201).json({ success: true, data: share });
  } catch (err) { return mapError(err, res); }
};

export const listSharesHandler = async (req, res) => {
  const auth = authedOrg(req, res); if (!auth) return;
  try {
    const shares = await listShares(req.params.id, auth.orgId);
    return res.json({ success: true, data: shares });
  } catch (err) { return mapError(err, res); }
};

export const revokeShareHandler = async (req, res) => {
  const auth = authedOrg(req, res); if (!auth) return;
  try {
    await revokeShare(req.params.shareId, auth.orgId);
    return res.json({ success: true });
  } catch (err) { return mapError(err, res); }
};

// ── Public (no auth) ─────────────────────────────────────────────────

export const manifestHandler = async (req, res) => {
  try {
    const manifest = await getManifest(req.params.token);
    return res.json({ success: true, data: manifest });
  } catch (err) { return mapError(err, res); }
};

export const pageHandler = async (req, res) => {
  try {
    const png = await renderPage(req.params.token, req.params.n, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(png);
  } catch (err) { return mapError(err, res); }
};
