import { db } from '../db/index.js';
import {
  documents,
  documentVersions,
  documentQrCodes,
  trashItems,
  documentPermissions,
  verificationRequests,
  blockchainAnchors,
} from '../db/schema.js';
import { eq, desc, and, isNull, inArray } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import crypto, { randomUUID } from 'crypto';

import { uploadPipeline } from '../services/upload-pipeline.service.js';
import { downloadFile, uploadFile } from '../services/storage.service.js';
import { decryptFile, encryptFile as encryptFileService, generateDocumentKey } from '../services/encryption.service.js';
import { isPqcEnabled, createHybridDocumentKey } from '../services/pqc.service.js';
import { verifyQRPayload, supersedeAndRegenerateQR } from '../services/qrcode.service.js';
import { generateSHA256, normalizeText, generateDocumentDNA } from '../services/hash.service.js';
import { extractText } from '../services/upload-pipeline.service.js';
import {
  findByContentHash,
  findBySimHash,
  decodeQrFromBuffer,
  computeUploadDNA,
  enrichDocument,
  resolveBlockchainVerdict,
  decideFileVerdict,
  explorerTxUrl,
} from '../services/verification.service.js';
import { renderVerificationPreview } from '../services/share-preview.service.js';
import { appendAuditEntry } from '../services/audit.service.js';
import { convertDocument, downloadFromUrl } from '../services/conversion.service.js';
import { getAllUserPermissions, getUserPermissionLevel } from '../middlewares/permission.middleware.js';
import { tasks, downloadWatermarks } from '../db/schema.js';
import { injectDownloadWatermark, hashPayload } from '../services/download-watermark.service.js';
import { watermarkBuffer, stampVisibleCode, stampQrCode } from '../services/document-rewriter.service.js';
import { generateDocCode, generateDownloadCode, formatVisibleCode } from '../services/tracking-code.service.js';
import uploadConfig from '../config/upload.config.js';

/** Doc-settings toggles (tracking, qr-on-download): creator, admin, or org owner — same org. */
export function canManageDocSettings(user, doc) {
  if (!user || !doc) return false;
  if (user.organizationId !== doc.organizationId) return false;
  return user.role === 'owner' || user.role === 'admin' || user.id === doc.ownerId;
}

export const canToggleTracking = canManageDocSettings;

export async function toggleDocumentTracking(req, res) {
  try {
    const { id } = req.params;
    const enabled = !!req.body?.enabled;

    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.deletedAt) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (!canManageDocSettings(req.user, doc)) {
      return res.status(403).json({ success: false, message: 'Not allowed to change tracking for this document' });
    }

    const patch = { trackingEnabled: enabled, updatedAt: new Date() };
    if (enabled && !doc.trackingCode) {
      patch.trackingCode = generateDocCode();
    }
    await db.update(documents).set(patch).where(eq(documents.id, id));

    return res.json({
      success: true,
      data: { id, trackingEnabled: enabled, trackingCode: patch.trackingCode || doc.trackingCode || null },
    });
  } catch (err) {
    console.error('[Tracking] toggle error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function toggleQrOnDownload(req, res) {
  try {
    const { id } = req.params;
    const enabled = !!req.body?.enabled;
    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.deletedAt) return res.status(404).json({ success: false, message: 'Document not found' });
    if (!canManageDocSettings(req.user, doc)) return res.status(403).json({ success: false, message: 'Not allowed' });
    await db.update(documents).set({ qrOnDownload: enabled, updatedAt: new Date() }).where(eq(documents.id, id));
    return res.json({ success: true, data: { id, qrOnDownload: enabled } });
  } catch (err) {
    console.error('[QR] toggle error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// OnlyOffice can't send JWT headers, so signed short-lived tokens ride as query params.
// Secret is per-process when ONLYOFFICE_SECRET is unset.
const OO_SECRET = process.env.ONLYOFFICE_SECRET || crypto.randomBytes(32).toString('hex');

export function generateOOToken(documentId) {
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${documentId}:${expires}`;
  const signature = crypto.createHmac('sha256', OO_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
}

// Hybrid PQC key-wrap when enabled, but a PQC error must never break a save —
// fall back to v1 (mirrors the upload pipeline).
const deriveNewVersionKey = async (organizationId) => {
  if (isPqcEnabled()) {
    try {
      return await createHybridDocumentKey(organizationId);
    } catch (err) {
      console.warn('[PQC] edit/save hybrid wrap failed, falling back to v1:', err.message);
    }
  }
  return generateDocumentKey();
};

function verifyOOToken(token, documentId) {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const [docId, expires, signature] = parts;
  if (docId !== documentId) return false;
  if (Date.now() > parseInt(expires, 10)) return false;
  const expected = crypto.createHmac('sha256', OO_SECRET).update(`${docId}:${expires}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

// Legacy plain-file upload dir (pre-encryption pipeline)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const ensureUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
};

export const getAllDocuments = async (req, res) => {
  try {
    // Tenant isolation at the DB layer so edge cases can't leak cross-org.
    const userId = req.user?.userId || req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allDocs = await db.select().from(documents)
      .where(and(isNull(documents.deletedAt), eq(documents.organizationId, organizationId)))
      .orderBy(desc(documents.createdAt));

    // Within the org, non-admins are further filtered by per-document/folder permission.
    if (userId && organizationId) {
      const { hasFullAccess, permissions } = await getAllUserPermissions(userId, organizationId);

      if (!hasFullAccess) {
        const userTasks = await db
          .select({ relatedDocumentId: tasks.relatedDocumentId })
          .from(tasks)
          .where(
            and(
              eq(tasks.assignedTo, userId),
              inArray(tasks.status, ['in_progress', 'pending'])
            )
          );
        const taskDocIds = new Set(userTasks.map(t => t.relatedDocumentId).filter(Boolean));

        const filteredDocs = allDocs.filter((doc) => {
          const docKey = `document:${doc.id}`;
          if (permissions[docKey] && permissions[docKey] !== 'none') return true;

          if (doc.folderId) {
            const folderKey = `folder:${doc.folderId}`;
            if (permissions[folderKey] && permissions[folderKey] !== 'none') return true;
          }

          if (doc.ownerId === userId) return true;

          if (taskDocIds.has(doc.id)) return true;

          return false;
        });

        return res.json({
          success: true,
          data: filteredDocs,
        });
      }
    }
    
    res.json({
      success: true,
      data: allDocs,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
    });
  }
};

export const getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    const userId = req.user?.userId || req.user?.id;
    const organizationId = req.user?.organizationId;

    if (userId && organizationId) {
      if (doc.ownerId !== userId) {
        const permLevel = await getUserPermissionLevel(userId, 'document', id, organizationId);
        if (permLevel === 'none') {
          const [userTask] = await db
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.assignedTo, userId),
                eq(tasks.relatedDocumentId, id),
                inArray(tasks.status, ['in_progress', 'pending'])
              )
            )
            .limit(1);

          if (!userTask) {
            return res.status(403).json({
              success: false,
              message: 'You do not have permission to access this document',
            });
          }
        }
      }
    }
    
    let qrCode = null;
    try {
      const [qr] = await db
        .select()
        .from(documentQrCodes)
        .where(and(eq(documentQrCodes.documentId, id), eq(documentQrCodes.isActive, true)))
        .orderBy(desc(documentQrCodes.createdAt))
        .limit(1);
      if (qr) {
        qrCode = {
          shortCode: qr.shortCode,
          verificationUrl: qr.verificationUrl,
          hasQrImage: !!qr.qrImageS3Key,
          scanCount: qr.scanCount || 0,
          lastScannedAt: qr.lastScannedAt,
          createdAt: qr.createdAt,
        };
      }
    } catch (err) {
      console.warn('[getDocument] QR lookup failed:', err.message);
    }

    let blockchainAnchor = null;
    try {
      const [a] = await db
        .select()
        .from(blockchainAnchors)
        .where(eq(blockchainAnchors.documentId, id))
        .orderBy(desc(blockchainAnchors.createdAt))
        .limit(1);
      if (a) {
        blockchainAnchor = {
          id: a.id,
          network: a.blockchainNetwork,
          txHash: a.transactionHash,
          blockNumber: a.blockNumber,
          status: a.status,
          anchoredAt: a.blockTimestamp || a.confirmedAt || a.createdAt,
        };
      }
    } catch (err) {
      console.warn('[getDocument] anchor lookup failed:', err.message);
    }

    res.json({
      success: true,
      data: { ...doc, qrCode, blockchainAnchor },
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document',
    });
  }
};

// Mirrors getDocument's permission logic so download/convert endpoints can't bypass access control.
const assertDocumentAccess = async (req, doc) => {
  const userId = req.user?.userId || req.user?.id;
  const organizationId = req.user?.organizationId;
  // Public/no-auth contexts (e.g. OnlyOffice oo_token paths) are handled by their own guards.
  if (!userId || !organizationId) return { ok: true };
  if (doc.ownerId === userId) return { ok: true };

  const permLevel = await getUserPermissionLevel(userId, 'document', doc.id, organizationId);
  if (permLevel && permLevel !== 'none') return { ok: true };

  const [userTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(
      eq(tasks.assignedTo, userId),
      eq(tasks.relatedDocumentId, doc.id),
      inArray(tasks.status, ['in_progress', 'pending']),
    ))
    .limit(1);
  if (userTask) return { ok: true };

  return { ok: false, status: 403, message: 'You do not have permission to access this document' };
};

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const folderId = req.body?.folderId || null;

    if (!userId || !organizationId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await uploadPipeline(req.file, userId, organizationId, folderId);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.message,
        warnings: result.warnings,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: result.data,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload document',
    });
  }
};

// ============================================================
// Upload simple — now routes through the FULL security pipeline
// Supports ?convertToDocx=true to auto-convert PDF uploads to DOCX
// ============================================================
export const uploadDocumentSimple = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    let fileObj = { ...req.file };
    const convertToDocx = req.query.convertToDocx === 'true' || req.body.convertToDocx === 'true';

    // PDF → DOCX conversion if requested
    if (convertToDocx && (fileObj.mimetype === 'application/pdf' || path.extname(fileObj.originalname).toLowerCase() === '.pdf')) {
      console.log('[UploadSimple] Converting PDF to DOCX...');

      await ensureUploadDir();
      const tempFilename = `temp_${randomUUID()}.pdf`;
      const tempPath = path.join(UPLOAD_DIR, tempFilename);
      await fs.writeFile(tempPath, fileObj.buffer);

      try {
        const backendUrlDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
        const tempFileUrl = `${backendUrlDocker}/uploads/${tempFilename}`;

        const { url: convertedUrl } = await convertDocument(tempFileUrl, 'pdf', 'docx');
        const convertedBuffer = await downloadFromUrl(convertedUrl);
        fileObj = {
          ...fileObj,
          buffer: convertedBuffer,
          size: convertedBuffer.length,
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          originalname: fileObj.originalname.replace(/\.pdf$/i, '.docx'),
        };
        console.log('[UploadSimple] PDF→DOCX conversion successful');
      } finally {
        try { await fs.unlink(tempPath); } catch {}
      }
    }

    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const folderId = req.body?.folderId || null;

    if (!userId || !organizationId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Run the FULL 14-step security pipeline (encryption, hashing, scan, honeytokens, QR)
    const result = await uploadPipeline(fileObj, userId, organizationId, folderId);

    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.message,
        warnings: result.warnings,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: result.data,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Simple upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Serve document file (for OnlyOffice) — handles both legacy and encrypted pipeline files
export const serveDocument = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify OnlyOffice token or user auth (bearer token via optionalAuth)
    const ooToken = req.query.oo_token;
    if (!req.user && !verifyOOToken(ooToken, id)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Enforce per-document/folder grants for authenticated users. The OnlyOffice
    // server fetches this with no user session (already verified via oo_token above),
    // which assertDocumentAccess intentionally lets through.
    const fileAccess = await assertDocumentAccess(req, doc);
    if (!fileAccess.ok) {
      return res.status(fileAccess.status).json({ success: false, message: fileAccess.message });
    }

    // ── Strategy 1: Pipeline-encrypted file (has a version with encryption data) ──
    if (doc.currentVersionId) {
      try {
        const [version] = await db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.id, doc.currentVersionId));

        if (version && version.encryptionKeyId && version.encryptionIv && version.s3Key) {
          // Read encrypted file from storage/documents/
          const encryptedBuffer = await downloadFile(version.s3Key);

          // Read authTag from sidecar meta.json
          let authTag = null;
          try {
            const metaBuffer = await downloadFile(`${version.s3Key}.meta.json`);
            const meta = JSON.parse(metaBuffer.toString());
            authTag = meta.authTag;
          } catch {
            // Try direct path as fallback
            const metaPath = path.join(process.cwd(), 'storage', 'documents', `${version.s3Key}.meta.json`);
            try {
              const metaRaw = await fs.readFile(metaPath, 'utf-8');
              const meta = JSON.parse(metaRaw);
              authTag = meta.authTag;
            } catch { /* no meta file */ }
          }

          if (authTag) {
            const decryptedBuffer = await decryptFile(
              encryptedBuffer,
              version.encryptionKeyId,
              version.encryptionIv,
              authTag,
              version,
            );

            res.setHeader('Content-Type', doc.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
            return res.send(prependUtf8BomIfText(decryptedBuffer, doc.originalFilename));
          }
        }
      } catch (err) {
        console.warn('Encrypted serve failed, falling back to legacy:', err.message);
      }
    }

    // ── Strategy 2: Legacy plain file in uploads/ ──
    const legacyPath = path.join(UPLOAD_DIR, doc.filename);
    try {
      await fs.access(legacyPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk',
      });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);

    const fileBuffer = await fs.readFile(legacyPath);
    res.send(prependUtf8BomIfText(fileBuffer, doc.originalFilename));
  } catch (error) {
    console.error('Serve document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve document',
    });
  }
};

// Download document (handles both legacy and encrypted pipeline files)
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // ── Pipeline-encrypted file ──
    if (doc.currentVersionId) {
      try {
        const [version] = await db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.id, doc.currentVersionId));

        if (version && version.encryptionKeyId && version.encryptionIv && version.s3Key) {
          const encryptedBuffer = await downloadFile(version.s3Key);

          let authTag = null;
          try {
            const metaBuffer = await downloadFile(`${version.s3Key}.meta.json`);
            const meta = JSON.parse(metaBuffer.toString());
            authTag = meta.authTag;
          } catch {
            const metaPath = path.join(process.cwd(), 'storage', 'documents', `${version.s3Key}.meta.json`);
            try {
              const metaRaw = await fs.readFile(metaPath, 'utf-8');
              authTag = JSON.parse(metaRaw).authTag;
            } catch { /* no meta */ }
          }

          if (authTag) {
            const decryptedBuffer = await decryptFile(
              encryptedBuffer,
              version.encryptionKeyId,
              version.encryptionIv,
              authTag,
              version,
            );

            res.setHeader('Content-Type', doc.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
            return res.send(decryptedBuffer);
          }
        }
      } catch (err) {
        console.warn('Encrypted download failed, falling back to legacy:', err.message);
      }
    }

    // ── Legacy plain file ──
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk',
      });
    }

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download document',
    });
  }
};

// Delete document (handles both legacy and encrypted pipeline files)
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const orgId = req.user.organizationId;
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    let userId = req.user?.id || null;
    // Fallback: resolve user when no auth (dev mode)
    if (!userId) {
      try {
        const { users } = await import('../db/schema.js');
        const [firstUser] = await db.select().from(users).limit(1);
        if (firstUser) userId = firstUser.id;
      } catch { /* ok */ }
    }
    const now = new Date();
    const autoDeleteDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Soft-delete: mark document as deleted
    await db.update(documents).set({
      deletedAt: now,
      deletedBy: userId,
      status: 'deleted',
      updatedAt: now,
    }).where(eq(documents.id, id));

    // Insert into trash_items for tracking
    await db.insert(trashItems).values({
      organizationId: orgId,
      itemType: 'document',
      itemId: id,
      originalFolderId: doc.folderId,
      originalPath: doc.originalFilename,
      itemMetadata: {
        originalFilename: doc.originalFilename,
        filename: doc.filename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        ownerId: doc.ownerId,
      },
      autoDeleteAt: autoDeleteDate,
      deletedBy: userId,
      deletedAt: now,
    });

    res.json({
      success: true,
      message: 'Document moved to trash',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
    });
  }
};

// Get OnlyOffice config for viewing/editing
export const getOnlyOfficeConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { mode: requestedMode = 'view', theme = 'light', bandwidth = 'normal' } = req.query;

    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Only an owner / grantee / active-task assignee may open the editor — otherwise a
    // same-org non-grantee could obtain a session (and a signed /file oo_token).
    const ooAccess = await assertDocumentAccess(req, doc);
    if (!ooAccess.ok) {
      return res.status(ooAccess.status).json({ success: false, message: ooAccess.message });
    }

    const ext = path.extname(doc.originalFilename).toLowerCase().slice(1);
    const documentType = getDocumentType(ext);

    if (!documentType) {
      return res.status(400).json({ success: false, message: 'Unsupported file format for OnlyOffice' });
    }

    // Lock acquisition for edit mode — fall back to view if blocked
    let mode = requestedMode;
    let lockInfo = null;
    if (mode === 'edit' && req.user?.id) {
      const { acquireEditLock } = await import('../services/document-lock.service.js');
      const result = await acquireEditLock(id, req.user.id);
      if (!result.acquired) {
        mode = 'view';
        lockInfo = {
          lockedByName: result.lockedByName || 'Pengguna lain',
          expiresAt: result.expiresAt,
        };
      }
    }

    // Presence heartbeat — fire-and-forget
    if (req.user?.id) {
      import('../services/document-presence.service.js')
        .then(({ heartbeat }) => heartbeat(id, req.user.id, mode))
        .catch(() => {});
    }

    const backendUrlForDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
    const onlyOfficeUrl = process.env.ONLYOFFICE_URL || 'http://localhost:8082';
    const ooToken = generateOOToken(doc.id);

    // Theme + bandwidth toggle
    const uiTheme = theme === 'dark' ? 'theme-dark' : 'theme-classic-light';
    const isSlow = bandwidth === 'slow' || bandwidth === '2g' || bandwidth === 'slow-2g';

    const config = {
      document: {
        fileType: ext,
        // Key: max 128 char, alphanumeric + dash + underscore. Pakai shorter format.
        key: `${doc.id.replace(/-/g, '')}_v${doc.versionCount || 1}`,
        title: doc.originalFilename,
        versionCount: doc.versionCount || 1,
        url: `${backendUrlForDocker}/api/documents/${doc.id}/file?oo_token=${encodeURIComponent(ooToken)}`,
        permissions: {
          edit: mode === 'edit',
          download: true,
          print: true,
          review: false,
          comment: mode === 'edit',
        },
      },
      documentType: documentType,
      editorConfig: {
        mode: mode,
        lang: 'en',
        callbackUrl: `${backendUrlForDocker}/api/documents/${doc.id}/callback?oo_token=${encodeURIComponent(ooToken)}`,
        user: {
          id: (req.user?.id || 'guest').replace(/-/g, ''),
          name: req.user?.email ? req.user.email.split('@')[0] : 'Tamu',
        },
        customization: {
          autosave: mode === 'edit',
          forcesave: mode === 'edit',
          chat: false,
          comments: true,
          help: false,
          hideRightMenu: false,
          compactToolbar: false,
          compactHeader: false,
          toolbarNoTabs: false,
          hideRulers: false,
          uiTheme,
          feedback: { visible: false },
          goback: { visible: false },
          logo: {
            image: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/logo.png`,
            imageEmbedded: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/logo.png`,
          },
        },
        plugins: { autostart: [], pluginsData: [] },
      },
      type: isSlow ? 'mobile' : 'desktop',
    };

    res.json({
      success: true,
      data: {
        config,
        onlyOfficeUrl: `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`,
        lockInfo, // null kalau lock acquired atau mode view tanpa konflik
      },
    });
  } catch (error) {
    console.error('Get OnlyOffice config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OnlyOffice configuration',
    });
  }
};

// POST /api/documents/:id/convert-to-editable
// Transparently turn a PDF into an editable DOCX so the user can just hit "Edit"
// (no explicit convert button). Converts via the OnlyOffice ConvertService, stores
// the DOCX as a NEW encrypted version, and flips the document to DOCX. The original
// PDF is preserved in version history. No-op for formats OnlyOffice already edits.
export const convertToEditable = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Converting creates a new editable version — require document access first.
    const convAccess = await assertDocumentAccess(req, doc);
    if (!convAccess.ok) {
      return res.status(convAccess.status).json({ success: false, message: convAccess.message });
    }

    const ext = path.extname(doc.originalFilename).toLowerCase().slice(1);
    if (ext !== 'pdf') {
      // Already editable by OnlyOffice — nothing to convert.
      return res.json({ success: true, data: { document: doc, converted: false } });
    }

    // Refuse while another user holds the edit lock (shouldn't happen for a PDF, but be safe).
    const { isLockActive } = await import('../services/document-lock.service.js');
    if (isLockActive(doc) && doc.editLockedBy !== req.user?.id) {
      return res.status(409).json({ success: false, message: 'Dokumen sedang diedit pengguna lain' });
    }

    // 1) Convert PDF → DOCX. OnlyOffice fetches the source via the signed /file URL.
    const backendUrlForDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
    const ooToken = generateOOToken(doc.id);
    const fileUrl = `${backendUrlForDocker}/api/documents/${doc.id}/file?oo_token=${encodeURIComponent(ooToken)}`;
    const convKey = `${doc.id.replace(/-/g, '')}_conv${Date.now()}`;
    const { url: convertedUrl } = await convertDocument(fileUrl, 'pdf', 'docx', convKey);
    const docxBuffer = await downloadFromUrl(convertedUrl);

    // 2) Persist the DOCX as a new encrypted version (mirrors the OnlyOffice save path).
    const baseName = doc.originalFilename.replace(/\.[^.]+$/i, '');
    const newOriginalFilename = `${baseName}.docx`;
    const newMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const newKeyData = await deriveNewVersionKey(doc.organizationId);
    const encResult = encryptFileService(docxBuffer, newKeyData.plaintextKey, newKeyData.iv);
    const newStorageKey = `${doc.id}/${Date.now()}.docx.enc`;
    await uploadFile(encResult.encryptedBuffer, newStorageKey, {
      documentId: doc.id,
      originalName: newOriginalFilename,
      mimeType: newMime,
      authTag: encResult.authTag,
    });

    // Recompute Document DNA from the converted content so integrity stays in sync.
    let dna;
    try {
      const text = await extractText(docxBuffer, newMime);
      dna = generateDocumentDNA(text ? normalizeText(text) : docxBuffer.toString('base64'));
    } catch (e) {
      console.warn('Convert DNA recompute failed, using raw hash:', e.message);
      dna = generateDocumentDNA(docxBuffer.toString('base64'));
    }

    let curVersionNumber = doc.versionCount || 1;
    if (doc.currentVersionId) {
      const [cur] = await db.select({ versionNumber: documentVersions.versionNumber })
        .from(documentVersions).where(eq(documentVersions.id, doc.currentVersionId));
      if (cur?.versionNumber) curVersionNumber = cur.versionNumber;
    }
    const newVersionNumber = curVersionNumber + 1;

    const [newVersion] = await db.insert(documentVersions).values({
      documentId: doc.id,
      versionNumber: newVersionNumber,
      s3Key: newStorageKey,
      s3Bucket: 'local',
      fileSize: docxBuffer.length,
      encryptionKeyId: newKeyData.encryptedKey,
      encryptionIv: newKeyData.iv,
      encryptionSalt: newKeyData.salt,
      keyWrapVersion: newKeyData.keyWrapVersion || 'v1_vault',
      pqcKeypairId: newKeyData.pqcKeypairId || null,
      pqcEnvelope: newKeyData.pqcEnvelope || null,
      sha256Hash: generateSHA256(docxBuffer),
      bodyHash: dna.sha256,
      archiveStatus: 'active',
      createdBy: req.user?.id || doc.ownerId,
      changeNote: 'Auto-converted PDF → DOCX for editing',
    }).returning();

    await db.update(documents).set({
      currentVersionId: newVersion.id,
      versionCount: newVersionNumber,
      filename: newStorageKey,
      fileSize: docxBuffer.length,
      mimeType: newMime,
      originalFilename: newOriginalFilename,
      contentHash: dna.sha256,
      simHash: dna.simhash,
      ssdeepHash: dna.ssdeep,
      updatedAt: new Date(),
    }).where(eq(documents.id, id));

    // Content changed (PDF → DOCX) → supersede the old QR and issue a fresh one bound
    // to the new content hash, and re-anchor if auto-anchor is on — same as an edit-save.
    try {
      await supersedeAndRegenerateQR(
        { id: doc.id, organizationId: doc.organizationId, originalFilename: newOriginalFilename },
        newVersion,
        dna.sha256,
      );
    } catch (qrErr) {
      console.warn('QR regeneration after conversion failed:', qrErr.message);
    }

    if (doc.autoAnchorOnEdit && uploadConfig.blockchain.enabled) {
      import('../services/blockchain.service.js').then(({ updateAnchor: bcUpdate, anchorDocument: bcAnchor, isReady }) => {
        if (!isReady()) return;
        const op = doc.blockchainAnchored
          ? bcUpdate(doc.id, dna.sha256, newVersionNumber, doc.organizationId)
          : bcAnchor(doc.id, newVersion.id, dna.sha256, doc.organizationId, newVersionNumber);
        Promise.resolve(op).catch(err => console.warn('[Blockchain] Auto-anchor on convert failed:', err.message));
      }).catch(() => {});
    }

    // Audit: converting to editable produces a new content version — record it. Non-fatal.
    try {
      await appendAuditEntry({
        organizationId: doc.organizationId,
        userId: req.user?.id,
        action: 'update',
        resourceType: 'document',
        resourceId: doc.id,
        details: { editedVia: 'convert', from: 'pdf', to: 'docx', versionNumber: newVersionNumber, filename: newOriginalFilename },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (auditErr) { console.warn('[Audit] convert log failed:', auditErr.message); }

    const [updated] = await db.select().from(documents).where(eq(documents.id, id));
    return res.json({ success: true, data: { document: updated, converted: true } });
  } catch (error) {
    console.error('Convert to editable error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengonversi PDF ke DOCX' });
  }
};

// OnlyOffice sends the editor identity in the callback body as dash-stripped UUIDs
// (see getOnlyOfficeConfig: user.id = req.user.id with dashes removed). Re-insert the
// dashes to recover the real user id; fall back to the owner when it can't be resolved.
const resolveOnlyOfficeEditorId = (body, fallbackId) => {
  const raw = body?.actions?.[0]?.userid
    || (Array.isArray(body?.users) ? body.users.find((u) => u && u !== 'guest') : null);
  if (typeof raw === 'string' && /^[0-9a-f]{32}$/i.test(raw)) {
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return fallbackId;
};

// OnlyOffice callback handler (for saving edits)
export const onlyOfficeCallback = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify OnlyOffice signed token
    const ooToken = req.query.oo_token;
    if (!verifyOOToken(ooToken, id)) {
      return res.status(401).json({ error: 1 }); // OnlyOffice expects { error: N }
    }

    const { status, url, key } = req.body;

    console.log('OnlyOffice callback:', { id, status, key });

    // Status codes:
    // 0 - no document with the key identifier could be found
    // 1 - document is being edited
    // 2 - document is ready for saving
    // 3 - document saving error occurred
    // 4 - document is closed with no changes
    // 6 - document is being edited, but the current document state is saved
    // 7 - error has occurred while force saving the document

    // Release edit lock pada status 4 (closed no changes)
    if (status === 4) {
      try {
        const [doc] = await db.select({ editLockedBy: documents.editLockedBy }).from(documents).where(eq(documents.id, id));
        if (doc?.editLockedBy) {
          const { forceReleaseLock } = await import('../services/document-lock.service.js');
          await forceReleaseLock(id);
        }
      } catch (e) { console.warn('Lock release on close failed:', e.message); }
    }

    if (status === 2 || status === 6) {
      const [doc] = await db.select().from(documents).where(eq(documents.id, id)); // tenant-lint-ignore: server-to-server OnlyOffice callback, no user JWT

      if (doc && url) {
        try {
          const response = await fetch(url);
          const buffer = Buffer.from(await response.arrayBuffer());

          // Recover the real editor from the callback (server-to-server, no req.user).
          const editorId = resolveOnlyOfficeEditorId(req.body, doc.ownerId);

          // Check if this is a pipeline-encrypted document (has a current version with encryption)
          let isPipelineDoc = false;
          let currentVersion = null;

          if (doc.currentVersionId) {
            [currentVersion] = await db
              .select()
              .from(documentVersions)
              .where(eq(documentVersions.id, doc.currentVersionId));

            if (currentVersion && currentVersion.encryptionKeyId && currentVersion.encryptionIv) {
              isPipelineDoc = true;
            }
          }

          if (isPipelineDoc) {
            // ── Pipeline document: re-encrypt and store in storage/documents/ ──
            const ext = path.extname(doc.originalFilename);
            const newKeyData = await deriveNewVersionKey(doc.organizationId);
            const encResult = encryptFileService(buffer, newKeyData.plaintextKey, newKeyData.iv);

            // New storage key for the updated version
            const newStorageKey = `${doc.id}/${Date.now()}${ext}.enc`;
            await uploadFile(encResult.encryptedBuffer, newStorageKey, {
              documentId: doc.id,
              originalName: doc.originalFilename,
              mimeType: doc.mimeType,
              authTag: encResult.authTag,
            });

            // Increment version
            const newVersionNumber = (currentVersion.versionNumber || 1) + 1;

            // Recompute Document DNA from the edited content so integrity stays in sync.
            // contentHash binds to normalized text (or raw bytes when no text extractable).
            let editedDna;
            try {
              const editedText = await extractText(buffer, doc.mimeType);
              const normalized = editedText ? normalizeText(editedText) : null;
              editedDna = generateDocumentDNA(normalized || buffer.toString('base64'));
            } catch (dnaErr) {
              console.warn('Edit DNA recompute failed, falling back to raw hash:', dnaErr.message);
              editedDna = generateDocumentDNA(buffer.toString('base64'));
            }
            const rawFileSha256 = generateSHA256(buffer);

            // Insert new version
            const [newVersion] = await db.insert(documentVersions).values({
              documentId: doc.id,
              versionNumber: newVersionNumber,
              s3Key: newStorageKey,
              s3Bucket: 'local',
              fileSize: buffer.length,
              encryptionKeyId: newKeyData.encryptedKey,
              encryptionIv: newKeyData.iv,
              encryptionSalt: newKeyData.salt,
              keyWrapVersion: newKeyData.keyWrapVersion || 'v1_vault',
              pqcKeypairId: newKeyData.pqcKeypairId || null,
              pqcEnvelope: newKeyData.pqcEnvelope || null,
              sha256Hash: rawFileSha256,
              bodyHash: editedDna.sha256,
              archiveStatus: 'active',
              createdBy: editorId,
              changeNote: 'Edited via OnlyOffice',
            }).returning();

            // Update document — keep contentHash / simHash / ssdeepHash current with the edit
            await db.update(documents)
              .set({
                currentVersionId: newVersion.id,
                versionCount: newVersionNumber,
                filename: newStorageKey,
                fileSize: buffer.length,
                contentHash: editedDna.sha256,
                simHash: editedDna.simhash,
                ssdeepHash: editedDna.ssdeep,
                updatedAt: new Date(),
              })
              .where(eq(documents.id, id));

            console.log('Pipeline document saved & re-encrypted:', doc.originalFilename, `(v${newVersionNumber})`);

            // Supersede old QR + issue fresh QR bound to the new content hash.
            // Old QR rows become status='superseded' (audit trail), not invalid.
            try {
              await supersedeAndRegenerateQR(
                { id: doc.id, organizationId: doc.organizationId, originalFilename: doc.originalFilename },
                newVersion,
                editedDna.sha256,
              );
            } catch (qrErr) {
              console.warn('QR regeneration after edit failed:', qrErr.message);
            }

            // Auto-anchor to blockchain if enabled.
            // Anchor the contentHash (editedDna.sha256) — the same hash verifyDocument compares.
            if (doc.autoAnchorOnEdit && uploadConfig.blockchain.enabled) {
              import('../services/blockchain.service.js').then(({ updateAnchor: bcUpdate, anchorDocument: bcAnchor, isReady }) => {
                if (!isReady()) return;
                const op = doc.blockchainAnchored
                  ? bcUpdate(doc.id, editedDna.sha256, newVersionNumber, doc.organizationId)
                  : bcAnchor(doc.id, newVersion.id, editedDna.sha256, doc.organizationId, newVersionNumber);
                Promise.resolve(op).catch(err =>
                  console.warn('[Blockchain] Auto-anchor on edit failed:', err.message)
                );
              }).catch(() => {});
            }

            // Audit: document content edited via OnlyOffice. Non-fatal; must never break the save.
            try {
              await appendAuditEntry({
                organizationId: doc.organizationId,
                userId: editorId,
                action: 'update',
                resourceType: 'document',
                resourceId: doc.id,
                details: { editedVia: 'onlyoffice', versionNumber: newVersionNumber, filename: doc.originalFilename },
              });
            } catch (auditErr) { console.warn('[Audit] OnlyOffice edit log failed:', auditErr.message); }
          } else {
            // ── Legacy document: save plain file to uploads/ ──
            const filePath = path.join(UPLOAD_DIR, doc.filename);
            await fs.writeFile(filePath, buffer);

            await db.update(documents)
              .set({ updatedAt: new Date() })
              .where(eq(documents.id, id));

            console.log('Legacy document saved:', doc.originalFilename);

            // Audit: legacy edit overwrites in place (no version row) — still record the event.
            try {
              await appendAuditEntry({
                organizationId: doc.organizationId,
                userId: editorId,
                action: 'update',
                resourceType: 'document',
                resourceId: doc.id,
                details: { editedVia: 'onlyoffice', legacy: true, filename: doc.originalFilename },
              });
            } catch (auditErr) { console.warn('[Audit] OnlyOffice legacy edit log failed:', auditErr.message); }
          }

          // Release edit lock setelah save sukses (status 2 = save+close)
          if (status === 2) {
            try {
              const { forceReleaseLock } = await import('../services/document-lock.service.js');
              await forceReleaseLock(id);
            } catch (e) { console.warn('Lock release after save failed:', e.message); }
          }
        } catch (saveError) {
          console.error('Error saving document from OnlyOffice:', saveError);
        }
      }
    }

    // OnlyOffice expects { "error": 0 } response
    res.json({ error: 0 });
  } catch (error) {
    console.error('OnlyOffice callback error:', error);
    res.json({ error: 0 }); // Still return success to OnlyOffice
  }
};

// Force-save: calls OnlyOffice Command Service to trigger a save
export const forceSaveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Force-save is triggered by the editing client (bearer token) — enforce access.
    const saveAccess = await assertDocumentAccess(req, doc);
    if (!saveAccess.ok) {
      return res.status(saveAccess.status).json({ success: false, message: saveAccess.message });
    }

    const docKey = `${doc.id}-${doc.updatedAt?.getTime() || Date.now()}`;
    const onlyOfficeUrl = process.env.ONLYOFFICE_URL_INTERNAL || process.env.ONLYOFFICE_URL || 'http://localhost:8082';

    // Call the OnlyOffice Command Service API
    const response = await fetch(`${onlyOfficeUrl}/coauthoring/CommandService.ashx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        c: 'forcesave',
        key: docKey,
      }),
    });

    const result = await response.json();
    console.log('Force-save result:', result);

    // error 0 = success, error 4 = no changes
    if (result.error === 0 || result.error === 4) {
      res.json({ success: true, message: result.error === 4 ? 'No changes to save' : 'Document saved' });
    } else {
      res.status(500).json({ success: false, message: `Force-save failed (code ${result.error})` });
    }
  } catch (error) {
    console.error('Force-save error:', error);
    res.status(500).json({ success: false, message: 'Force-save failed' });
  }
};

// ============================================================
// NEW ENDPOINTS: Versions, Download (decrypt), Verify
// ============================================================

// Get all versions of a document
export const getDocumentVersions = async (req, res) => {
  try {
    const { id } = req.params;

    const orgId = req.user?.organizationId;
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Enforce the same owner / permission-grant / active-task access as the download paths,
    // so a non-grantee can't read version history for a document they can't open.
    const access = await assertDocumentAccess(req, doc);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const versions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.versionNumber));

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Get document versions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch document versions' });
  }
};

// Download document (decrypt from encrypted storage)
export const downloadDocumentDecrypted = async (req, res) => {
  try {
    const { id } = req.params;
    const versionNumber = req.query.version ? parseInt(req.query.version, 10) : null;

    const orgId = req.user?.organizationId;
    // Soft-deleted docs are not downloadable (treated as not found).
    const baseWhere = and(eq(documents.id, id), isNull(documents.deletedAt));
    const whereClause = orgId ? and(baseWhere, eq(documents.organizationId, orgId)) : baseWhere;
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Enforce access control (owner / permission / active task) — no cross-user leak.
    const access = await assertDocumentAccess(req, doc);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    // Get specific version or current
    let version;
    if (versionNumber) {
      [version] = await db
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.documentId, id),
            eq(documentVersions.versionNumber, versionNumber),
          ),
        );
    } else if (doc.currentVersionId) {
      [version] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, doc.currentVersionId));
    } else {
      // Fallback: latest version
      [version] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, id))
        .orderBy(desc(documentVersions.versionNumber))
        .limit(1);
    }

    if (!version) {
      return res.status(404).json({ success: false, message: 'Document version not found' });
    }

    // Try encrypted download first
    try {
      const encryptedBuffer = await downloadFile(version.s3Key);

      // Read authTag from sidecar meta or version record
      // We stored metadata alongside the file in storage.service
      let authTag = null;
      try {
        const metaPath = `${version.s3Key}.meta.json`;
        const metaBuffer = await downloadFile(metaPath);
        const meta = JSON.parse(metaBuffer.toString());
        authTag = meta.authTag;
      } catch {
        // No sidecar meta — look in storage documents dir
        const storagePath = path.join(process.cwd(), 'storage', 'documents', `${version.s3Key}.meta.json`);
        try {
          const metaRaw = await fs.readFile(storagePath, 'utf-8');
          const meta = JSON.parse(metaRaw);
          authTag = meta.authTag;
        } catch { /* no meta */ }
      }

      if (authTag) {
        const decryptedBuffer = await decryptFile(
          encryptedBuffer,
          version.encryptionKeyId, // This holds the encryptedKey in our pipeline
          version.encryptionIv,
          authTag,
          version,
        );

        // ── Per-download invisible watermark injection ──
        let finalBuffer = decryptedBuffer;
        let watermarkId = null;
        if (uploadConfig.downloadWatermark.enabled) {
          try {
            watermarkId = randomUUID();
            const wmPayload = {
              w: watermarkId,
              d: doc.id,
              u: req.user?.id || 'anonymous',
              t: new Date().toISOString(),
            };
            const wmResult = await watermarkBuffer(
              decryptedBuffer,
              doc.mimeType,
              (text) => injectDownloadWatermark(text, wmPayload),
            );
            if (wmResult.success) {
              finalBuffer = wmResult.buffer;
              // Fire-and-forget DB insert
              db.insert(downloadWatermarks).values({
                documentId: doc.id,
                versionId: version.id,
                downloadedBy: req.user?.id,
                watermarkId,
                watermarkToken: wmResult.watermarkToken || '',
                watermarkPositions: wmResult.positions || [],
                payloadHash: hashPayload(wmPayload),
                payload: wmPayload,
                documentFormat: wmResult.method,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
              }).catch(err => console.warn('[DownloadWatermark] DB insert failed:', err.message));
            }
          } catch (wmErr) {
            console.warn('[DownloadWatermark] Injection failed, serving original:', wmErr.message);
          }
        }

        // ── Visible OSINT canary code (tracked documents only) ──
        let visibleCode = null;
        if (uploadConfig.tracking.enabled && doc.trackingEnabled && doc.trackingCode) {
          try {
            const dlCode = generateDownloadCode();
            visibleCode = formatVisibleCode(doc.trackingCode, dlCode);
            const stamped = await stampVisibleCode(finalBuffer, doc.mimeType, visibleCode);
            if (stamped.success) {
              finalBuffer = stamped.buffer;
              db.insert(downloadWatermarks).values({
                documentId: doc.id,
                versionId: version.id,
                downloadedBy: req.user?.id,
                watermarkId: randomUUID(),
                watermarkToken: '',
                watermarkPositions: [],
                payloadHash: '',
                payload: { visibleCode, d: doc.id, u: req.user?.id || 'anonymous', t: new Date().toISOString() },
                documentFormat: stamped.method,
                visibleCode,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
              }).catch(err => console.warn('[Tracking] visible-code row insert failed:', err.message));
            } else {
              visibleCode = null; // stamping unsupported for this format
            }
          } catch (stampErr) {
            console.warn('[Tracking] visible stamp failed, serving un-stamped:', stampErr.message);
            visibleCode = null;
          }
        }

        // ── QR on download: embed the verification QR onto the served copy ──
        if (uploadConfig.qr?.enabled !== false && doc.qrOnDownload) {
          try {
            const [qrRow] = await db.select().from(documentQrCodes)
              .where(and(eq(documentQrCodes.documentId, doc.id), eq(documentQrCodes.isActive, true)))
              .orderBy(desc(documentQrCodes.createdAt)).limit(1);
            if (qrRow?.qrImageS3Key) {
              const { s3Download } = await import('../services/s3.service.js');
              const qrPng = await s3Download(uploadConfig.s3.qrBucket, qrRow.qrImageS3Key);
              const stamped = await stampQrCode(finalBuffer, doc.mimeType, qrPng, qrRow.shortCode);
              if (stamped.success) finalBuffer = stamped.buffer;
            }
          } catch (e) { console.warn('[QR] download stamp failed:', e.message); }
        }

        // Audit log
        await appendAuditEntry({
          organizationId: doc.organizationId,
          userId: req.user?.id,
          action: 'download',
          resourceType: 'document',
          resourceId: id,
          details: { versionNumber: version.versionNumber, encrypted: true, watermarkId, visibleCode },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.setHeader('Content-Type', doc.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
        return res.send(finalBuffer);
      }
    } catch (err) {
      console.warn('Encrypted download failed, trying legacy path:', err.message);
    }

    // Fallback: legacy unencrypted file in uploads/
    const legacyPath = path.join(UPLOAD_DIR, doc.filename);
    try {
      await fs.access(legacyPath);
      const fileBuffer = await fs.readFile(legacyPath);
      res.setHeader('Content-Type', doc.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
      return res.send(fileBuffer);
    } catch {
      return res.status(404).json({ success: false, message: 'File not found in storage' });
    }
  } catch (error) {
    console.error('Download decrypted document error:', error);
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
};

// ─────────────── MIME helpers for conversion ───────────────
const FORMAT_MIME_MAP = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png:  'image/png',
  jpg:  'image/jpeg',
  csv:  'text/csv',
  txt:  'text/plain',
  odt:  'application/vnd.oasis.opendocument.text',
  ods:  'application/vnd.oasis.opendocument.spreadsheet',
  rtf:  'application/rtf',
};

function extFromMime(mime) {
  const map = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/rtf': 'rtf',
  };
  return map[mime] || 'bin';
}

// Download document with optional format conversion via OnlyOffice
// GET /documents/:id/download-as?format=pdf|docx|xlsx|png|jpg
export const downloadDocumentConverted = async (req, res) => {
  try {
    const { id } = req.params;
    const targetFormat = (req.query.format || '').toLowerCase().trim();

    if (!targetFormat) {
      return res.status(400).json({ success: false, message: 'Missing ?format= parameter' });
    }

    const orgId = req.user?.organizationId;
    const baseWhere = and(eq(documents.id, id), isNull(documents.deletedAt));
    const whereClause = orgId ? and(baseWhere, eq(documents.organizationId, orgId)) : baseWhere;
    const [doc] = await db.select().from(documents).where(whereClause);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Enforce access control before any decrypt/convert work.
    const access = await assertDocumentAccess(req, doc);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    const srcExt = extFromMime(doc.mimeType);

    // If requested format is same as source, serve the original file directly
    // (don't use redirect — Axios blob requests may not follow redirects properly)
    if (srcExt === targetFormat || (srcExt === 'doc' && targetFormat === 'docx') || (srcExt === 'xls' && targetFormat === 'xlsx')) {
      // Pipe through the normal download logic by importing the function
      req.params.id = id;
      return downloadDocumentDecrypted(req, res);
    }

    // Build the URL that OnlyOffice can fetch the source file from
    // OnlyOffice runs in Docker, so use the Docker-accessible URL (same as onlyoffice-config)
    const backendUrl = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
    const ooToken = generateOOToken(id);
    const fileUrl = `${backendUrl}/api/documents/${id}/file?oo_token=${encodeURIComponent(ooToken)}`;

    console.log(`[Convert] ${doc.originalFilename} (${srcExt}) → ${targetFormat}, url: ${fileUrl}`);

    // Call OnlyOffice conversion
    const convKey = `convert-${id}-${targetFormat}-${Date.now()}`;
    const { url: convertedUrl } = await convertDocument(fileUrl, srcExt, targetFormat, convKey);

    // Download converted file from OnlyOffice
    const convertedBuffer = await downloadFromUrl(convertedUrl);

    // Build output filename: replace extension
    const baseName = doc.originalFilename.replace(/\.[^.]+$/, '');
    const outputFilename = `${baseName}.${targetFormat}`;
    const outputMime = FORMAT_MIME_MAP[targetFormat] || 'application/octet-stream';

    // ── Per-download invisible watermark injection ──
    let finalConvertedBuffer = convertedBuffer;
    let convertWatermarkId = null;
    if (uploadConfig.downloadWatermark.enabled) {
      try {
        convertWatermarkId = randomUUID();
        const wmPayload = {
          w: convertWatermarkId,
          d: doc.id,
          u: req.user?.id || 'anonymous',
          t: new Date().toISOString(),
        };
        const wmResult = await watermarkBuffer(
          convertedBuffer,
          outputMime,
          (text) => injectDownloadWatermark(text, wmPayload),
        );
        if (wmResult.success) {
          finalConvertedBuffer = wmResult.buffer;
          db.insert(downloadWatermarks).values({
            documentId: doc.id,
            versionId: doc.currentVersionId,
            downloadedBy: req.user?.id,
            watermarkId: convertWatermarkId,
            watermarkToken: wmResult.watermarkToken || '',
            watermarkPositions: wmResult.positions || [],
            payloadHash: hashPayload(wmPayload),
            payload: wmPayload,
            documentFormat: wmResult.method,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }).catch(err => console.warn('[DownloadWatermark] DB insert failed:', err.message));
        }
      } catch (wmErr) {
        console.warn('[DownloadWatermark] Converted injection failed:', wmErr.message);
      }
    }

    // ── Visible OSINT canary code (tracked documents only) ──
    let convertVisibleCode = null;
    if (uploadConfig.tracking.enabled && doc.trackingEnabled && doc.trackingCode) {
      try {
        const dlCode = generateDownloadCode();
        convertVisibleCode = formatVisibleCode(doc.trackingCode, dlCode);
        const stamped = await stampVisibleCode(finalConvertedBuffer, outputMime, convertVisibleCode);
        if (stamped.success) {
          finalConvertedBuffer = stamped.buffer;
          db.insert(downloadWatermarks).values({
            documentId: doc.id,
            versionId: doc.currentVersionId,
            downloadedBy: req.user?.id,
            watermarkId: randomUUID(),
            watermarkToken: '',
            watermarkPositions: [],
            payloadHash: '',
            payload: { visibleCode: convertVisibleCode, d: doc.id, u: req.user?.id || 'anonymous', t: new Date().toISOString() },
            documentFormat: stamped.method,
            visibleCode: convertVisibleCode,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }).catch(err => console.warn('[Tracking] visible-code row insert failed:', err.message));
        } else {
          convertVisibleCode = null;
        }
      } catch (stampErr) {
        console.warn('[Tracking] visible stamp (converted) failed:', stampErr.message);
        convertVisibleCode = null;
      }
    }

    // ── QR on download: embed the verification QR onto the converted copy ──
    if (uploadConfig.qr?.enabled !== false && doc.qrOnDownload) {
      try {
        const [qrRow] = await db.select().from(documentQrCodes)
          .where(and(eq(documentQrCodes.documentId, doc.id), eq(documentQrCodes.isActive, true)))
          .orderBy(desc(documentQrCodes.createdAt)).limit(1);
        if (qrRow?.qrImageS3Key) {
          const { s3Download } = await import('../services/s3.service.js');
          const qrPng = await s3Download(uploadConfig.s3.qrBucket, qrRow.qrImageS3Key);
          const stamped = await stampQrCode(finalConvertedBuffer, outputMime, qrPng, qrRow.shortCode);
          if (stamped.success) finalConvertedBuffer = stamped.buffer;
        }
      } catch (e) { console.warn('[QR] download stamp failed:', e.message); }
    }

    // Audit log
    try {
      await appendAuditEntry({
        organizationId: doc.organizationId,
        userId: req.user?.id,
        action: 'download',
        resourceType: 'document',
        resourceId: id,
        details: { converted: true, sourceFormat: srcExt, targetFormat, filename: outputFilename, watermarkId: convertWatermarkId, visibleCode: convertVisibleCode },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch { /* non-critical */ }

    res.setHeader('Content-Type', outputMime);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    return res.send(finalConvertedBuffer);
  } catch (error) {
    console.error('Download converted document error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to convert and download document',
    });
  }
};

// ============================================================
// Internal helper: insert verificationRequests row
// ============================================================
const logVerificationRequest = async ({
  inputMethod,
  inputHash = null,
  inputQrCode = null,
  uploadedFileS3Key = null,
  status,
  matchedDocumentId = null,
  matchedVersionId = null,
  isHardcopyScan = false,
  simHashDistance = null,
  ssdeepSimilarity = null,
  blockchainVerified = null,
  blockchainAnchorId = null,
  requestedBy = null,
  ipAddress = null,
  resultMessage = null,
  resultDetails = null,
}) => {
  try {
    const [row] = await db
      .insert(verificationRequests)
      .values({
        inputMethod,
        inputHash,
        inputQrCode,
        uploadedFileS3Key,
        status,
        matchedDocumentId,
        matchedVersionId,
        isHardcopyScan,
        simHashDistance,
        ssdeepSimilarity,
        blockchainVerified,
        blockchainAnchorId,
        requestedBy,
        ipAddress,
        resultMessage,
        resultDetails,
        completedAt: new Date(),
      })
      .returning({ id: verificationRequests.id });
    return row?.id || null;
  } catch (err) {
    console.error('[Verify] Failed to log verificationRequest:', err.message);
    return null;
  }
};

// ============================================================
// Internal helper: attach the AUTHORITATIVE on-chain verdict to an enriched doc.
// Reads the blockchain (not the DB) so a tampered DB cannot fake a green badge.
// Returns { blockchainState, blockchainVerified, anchor } where:
//   blockchainState: 'chain_verified' | 'mismatch' | 'db_only' | 'not_anchored'
//   blockchainVerified: boolean|null — for the verificationRequests audit log
// Mutates enriched.blockchainAnchor with { state, onChainHash } for the response.
// ============================================================
const attachChainVerdict = async (doc, enriched) => {
  const anchor = enriched?.blockchainAnchor || null;
  const verdict = await resolveBlockchainVerdict(doc, anchor);
  if (enriched?.blockchainAnchor) {
    enriched.blockchainAnchor.state = verdict.state;
    enriched.blockchainAnchor.onChainHash = verdict.onChainHash;
    if (verdict.anchoredAt) enriched.blockchainAnchor.anchoredAt = verdict.anchoredAt;
  }
  const blockchainVerified = verdict.state === 'chain_verified'
    ? true
    : verdict.state === 'mismatch'
      ? false
      : null; // db_only / not_anchored → unknown for audit
  return { blockchainState: verdict.state, blockchainVerified, anchor };
};

// Compact, frontend-friendly blockchain summary so a single QR scan/verify call
// returns the on-chain verdict inline (no extra round-trip to /api/blockchain).
const buildBlockchainSummary = (enriched, chain) => {
  const a = enriched?.blockchainAnchor || null;
  if (!a) return { state: 'not_anchored', verified: null, network: null, txHash: null, explorerUrl: null, blockNumber: null, onChainHash: null, anchoredAt: null };
  return {
    state: chain?.blockchainState || a.state || 'db_only',
    verified: chain?.blockchainVerified ?? null,
    network: a.network || null,
    txHash: a.txHash || null,
    explorerUrl: a.explorerUrl || null,
    blockNumber: a.blockNumber || null,
    onChainHash: a.onChainHash || null,
    anchoredAt: a.anchoredAt || null,
  };
};

// ============================================================
// QR code verification by short code (public endpoint)
// ============================================================
// Internal helper: resolve a QR scan into a verification verdict.
// Decides whether the scanned QR is for the current version, an old (superseded)
// version, a revoked/purged document, or points to a missing document.
// Shape consumed by verifyByShortCode + verifyByQrImage:
//   { status, verified, message, currentShortCode, currentVersionNumber }
// ============================================================
const resolveQrVerification = async (qr, doc) => {
  // Document gone (purged/deleted) — QR row survives as audit trail.
  if (!doc) {
    return { status: 'PURGED', verified: false, message: 'Dokumen sudah dihapus dari sistem.', currentShortCode: null, currentVersionNumber: null };
  }
  if (doc.status === 'revoked' || qr.status === 'revoked') {
    return { status: 'REVOKED', verified: false, message: 'Dokumen telah dicabut (revoked).', currentShortCode: null, currentVersionNumber: null };
  }
  if (doc.deletedAt) {
    return { status: 'PURGED', verified: false, message: 'Dokumen berada di trash / sudah dihapus.', currentShortCode: null, currentVersionNumber: null };
  }

  // Find the currently-active QR for this document (the latest issued one).
  const [currentQr] = await db
    .select()
    .from(documentQrCodes)
    .where(and(eq(documentQrCodes.documentId, doc.id), eq(documentQrCodes.status, 'active')))
    .orderBy(desc(documentQrCodes.documentVersionNumber))
    .limit(1);

  const scannedVersion = qr.documentVersionNumber ?? null;
  const currentVersion = currentQr?.documentVersionNumber ?? doc.versionCount ?? null;

  // Scanned QR is superseded (an older version) — surface where the current one is.
  if (qr.status === 'superseded' || (currentVersion != null && scannedVersion != null && scannedVersion < currentVersion)) {
    return {
      status: 'SUPERSEDED',
      verified: false,
      message: `Versi dokumen sudah diperbarui (v${scannedVersion} → v${currentVersion}).`,
      currentShortCode: currentQr?.shortCode || null,
      currentVersionNumber: currentVersion,
    };
  }

  // Current, active, document present → valid.
  return {
    status: 'VALID',
    verified: true,
    message: 'Dokumen asli dan terverifikasi.',
    currentShortCode: qr.shortCode,
    currentVersionNumber: currentVersion,
  };
};

// GET /api/documents/verify?code=XXXX
// ============================================================
export const verifyByShortCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing code parameter' });
    }

    const [qr] = await db
      .select()
      .from(documentQrCodes)
      .where(eq(documentQrCodes.shortCode, code));

    if (!qr) {
      await logVerificationRequest({
        inputMethod: 'qr_scan',
        inputQrCode: code,
        status: 'failed',
        ipAddress: req.ip,
        requestedBy: req.user?.id || null,
        resultMessage: 'Short code not found',
      });
      return res.status(404).json({ success: false, message: 'Verification code not found' });
    }

    const doc = qr.documentId
      ? (await db.select().from(documents).where(eq(documents.id, qr.documentId)))[0] // tenant-lint-ignore: public QR verification
      : null;

    // Always count the scan (audit trail), regardless of verdict
    await db
      .update(documentQrCodes)
      .set({ scanCount: (qr.scanCount || 0) + 1, lastScannedAt: new Date() })
      .where(eq(documentQrCodes.id, qr.id));

    const verdict = await resolveQrVerification(qr, doc);
    const enriched = doc && verdict.status !== 'PURGED' ? await enrichDocument(doc) : null;
    const chain = enriched ? await attachChainVerdict(doc, enriched) : { blockchainVerified: null };
    // QR path AUTO-resolves the chain: expose it on the document as `blockchain`.
    if (enriched) enriched.blockchain = buildBlockchainSummary(enriched, chain);

    const verificationRequestId = await logVerificationRequest({
      inputMethod: 'qr_scan',
      inputQrCode: code,
      status: verdict.verified ? 'verified' : 'failed',
      matchedDocumentId: doc?.id || null,
      matchedVersionId: qr.versionId,
      blockchainVerified: chain.blockchainVerified,
      blockchainAnchorId: enriched?.blockchainAnchor?.id || null,
      requestedBy: req.user?.id || null,
      ipAddress: req.ip,
      resultMessage: `${verdict.status}: ${verdict.message}`,
    });

    res.json({
      success: true,
      data: {
        status: verdict.status,
        verified: verdict.verified,
        message: verdict.message,
        // Short code resolved to a DocLoq-issued row → authentic QR (same trust
        // the image path grants). Describes QR issuance, not document status.
        signatureValid: true,
        currentShortCode: verdict.currentShortCode || null,
        currentVersionNumber: verdict.currentVersionNumber || null,
        verificationRequestId,
        document: enriched,
        blockchain: buildBlockchainSummary(enriched, chain),
        qrCode: {
          shortCode: qr.shortCode,
          versionNumber: qr.documentVersionNumber,
          scanCount: (qr.scanCount || 0) + 1,
          createdAt: qr.createdAt,
          hasBlockchainProof: qr.hasBlockchainProof,
        },
      },
    });
  } catch (error) {
    console.error('Verify by short code error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// ============================================================
// Verify by QR image upload (POST /api/documents/verify-qr-image)
// Decodes uploaded PNG/JPG → extracts shortCode → looks up doc.
// ============================================================
export const verifyByQrImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    let decoded;
    try {
      decoded = await decodeQrFromBuffer(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!decoded.shortCode) {
      await logVerificationRequest({
        inputMethod: 'qr_scan',
        status: 'failed',
        requestedBy: req.user?.id || null,
        ipAddress: req.ip,
        resultMessage: 'No QR code detected in image',
      });
      return res.status(404).json({
        success: false,
        message: 'No QR code detected. Pastikan image jelas + QR DocLoq.',
      });
    }

    // Lookup by shortCode
    const [qr] = await db
      .select()
      .from(documentQrCodes)
      .where(eq(documentQrCodes.shortCode, decoded.shortCode));

    if (!qr) {
      await logVerificationRequest({
        inputMethod: 'qr_scan',
        inputQrCode: decoded.shortCode,
        status: 'failed',
        requestedBy: req.user?.id || null,
        ipAddress: req.ip,
        resultMessage: 'QR shortCode not in database',
      });
      return res.status(404).json({ success: false, message: 'QR code tidak dikenali (kemungkinan dari sistem lain).' });
    }

    // Always count the scan (audit trail)
    await db
      .update(documentQrCodes)
      .set({ scanCount: (qr.scanCount || 0) + 1, lastScannedAt: new Date() })
      .where(eq(documentQrCodes.id, qr.id));

    // Authenticity model — aligned with the scan-URL path (verifyByShortCode).
    // The short code is a 47-bit crypto-random token that ONLY DocLoq issues and
    // stores. Decoding an image whose short code resolves to a documentQrCodes row
    // (the lookup above; a miss already 404'd) therefore proves the QR is
    // DocLoq-issued — the same trust the scan path already grants. Current QRs
    // carry ONLY the verification URL, so no embedded HMAC is present; that is
    // EXPECTED, not a forgery, and must not be rejected.
    //
    // Legacy QRs (issued before the URL-only change) embed {payload, sig}. When an
    // embedded signature IS present we still verify it: a present-but-invalid HMAC
    // is a genuine tamper signal → reject as TAMPERED.
    let signatureValid = true; // short code resolved to a DocLoq-issued row
    if (decoded.payload && decoded.signature) {
      try {
        signatureValid = verifyQRPayload(decoded.payload, decoded.signature).isValid;
      } catch { signatureValid = false; }

      if (!signatureValid) {
        const verificationRequestId = await logVerificationRequest({
          inputMethod: 'qr_scan',
          inputQrCode: decoded.shortCode,
          status: 'failed',
          requestedBy: req.user?.id || null,
          ipAddress: req.ip,
          resultMessage: 'TAMPERED: QR signature invalid (possible forgery)',
          resultDetails: { signatureValid, shortCode: decoded.shortCode },
        });
        return res.json({
          success: true,
          data: {
            status: 'TAMPERED',
            verified: false,
            signatureValid,
            message: 'Tanda tangan QR tidak valid — kemungkinan QR palsu atau diubah.',
            verificationRequestId,
            qrCode: { shortCode: qr.shortCode, createdAt: qr.createdAt },
          },
        });
      }
    }

    const doc = qr.documentId
      ? (await db.select().from(documents).where(eq(documents.id, qr.documentId)))[0] // tenant-lint-ignore: QR HMAC-signed source
      : null;

    const verdict = await resolveQrVerification(qr, doc);
    const enriched = doc && verdict.status !== 'PURGED' ? await enrichDocument(doc) : null;
    const chain = enriched ? await attachChainVerdict(doc, enriched) : { blockchainVerified: null };
    // QR path AUTO-resolves the chain: expose it on the document as `blockchain`.
    if (enriched) enriched.blockchain = buildBlockchainSummary(enriched, chain);

    const verificationRequestId = await logVerificationRequest({
      inputMethod: 'qr_scan',
      inputQrCode: decoded.shortCode,
      status: verdict.verified ? 'verified' : 'failed',
      matchedDocumentId: doc?.id || null,
      matchedVersionId: qr.versionId,
      blockchainVerified: chain.blockchainVerified,
      blockchainAnchorId: enriched?.blockchainAnchor?.id || null,
      requestedBy: req.user?.id || null,
      ipAddress: req.ip,
      resultMessage: `${verdict.status}: ${verdict.message}`,
      resultDetails: { signatureValid, shortCode: decoded.shortCode },
    });

    res.json({
      success: true,
      data: {
        status: verdict.status,
        verified: verdict.verified,
        message: verdict.message,
        signatureValid,
        currentShortCode: verdict.currentShortCode || null,
        currentVersionNumber: verdict.currentVersionNumber || null,
        verificationRequestId,
        document: enriched,
        blockchain: buildBlockchainSummary(enriched, chain),
        qrCode: {
          shortCode: qr.shortCode,
          versionNumber: qr.documentVersionNumber,
          scanCount: (qr.scanCount || 0) + 1,
          createdAt: qr.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('verifyByQrImage error:', error);
    res.status(500).json({ success: false, message: 'QR image verification failed' });
  }
};

// ============================================================
// Verify by uploaded DIGITAL FILE — exact SHA-256 + SimHash fuzzy match.
// POST /api/documents/verify-file (multipart file). LOGIN REQUIRED — fuzzy
// matching is org-scoped (cross-tenant public matching would leak data).
// Does NOT resolve the chain; only returns `document.anchored` (boolean).
// The on-demand /:id/blockchain-integrity endpoint resolves the chain.
// ============================================================
export const verifyByFile = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Login required for file verification' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const dna = await computeUploadDNA(req.file.buffer, req.file.mimetype);

    // 1) Exact match on the content-DNA hash (normalized text / base64 raw), org-scoped —
    //    same basis upload stores as contentHash, so a content-identical re-upload matches.
    const exact = await findByContentHash(dna.contentDnaHash, orgId);
    let matchedDoc = exact || null;
    let exactMatch = !!exact;
    let similarity = exact ? 100 : 0;
    let distance = exact ? 0 : null;
    let ssdeepSimilarity = null;

    // 2) No exact match: if no extractable text, fuzzy match is impossible →
    //    friendly not_found (NOT a hard error).
    if (!exactMatch && !dna.hasText) {
      const verificationRequestId = await logVerificationRequest({
        inputMethod: 'upload_softcopy',
        inputHash: dna.sha256,
        status: 'failed',
        requestedBy: req.user?.id || null,
        ipAddress: req.ip,
        resultMessage: 'No extractable text and no exact match',
      });
      return res.json({
        success: true,
        data: {
          verified: false,
          status: 'not_found',
          similarity: 0,
          exactMatch: false,
          document: null,
          verificationRequestId,
          message: 'Could not read this file. If you have the printed document, use the QR code instead.',
        },
      });
    }

    // 3) Fuzzy SimHash search (org-scoped), with ssdeep as a secondary signal.
    if (!exactMatch) {
      const matches = await findBySimHash(dna.simhash, orgId, 5, dna.ssdeep);
      const best = matches[0];
      if (best) {
        matchedDoc = best.doc;
        similarity = best.similarity;
        distance = best.distance;
        ssdeepSimilarity = best.ssdeepSimilarity;
      }
    }

    const verdict = decideFileVerdict({ exactMatch, similarity });

    let document = null;
    if (verdict.status !== 'not_found' && matchedDoc) {
      const enriched = await enrichDocument(matchedDoc);
      document = {
        id: matchedDoc.id,
        filename: enriched?.filename || matchedDoc.originalFilename || matchedDoc.filename,
        uploader: enriched?.uploader || null,
        createdAt: matchedDoc.createdAt,
        version: matchedDoc.versionCount || null,
        anchored: !!matchedDoc.blockchainAnchored,
      };
    }

    const verificationRequestId = await logVerificationRequest({
      inputMethod: 'upload_softcopy',
      inputHash: dna.sha256,
      status: verdict.status.startsWith('verified') ? 'verified' : (verdict.status === 'partial' ? 'partial' : 'failed'),
      matchedDocumentId: document ? matchedDoc.id : null,
      simHashDistance: distance,
      ssdeepSimilarity,
      requestedBy: req.user?.id || null,
      ipAddress: req.ip,
      resultMessage: `${verdict.status}: ${verdict.label}${exactMatch ? '' : ` (similarity ${similarity}%)`}`,
    });

    return res.json({
      success: true,
      data: {
        verified: verdict.status.startsWith('verified'),
        status: verdict.status,
        similarity,
        exactMatch,
        document,
        verificationRequestId,
      },
    });
  } catch (error) {
    console.error('verifyByFile error:', error);
    res.status(500).json({ success: false, message: 'File verification failed' });
  }
};

// ============================================================
// On-demand blockchain integrity check (file-path button).
// GET /api/documents/:id/blockchain-integrity
// Reuses resolveBlockchainVerdict (reads the chain, not the DB).
// ============================================================
export async function getBlockchainIntegrity(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId; // optional — public callers omit
    const whereClause = orgId ? and(eq(documents.id, id), eq(documents.organizationId, orgId)) : eq(documents.id, id);
    const [doc] = await db.select().from(documents).where(whereClause).limit(1);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Resolve the latest anchor record for this document, then read the chain.
    const [a] = await db
      .select()
      .from(blockchainAnchors)
      .where(eq(blockchainAnchors.documentId, doc.id))
      .orderBy(desc(blockchainAnchors.createdAt))
      .limit(1);
    const anchor = a
      ? {
          id: a.id,
          network: a.blockchainNetwork,
          txHash: a.transactionHash,
          explorerUrl: explorerTxUrl(a.blockchainNetwork, a.transactionHash),
          blockNumber: a.blockNumber,
          anchoredHash: a.anchoredHash,
          status: a.status,
          anchoredAt: a.blockTimestamp || a.confirmedAt || a.createdAt,
          merkleRoot: a.merkleRoot || null,
          merkleProof: a.merkleProof || null,
        }
      : null;

    const verdict = await resolveBlockchainVerdict(doc, anchor); // { state, onChainHash, anchoredAt }
    return res.json({
      success: true,
      data: {
        state: verdict.state,
        network: anchor?.network || null,
        txHash: anchor?.txHash || null,
        explorerUrl: anchor?.explorerUrl || null,
        blockNumber: anchor?.blockNumber || null,
        onChainHash: verdict.onChainHash || null,
        anchoredAt: verdict.anchoredAt || anchor?.anchoredAt || null,
      },
    });
  } catch (err) {
    console.error('[Verify] integrity error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// Read-only verify-preview (View document) — public-safe, render-only.
// GET /api/documents/:id/verify-preview
// Streams a system-rendered preview image inline for visual comparison.
// Never exposes keys or the original attachment. 415 for unsupported types.
// ============================================================
export async function verifyPreview(req, res) {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const orgId = req.user?.organizationId || null; // org-scope: never preview another tenant's doc
    const result = await renderVerificationPreview(id, page, orgId); // { buffer, mimeType, totalPages } | null
    if (!result) {
      return res.status(415).json({ success: false, previewable: false, message: 'Preview not available for this file type' });
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', 'inline; filename="preview"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Total-Pages', String(result.totalPages || 1));
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Pages');
    return res.send(result.buffer);
  } catch (err) {
    console.error('[Verify] preview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// Serve QR code image (GET /api/documents/:id/qr-image)
// ============================================================
export const getDocumentQrImage = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ success: false, message: 'Authentication required' });

    // Org-scope: the QR image embeds the document's short verification code, so it must
    // never be served for another tenant's document (or anonymously).
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, orgId))).limit(1);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const [qr] = await db
      .select()
      .from(documentQrCodes)
      .where(and(eq(documentQrCodes.documentId, id), eq(documentQrCodes.isActive, true)))
      .orderBy(desc(documentQrCodes.createdAt))
      .limit(1);

    if (!qr || !qr.qrImageS3Key) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    // QR images are stored in qr bucket — use storage service with override
    // We need to fetch from QR bucket specifically; storage.downloadFile uses documents bucket.
    // For minimal change, re-implement R2 fetch inline using s3 service.
    const { s3Download } = await import('../services/s3.service.js');
    const uploadConfig = (await import('../config/upload.config.js')).default;
    const buf = await s3Download(uploadConfig.s3.qrBucket, qr.qrImageS3Key);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  } catch (error) {
    console.error('getDocumentQrImage error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch QR image' });
  }
};

// Helper: Get document type for OnlyOffice
function getDocumentType(extension) {
  const wordExtensions = ['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt', 'html', 'htm', 'mht', 'xml', 'pdf', 'djvu', 'fb2', 'epub', 'xps', 'oxps'];
  const cellExtensions = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'];
  const slideExtensions = ['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp', 'ppsx'];

  if (wordExtensions.includes(extension)) return 'word';
  if (cellExtensions.includes(extension)) return 'cell';
  if (slideExtensions.includes(extension)) return 'slide';

  return null;
}

// Prepend UTF-8 BOM untuk TXT/CSV supaya OnlyOffice auto-detect encoding (skip prompt dialog)
function prependUtf8BomIfText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.txt' && ext !== '.csv') return buffer;
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return buffer;
  return Buffer.concat([BOM, buffer]);
}

// ──────────────────────────────────────────────
// GRANT document permission (admin only)
// POST /api/documents/:id/permissions
// ──────────────────────────────────────────────
export const grantDocumentPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const grantedBy = req.user?.id || req.user?.userId;
    const { userId, teamId, permissionType = 'read' } = req.body;

    if (!userId && !teamId) {
      return res.status(400).json({ success: false, message: 'userId or teamId required' });
    }
    if (!['read', 'read_edit', 'full_access'].includes(permissionType)) {
      return res.status(400).json({ success: false, message: 'permissionType must be read, read_edit, or full_access' });
    }

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const [perm] = await db.insert(documentPermissions).values({
      documentId: id,
      userId: userId || null,
      teamId: teamId || null,
      permissionType,
      grantedBy,
    }).returning();

    res.status(201).json({ success: true, data: perm });
  } catch (error) {
    console.error('Grant document permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to grant permission' });
  }
};

// ──────────────────────────────────────────────
// REVOKE document permission (admin only)
// DELETE /api/documents/:id/permissions/:permId
// ──────────────────────────────────────────────
export const revokeDocumentPermission = async (req, res) => {
  try {
    const { permId } = req.params;
    const { id: documentId } = req.params;
    const orgId = req.user?.organizationId;

    // Org-scope the target document first (mirrors grant/list) — without this an owner/admin
    // of another tenant could delete this document's ACL rows by guessing the UUIDs.
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId))).limit(1);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    await db.delete(documentPermissions).where(and(eq(documentPermissions.id, permId), eq(documentPermissions.documentId, documentId)));
    res.json({ success: true, message: 'Permission revoked' });
  } catch (error) {
    console.error('Revoke document permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke permission' });
  }
};

// ──────────────────────────────────────────────
// LIST document permissions (admin only)
// GET /api/documents/:id/permissions
// ──────────────────────────────────────────────
export const listDocumentPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const perms = await db.select().from(documentPermissions).where(eq(documentPermissions.documentId, id));
    res.json({ success: true, data: perms });
  } catch (error) {
    console.error('List document permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to list permissions' });
  }
};
