// DoKi's role-scoped live-data fetchers. Extracted from chatbot.service.js so the tool
// dispatcher (doki-tools.js) can import them without a cycle. Sensitive columns are excluded;
// role `user` is restricted to own rows (owner/admin see the org — the real 3-role model).

import { db } from '../db/index.js';
import { documents, users, tasks } from '../db/schema.js';
import { eq, desc, and, isNull, ilike, or, gte, lte } from 'drizzle-orm';

export const getDocumentsForUser = async (userId, userRole, organizationId, search = '') => {
  try {
    const conditions = [
      eq(documents.organizationId, organizationId),
      isNull(documents.deletedAt),
    ];
    if (userRole === 'user') {
      conditions.push(eq(documents.ownerId, userId));
    }
    if (search) {
      conditions.push(ilike(documents.originalFilename, `%${search}%`));
    }
    const docs = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        originalFilename: documents.originalFilename,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        status: documents.status,
        createdAt: documents.createdAt,
        // NEVER: s3Key, encryptionKeyId, encryptionIv, contentHash, etc.
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(20);
    return docs;
  } catch (error) {
    console.error('getDocumentsForUser error:', error);
    return [];
  }
};

export const getUsersForRole = async (userRole, organizationId) => {
  if (!['owner', 'admin'].includes(userRole)) {
    return { allowed: false, message: 'Kamu tidak memiliki akses untuk melihat daftar user.' };
  }
  try {
    const userList = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        // NEVER: passwordHash, twoFactorSecret, failedLoginAttempts, etc.
      })
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .orderBy(users.firstName);
    return { allowed: true, data: userList };
  } catch (error) {
    console.error('getUsersForRole error:', error);
    return { allowed: true, data: [] };
  }
};

export const getTasksForUser = async (userId, userRole, organizationId, search = '', opts = {}) => {
  try {
    const conditions = [eq(tasks.organizationId, organizationId)];
    if (userRole === 'user') {
      conditions.push(eq(tasks.assignedTo, userId));
    }
    if (opts.activeOnly !== false) {
      conditions.push(or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')));
    }
    if (opts.urgentOnly) {
      const now = new Date();
      const horizon = new Date(now.getTime() + (opts.daysAhead || 7) * 24 * 60 * 60 * 1000);
      conditions.push(gte(tasks.dueDate, now));
      conditions.push(lte(tasks.dueDate, horizon));
    }
    if (search) {
      conditions.push(or(ilike(tasks.title, `%${search}%`), ilike(tasks.description, `%${search}%`)));
    }
    const userTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        taskType: tasks.taskType,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        assigneeName: users.firstName,
        assigneeLastName: users.lastName,
        assigneeEmail: users.email,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.priority), tasks.dueDate)
      .limit(20);
    return userTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      assignee: t.assigneeName
        ? `${t.assigneeName}${t.assigneeLastName ? ' ' + t.assigneeLastName : ''}`
        : t.assigneeEmail || null,
    }));
  } catch (error) {
    console.error('getTasksForUser error:', error);
    return [];
  }
};
