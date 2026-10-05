import { db } from '../db/index.js';
import {
  documents,
  tasks,
  users,
  folders,
  forms,
  formInstances,
  trashItems,
  auditLogs,
  aiQuotas,
} from '../db/schema.js';
import { eq, and, desc, sql, isNull, gte, count } from 'drizzle-orm';

// GET /api/dashboard/stats
export const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const isAdminUser = userRole === 'owner' || userRole === 'admin';

    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allDocs = await db
      .select({
        id: documents.id,
        originalFilename: documents.originalFilename,
        filename: documents.filename,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        status: documents.status,
        ownerId: documents.ownerId,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(
        eq(documents.organizationId, orgId),
        isNull(documents.deletedAt),
      ))
      .orderBy(desc(documents.createdAt));

    const totalDocuments = allDocs.length;
    const totalStorageBytes = allDocs.reduce((sum, d) => sum + (Number(d.fileSize) || 0), 0);

    const typeMap = {};
    for (const doc of allDocs) {
      const ext = getFileExtension(doc.mimeType, doc.originalFilename || doc.filename);
      typeMap[ext] = (typeMap[ext] || 0) + 1;
    }
    const documentTypes = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count, percent: totalDocuments > 0 ? Math.round((count / totalDocuments) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentDocIds = allDocs.slice(0, 5);
    let recentDocuments = [];
    if (recentDocIds.length > 0) {
      const ownerIds = [...new Set(recentDocIds.map(d => d.ownerId).filter(Boolean))];
      let ownersMap = {};
      if (ownerIds.length > 0) {
        const owners = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users)
          .where(sql`${users.id} IN ${ownerIds}`);
        for (const o of owners) {
          ownersMap[o.id] = o.firstName ? `${o.firstName}${o.lastName ? ' ' + o.lastName : ''}` : o.email?.split('@')[0];
        }
      }
      recentDocuments = recentDocIds.map(d => ({
        id: d.id,
        name: d.originalFilename || d.filename,
        type: getFileExtension(d.mimeType, d.originalFilename || d.filename),
        size: formatFileSize(Number(d.fileSize) || 0),
        status: d.status,
        uploadedBy: ownersMap[d.ownerId] || 'Unknown',
        createdAt: d.createdAt,
      }));
    }

    const taskConditions = [eq(tasks.organizationId, orgId)];
    if (!isAdminUser) {
      taskConditions.push(eq(tasks.assignedTo, userId));
    }

    const allTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        taskType: tasks.taskType,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        assignedTo: tasks.assignedTo,
        createdAt: tasks.createdAt,
        assigneeFirst: users.firstName,
        assigneeLast: users.lastName,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(...taskConditions))
      .orderBy(desc(tasks.createdAt));

    const totalTasks = allTasks.length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;

    const now = new Date();
    const overdueTasks = allTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed' && t.status !== 'cancelled'
    ).length;

    // Sort open tasks: overdue first, then priority, then nearest deadline
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const upcomingTasks = allTasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .sort((a, b) => {
        const aDate = a.dueDate ? new Date(a.dueDate) : null;
        const bDate = b.dueDate ? new Date(b.dueDate) : null;
        const aOverdue = aDate && aDate < now ? 1 : 0;
        const bOverdue = bDate && bDate < now ? 1 : 0;
        if (bOverdue !== aOverdue) return bOverdue - aOverdue;
        const aPri = priorityOrder[a.priority] ?? 4;
        const bPri = priorityOrder[b.priority] ?? 4;
        if (aPri !== bPri) return aPri - bPri;
        if (aDate && bDate) return aDate - bDate;
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      })
      .slice(0, 8)
      .map(t => ({
        id: t.id,
        title: t.title,
        taskType: t.taskType,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assignee: t.assigneeFirst
          ? `${t.assigneeFirst}${t.assigneeLast ? ' ' + t.assigneeLast : ''}`
          : null,
      }));

    const [folderCount] = await db
      .select({ count: count() })
      .from(folders)
      .where(and(eq(folders.organizationId, orgId), eq(folders.isActive, true)));

    const [templateCount] = await db
      .select({ count: count() })
      .from(forms)
      .where(eq(forms.organizationId, orgId));

    const [instanceCount] = await db
      .select({ count: count() })
      .from(formInstances)
      .where(eq(formInstances.organizationId, orgId));

    let userCount = 0;
    if (isAdminUser) {
      const [uc] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.organizationId, orgId), eq(users.isActive, true)));
      userCount = uc?.count || 0;
    }

    const activityConditions = [eq(auditLogs.organizationId, orgId)];
    if (!isAdminUser) {
      activityConditions.push(eq(auditLogs.userId, userId));
    }
    const recentActivityRaw = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...activityConditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8);

    const recentActivity = recentActivityRaw.map(a => ({
      id: a.id,
      action: a.action,
      resourceType: a.resourceType,
      description: formatActivityDescription(a.action, a.resourceType, a.details),
      user: a.userFirstName ? `${a.userFirstName}${a.userLastName ? ' ' + a.userLastName : ''}` : a.userEmail?.split('@')[0] || 'System',
      createdAt: a.createdAt,
    }));

    const [trashCount] = await db
      .select({ count: count() })
      .from(trashItems)
      .where(eq(trashItems.organizationId, orgId));

    const [aiAccessCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(and(
        eq(documents.organizationId, orgId),
        eq(documents.aiAccessGranted, true),
        isNull(documents.deletedAt),
      ));

    let aiQuota = null;
    const [quotaRow] = await db
      .select()
      .from(aiQuotas)
      .where(eq(aiQuotas.organizationId, orgId))
      .limit(1);
    if (quotaRow) {
      aiQuota = {
        analysesUsed: quotaRow.analysisUsedThisMonth || 0,
        analysesLimit: quotaRow.monthlyAnalysisLimit || 100,
        pagesUsed: quotaRow.pagesUsedThisMonth || 0,
        pagesLimit: quotaRow.monthlyPagesLimit || 500,
        totalAnalysesAllTime: quotaRow.totalAnalysesAllTime || 0,
        totalPagesAllTime: quotaRow.totalPagesAllTime || 0,
      };
    }

    const storageByType = {};
    for (const doc of allDocs) {
      const ext = getFileExtension(doc.mimeType, doc.originalFilename || doc.filename);
      storageByType[ext] = (storageByType[ext] || 0) + (Number(doc.fileSize) || 0);
    }
    const storageBreakdown = Object.entries(storageByType)
      .map(([type, bytes]) => ({ type, size: formatFileSize(bytes), bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 6);

    return res.json({
      success: true,
      data: {
        stats: {
          totalDocuments,
          totalStorage: formatFileSize(totalStorageBytes),
          totalStorageBytes,
          totalTasks,
          pendingTasks,
          inProgressTasks,
          completedTasks,
          overdueTasks,
          totalFolders: folderCount?.count || 0,
          totalTemplates: templateCount?.count || 0,
          totalFormInstances: instanceCount?.count || 0,
          totalUsers: userCount,
          trashItems: trashCount?.count || 0,
          aiAccessDocs: aiAccessCount?.count || 0,
        },
        recentDocuments,
        documentTypes,
        storageBreakdown,
        aiQuota,
        upcomingTasks,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

function getFileExtension(mimeType, filename) {
  if (filename) {
    const ext = filename.split('.').pop()?.toUpperCase();
    if (ext) return ext;
  }
  const mimeMap = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
  };
  return mimeMap[mimeType] || 'FILE';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

function formatActivityDescription(action, resourceType, details) {
  const resourceLabel = resourceType || 'item';
  const name = details?.filename || details?.originalFilename || details?.name || details?.title || '';
  const nameStr = name ? ` "${name}"` : '';
  
  const actionMap = {
    create: `Created ${resourceLabel}${nameStr}`,
    read: `Viewed ${resourceLabel}${nameStr}`,
    update: `Updated ${resourceLabel}${nameStr}`,
    delete: `Deleted ${resourceLabel}${nameStr}`,
    download: `Downloaded ${resourceLabel}${nameStr}`,
    share: `Shared ${resourceLabel}${nameStr}`,
    verify: `Verified ${resourceLabel}${nameStr}`,
    restore: `Restored ${resourceLabel}${nameStr}`,
    archive: `Archived ${resourceLabel}${nameStr}`,
  };
  return actionMap[action] || `${action} ${resourceLabel}${nameStr}`;
}
