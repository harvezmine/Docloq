// Document comments — threaded, with @mention notification fan-out

import { db } from '../db/index.js';
import {
  documentComments,
  documents,
  documentPermissions,
  users,
} from '../db/schema.js';
import { and, eq, sql, asc, isNull, or } from 'drizzle-orm';
import { createNotification } from './notification.service.js';

// Create a comment; notifies mentioned users + doc owner (author excluded).
export async function createComment(documentId, authorId, content, mentions = [], parentCommentId = null) {
  const [comment] = await db.insert(documentComments).values({
    documentId,
    authorId,
    content,
    mentions,
    parentCommentId,
  }).returning();

  const [doc] = await db.select({
    ownerId: documents.ownerId,
    filename: documents.originalFilename,
  }).from(documents).where(eq(documents.id, documentId));

  const [author] = await db.select({
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  }).from(users).where(eq(users.id, authorId));

  const authorName = `${author?.firstName || ''} ${author?.lastName || ''}`.trim() || author?.email || 'Seseorang';
  const docName = doc?.filename || 'dokumen';
  const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;

  const recipients = new Set();
  for (const uid of mentions || []) {
    if (uid && uid !== authorId) recipients.add(uid);
  }
  const isOwnerMentioned = doc?.ownerId && mentions?.includes(doc.ownerId);
  const ownerGetsNotif = doc?.ownerId && doc.ownerId !== authorId && !isOwnerMentioned;

  (async () => {
    try {
      for (const uid of recipients) {
        await createNotification(uid, {
          type: 'comment_mention',
          title: `${authorName} menandai Anda di ${docName}`,
          message: preview,
          relatedType: 'document',
          relatedId: documentId,
        });
      }
      if (ownerGetsNotif) {
        await createNotification(doc.ownerId, {
          type: 'document_comment',
          title: `${authorName} mengomentari ${docName}`,
          message: preview,
          relatedType: 'document',
          relatedId: documentId,
        });
      }
    } catch (e) {
      console.warn('[comment] notif fanout failed:', e.message);
    }
  })();

  return comment;
}

// List comments threaded: root comments with their replies nested underneath.
export async function listComments(documentId) {
  const rows = await db
    .select({
      id: documentComments.id,
      documentId: documentComments.documentId,
      authorId: documentComments.authorId,
      content: documentComments.content,
      mentions: documentComments.mentions,
      parentCommentId: documentComments.parentCommentId,
      editedAt: documentComments.editedAt,
      createdAt: documentComments.createdAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorEmail: users.email,
      authorAvatar: users.avatarUrl,
    })
    .from(documentComments)
    .leftJoin(users, eq(documentComments.authorId, users.id))
    .where(and(eq(documentComments.documentId, documentId), isNull(documentComments.deletedAt)))
    .orderBy(asc(documentComments.createdAt));

  const mapped = rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    authorId: r.authorId,
    authorName: `${r.authorFirstName || ''} ${r.authorLastName || ''}`.trim() || r.authorEmail || 'Pengguna',
    authorAvatar: r.authorAvatar,
    content: r.content,
    mentions: r.mentions || [],
    parentCommentId: r.parentCommentId,
    editedAt: r.editedAt,
    createdAt: r.createdAt,
    replies: [],
  }));

  const byId = new Map(mapped.map((c) => [c.id, c]));
  const roots = [];
  for (const c of mapped) {
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId).replies.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

// Soft delete comment. Allowed: author, or an owner/admin.
export async function deleteComment(commentId, userId, userRole) {
  const [c] = await db.select().from(documentComments).where(eq(documentComments.id, commentId));
  if (!c) return { ok: false, reason: 'not_found' };

  const isModerator = ['owner', 'admin'].includes(userRole);
  if (c.authorId !== userId && !isModerator) {
    return { ok: false, reason: 'forbidden' };
  }

  await db.update(documentComments).set({ deletedAt: new Date() }).where(eq(documentComments.id, commentId));
  return { ok: true };
}

// Search mentionable users: same-org match on name/email; flags users with explicit doc permission.
export async function searchMentionableUsers(documentId, query) {
  const [doc] = await db.select({
    organizationId: documents.organizationId,
    ownerId: documents.ownerId,
  }).from(documents).where(eq(documents.id, documentId));
  if (!doc) return [];

  const permUserIds = await db.select({ userId: documentPermissions.userId })
    .from(documentPermissions)
    .where(and(eq(documentPermissions.documentId, documentId), sql`${documentPermissions.userId} IS NOT NULL`));
  const allowedIds = new Set([
    doc.ownerId,
    ...permUserIds.map((p) => p.userId).filter(Boolean),
  ]);

  const q = `%${(query || '').toLowerCase()}%`;
  const rows = await db.select({
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
    avatarUrl: users.avatarUrl,
  })
    .from(users)
    .where(and(
      eq(users.organizationId, doc.organizationId),
      eq(users.isActive, true),
      or(
        sql`LOWER(${users.firstName}) LIKE ${q}`,
        sql`LOWER(${users.lastName}) LIKE ${q}`,
        sql`LOWER(${users.email}) LIKE ${q}`,
      ),
    ))
    .limit(10);

  return rows.map((u) => ({
    id: u.id,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
    email: u.email,
    avatarUrl: u.avatarUrl,
    hasExplicitPermission: allowedIds.has(u.id),
  }));
}
