// Document edit-lock service — 2-hour absolute, single editor at a time

import { db } from '../db/index.js';
import { documents, users } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const LOCK_DURATION_MS = 2 * 60 * 60 * 1000;

function isLockActive(doc) {
  if (!doc?.editLockedBy || !doc?.editLockExpiresAt) return false;
  return new Date(doc.editLockExpiresAt).getTime() > Date.now();
}

// Acquire edit lock; same-user reacquire extends the existing lock.
export async function acquireEditLock(documentId, userId) {
  return await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT id, edit_locked_by, edit_lock_acquired_at, edit_lock_expires_at
          FROM documents WHERE id = ${documentId} FOR UPDATE`
    );
    const doc = rows.rows?.[0] || rows[0];
    if (!doc) return { acquired: false, reason: 'not_found' };

    const lockedBy = doc.edit_locked_by;
    const expiresAt = doc.edit_lock_expires_at;
    const active = lockedBy && expiresAt && new Date(expiresAt).getTime() > Date.now();

    if (active && lockedBy !== userId) {
      // Diambil user lain — fetch nama untuk banner
      const [owner] = await tx.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }).from(users).where(eq(users.id, lockedBy));
      const name = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : 'User';
      return {
        acquired: false,
        lockedBy,
        lockedByName: name,
        expiresAt,
      };
    }

    // Acquire / re-acquire (own lock)
    const newAcquired = new Date();
    const newExpires = new Date(newAcquired.getTime() + LOCK_DURATION_MS);
    await tx.update(documents).set({
      editLockedBy: userId,
      editLockAcquiredAt: newAcquired,
      editLockExpiresAt: newExpires,
    }).where(eq(documents.id, documentId));

    return {
      acquired: true,
      lockedBy: userId,
      expiresAt: newExpires,
    };
  });
}

// Release lock only if the requesting user owns it.
export async function releaseEditLock(documentId, userId) {
  await db.update(documents).set({
    editLockedBy: null,
    editLockAcquiredAt: null,
    editLockExpiresAt: null,
  }).where(sql`${documents.id} = ${documentId} AND ${documents.editLockedBy} = ${userId}`);
}

// Force release — admin override / system cleanup.
export async function forceReleaseLock(documentId) {
  await db.update(documents).set({
    editLockedBy: null,
    editLockAcquiredAt: null,
    editLockExpiresAt: null,
  }).where(eq(documents.id, documentId));
}

export { isLockActive };
