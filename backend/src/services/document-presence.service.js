// Document presence — heartbeat-based, stale rows filtered by query

import { db } from '../db/index.js';
import { documentPresence, users } from '../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';

const PRESENCE_STALE_MS = 30 * 1000;

// Upsert heartbeat. Mode: 'view' | 'edit'.
export async function heartbeat(documentId, userId, mode) {
  await db.execute(sql`
    INSERT INTO document_presence (document_id, user_id, mode, last_heartbeat_at)
    VALUES (${documentId}, ${userId}, ${mode}, NOW())
    ON CONFLICT (document_id, user_id)
    DO UPDATE SET mode = EXCLUDED.mode, last_heartbeat_at = NOW()
  `);
}

// Active presence for a document (heartbeat within last 30s).
export async function getPresence(documentId) {
  const cutoff = new Date(Date.now() - PRESENCE_STALE_MS);
  const rows = await db
    .select({
      userId: documentPresence.userId,
      mode: documentPresence.mode,
      lastSeen: documentPresence.lastHeartbeatAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(documentPresence)
    .innerJoin(users, eq(documentPresence.userId, users.id))
    .where(
      and(
        eq(documentPresence.documentId, documentId),
        sql`${documentPresence.lastHeartbeatAt} > ${cutoff}`,
      ),
    );

  return rows.map((r) => ({
    userId: r.userId,
    name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email,
    avatarUrl: r.avatarUrl,
    mode: r.mode,
    lastSeen: r.lastSeen,
  }));
}

// Remove user from presence (explicit leave / sendBeacon).
export async function leavePresence(documentId, userId) {
  await db.delete(documentPresence).where(
    and(eq(documentPresence.documentId, documentId), eq(documentPresence.userId, userId)),
  );
}
