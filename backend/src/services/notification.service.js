import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function createNotification(userId, { type, title, message, relatedType = null, relatedId = null }) {
  const [notif] = await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    relatedType,
    relatedId,
  }).returning();
  return notif;
}

export async function getUserNotifications(userId, { limit = 30, offset = 0 } = {}) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql`count(*)::int` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const [{ unread }] = await db
    .select({ unread: sql`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return { notifications: rows, total: count, unread };
}

export async function getUnreadCount(userId) {
  const [{ count }] = await db
    .select({ count: sql`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return count;
}

export async function markAsRead(notificationId, userId) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();
  return updated;
}

export async function markAllAsRead(userId) {
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result;
}

export async function deleteNotification(notificationId, userId) {
  const [deleted] = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();
  return deleted;
}
