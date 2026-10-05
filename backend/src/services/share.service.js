// Public preview-only sharing: link holders get only watermarked page images —
// no login, download, or edit (rendering in share-preview.service.js).

import crypto from 'crypto';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents, documentShares, documentShareAccess } from '../db/schema.js';

// Typed errors → controller maps to HTTP status.
export class ShareNotFoundError extends Error { constructor(m = 'Share tidak ditemukan') { super(m); this.code = 'SHARE_NOT_FOUND'; } }
export class ShareGoneError extends Error { constructor(m = 'Link tidak berlaku lagi') { super(m); this.code = 'SHARE_GONE'; } }

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const generateShareToken = () => crypto.randomBytes(32).toString('base64url');

export const computeExpiry = (expiresInDays) => {
  if (expiresInDays === null || expiresInDays === undefined) return null; // "no expiry"
  const days = Number(expiresInDays);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

export const createShare = async (documentId, userId, orgId, { expiresInDays = 7, maxViews = null } = {}) => {
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
  if (!doc) throw new ShareNotFoundError('Dokumen tidak ditemukan');

  const shareToken = generateShareToken();
  const shareUrl = `${FRONTEND_URL.replace(/\/$/, '')}/share/${shareToken}`;
  const expiresAt = computeExpiry(expiresInDays);
  const cleanMaxViews = (maxViews && Number(maxViews) > 0) ? Math.floor(Number(maxViews)) : null;

  const [row] = await db.insert(documentShares).values({
    documentId,
    shareType: 'view_only',
    shareToken,
    shareUrl,
    requireAuth: false,       // public preview link
    allowedEmails: null,
    maxViews: cleanMaxViews,
    viewCount: 0,
    expiresAt,
    createdBy: userId,
    isActive: true,
  }).returning();

  return { id: row.id, shareToken, shareUrl, expiresAt, maxViews: cleanMaxViews };
};

/** List shares for a document (org-scoped). */
export const listShares = async (documentId, orgId) => {
  const [doc] = await db.select({ id: documents.id }).from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
  if (!doc) throw new ShareNotFoundError('Dokumen tidak ditemukan');

  const rows = await db.select({
    id: documentShares.id,
    shareToken: documentShares.shareToken,
    shareUrl: documentShares.shareUrl,
    maxViews: documentShares.maxViews,
    viewCount: documentShares.viewCount,
    expiresAt: documentShares.expiresAt,
    isActive: documentShares.isActive,
    createdAt: documentShares.createdAt,
  }).from(documentShares)
    .where(eq(documentShares.documentId, documentId))
    .orderBy(desc(documentShares.createdAt));

  return rows.map((r) => ({ ...r, status: shareStatus(r) }));
};

/** Revoke a share (org-scoped via its document). */
export const revokeShare = async (shareId, orgId) => {
  const [row] = await db.select({ id: documentShares.id, documentId: documentShares.documentId })
    .from(documentShares)
    .innerJoin(documents, eq(documentShares.documentId, documents.id))
    .where(and(eq(documentShares.id, shareId), eq(documents.organizationId, orgId)));
  if (!row) throw new ShareNotFoundError();

  await db.update(documentShares).set({ isActive: false }).where(eq(documentShares.id, shareId));
  return { id: shareId, revoked: true };
};

const isExpired = (s) => s.expiresAt && new Date(s.expiresAt) <= new Date();
const isOverLimit = (s) => s.maxViews != null && (s.viewCount || 0) >= s.maxViews;
const shareStatus = (s) => {
  if (!s.isActive) return 'revoked';
  if (isExpired(s)) return 'expired';
  if (isOverLimit(s)) return 'exhausted';
  return 'active';
};

// Throws ShareGoneError (→410) or ShareNotFoundError (→404).
export const resolveShare = async (token) => {
  if (!token || typeof token !== 'string') throw new ShareNotFoundError();

  const [share] = await db.select().from(documentShares).where(eq(documentShares.shareToken, token));
  if (!share) throw new ShareNotFoundError();
  if (!share.isActive) throw new ShareGoneError('Link sudah dicabut');
  if (isExpired(share)) throw new ShareGoneError('Link sudah kedaluwarsa');
  if (isOverLimit(share)) throw new ShareGoneError('Batas jumlah lihat sudah tercapai');

  const [doc] = await db.select().from(documents).where(eq(documents.id, share.documentId)); // public share: doc resolved via signed token, no org context
  if (!doc || doc.status === 'deleted' || doc.deletedAt) throw new ShareNotFoundError('Dokumen sudah tidak tersedia');

  return { share, doc };
};

/** Record one access + bump viewCount. Fire-and-forget friendly. */
export const recordAccess = async (shareId, ip, userAgent) => {
  await db.insert(documentShareAccess).values({ shareId, ipAddress: ip || null, userAgent: userAgent || null });
  await db.update(documentShares)
    .set({ viewCount: sql`${documentShares.viewCount} + 1` })
    .where(eq(documentShares.id, shareId));
};

export { shareStatus };
