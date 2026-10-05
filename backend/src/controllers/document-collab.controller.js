import { db } from '../db/index.js';
import { documents, folders } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  heartbeat as presenceHeartbeat,
  getPresence,
  leavePresence,
} from '../services/document-presence.service.js';
import { releaseEditLock, forceReleaseLock, acquireEditLock } from '../services/document-lock.service.js';
import {
  createComment,
  listComments,
  deleteComment,
  searchMentionableUsers,
} from '../services/document-comment.service.js';
import { appendAuditEntry } from '../services/audit.service.js';

export async function getPresenceHandler(req, res) {
  try {
    const { id } = req.params;
    const list = await getPresence(id);
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error('getPresence error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch presence' });
  }
}

export async function postHeartbeatHandler(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const mode = req.body?.mode || req.query?.mode || 'view';
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!['view', 'edit'].includes(mode)) return res.status(400).json({ success: false, message: 'Invalid mode' });
    await presenceHeartbeat(id, userId, mode);
    return res.json({ success: true });
  } catch (err) {
    console.error('heartbeat error:', err);
    return res.status(500).json({ success: false, message: 'Heartbeat failed' });
  }
}

export async function deletePresenceHandler(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await leavePresence(id, userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('leave presence error:', err);
    return res.status(500).json({ success: false, message: 'Leave failed' });
  }
}

export async function releaseLockHandler(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await releaseEditLock(id, userId);
    return res.json({ success: true });
  } catch (err) {
    console.error('release lock error:', err);
    return res.status(500).json({ success: false, message: 'Release failed' });
  }
}

// Admin-only recovery for stuck locks
export async function forceReleaseLockHandler(req, res) {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    if (!['owner', 'admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await forceReleaseLock(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('force release lock error:', err);
    return res.status(500).json({ success: false, message: 'Force release failed' });
  }
}

// Viewer notifies whoever currently holds the edit lock
export async function pingLockOwnerHandler(req, res) {
  try {
    const { id } = req.params;
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { db } = await import('../db/index.js');
    const { documents, users } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [doc] = await db.select({
      editLockedBy: documents.editLockedBy,
      filename: documents.originalFilename,
    }).from(documents).where(eq(documents.id, id));

    if (!doc?.editLockedBy) {
      return res.status(404).json({ success: false, message: 'No active editor' });
    }
    if (doc.editLockedBy === senderId) {
      return res.status(400).json({ success: false, message: 'Cannot ping yourself' });
    }

    const [sender] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    }).from(users).where(eq(users.id, senderId));
    const senderName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || sender?.email || 'Seseorang';

    const { createNotification } = await import('../services/notification.service.js');
    await createNotification(doc.editLockedBy, {
      type: 'edit_access_request',
      title: `${senderName} ingin mengedit ${doc.filename}`,
      message: 'Klik untuk membuka dokumen dan koordinasi via komentar.',
      relatedType: 'document',
      relatedId: id,
    });

    return res.json({ success: true, senderName });
  } catch (err) {
    console.error('ping lock owner error:', err);
    return res.status(500).json({ success: false, message: 'Ping failed' });
  }
}

export async function getBreadcrumbHandler(req, res) {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const [doc] = await db.select({
      id: documents.id,
      filename: documents.originalFilename,
      folderId: documents.folderId,
    }).from(documents).where(eq(documents.id, id));

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const chain = [];
    let currentFolderId = doc.folderId;
    // Walk parentId chain; 12-level cap guards against cycles
    for (let i = 0; i < 12 && currentFolderId; i++) {
      const [f] = await db.select({
        id: folders.id,
        name: folders.name,
        parentId: folders.parentId,
      }).from(folders).where(eq(folders.id, currentFolderId));
      if (!f) break;
      chain.unshift({ id: f.id, name: f.name });
      currentFolderId = f.parentId;
    }

    return res.json({
      success: true,
      data: {
        folders: chain, // root first, immediate parent last
        filename: doc.filename,
      },
    });
  } catch (err) {
    console.error('breadcrumb error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch breadcrumb' });
  }
}

export async function renameDocumentHandler(req, res) {
  try {
    const { id } = req.params;
    const { filename } = req.body;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!filename || filename.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Filename required' });
    }
    if (filename.length > 255) {
      return res.status(400).json({ success: false, message: 'Filename too long' });
    }

    const [prev] = await db
      .select({ originalFilename: documents.originalFilename })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));
    if (!prev) return res.status(404).json({ success: false, message: 'Document not found' });

    await db.update(documents).set({
      originalFilename: filename.trim(),
      updatedAt: new Date(),
    }).where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));

    // Audit: rename is a metadata edit — record it. Non-fatal.
    try {
      await appendAuditEntry({
        organizationId: orgId,
        userId: req.user?.id,
        action: 'update',
        resourceType: 'document',
        resourceId: id,
        details: { action: 'rename', filename: filename.trim() },
        previousState: { originalFilename: prev.originalFilename },
        newState: { originalFilename: filename.trim() },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (auditErr) { console.warn('[Audit] rename log failed:', auditErr.message); }

    return res.json({ success: true, data: { id, filename: filename.trim() } });
  } catch (err) {
    console.error('rename error:', err);
    return res.status(500).json({ success: false, message: 'Rename failed' });
  }
}

export async function listCommentsHandler(req, res) {
  try {
    const { id } = req.params;
    const data = await listComments(id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('list comments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch comments' });
  }
}

export async function createCommentHandler(req, res) {
  try {
    const { id } = req.params;
    const { content, mentions = [], parentCommentId = null } = req.body || {};
    const authorId = req.user?.id;
    if (!authorId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Content required' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ success: false, message: 'Comment too long' });
    }
    const comment = await createComment(id, authorId, content.trim(), mentions, parentCommentId);
    return res.json({ success: true, data: comment });
  } catch (err) {
    console.error('create comment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to post comment' });
  }
}

export async function deleteCommentHandler(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await deleteComment(commentId, userId, userRole);
    if (!result.ok) {
      const status = result.reason === 'forbidden' ? 403 : 404;
      return res.status(status).json({ success: false, message: result.reason });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('delete comment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete' });
  }
}

export async function getMentionableUsersHandler(req, res) {
  try {
    const { id } = req.params;
    const q = req.query?.q || '';
    const users = await searchMentionableUsers(id, q);
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('mentionable users error:', err);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
}
