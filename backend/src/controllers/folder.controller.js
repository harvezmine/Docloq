import { db } from '../db/index.js';
import { folders, documents, folderPermissions, trashItems } from '../db/schema.js';
import { eq, and, desc, asc, isNull, like, inArray } from 'drizzle-orm';
import { getAllUserPermissions } from '../middlewares/permission.middleware.js';
import { appendAuditEntry } from '../services/audit.service.js';

// Flat list; the frontend builds the tree.
export const getAllFolders = async (req, res) => {
  try {
    const orgId = req.user?.organizationId;

    if (!orgId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const allFolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.organizationId, orgId), eq(folders.isActive, true)))
      .orderBy(asc(folders.sortOrder), asc(folders.name));

    const allDocs = await db
      .select({ id: documents.id, folderId: documents.folderId })
      .from(documents)
      .where(eq(documents.organizationId, orgId));

    const docCountMap = {};
    for (const doc of allDocs) {
      if (doc.folderId) {
        docCountMap[doc.folderId] = (docCountMap[doc.folderId] || 0) + 1;
      }
    }

    const foldersWithCount = allFolders.map(f => ({
      ...f,
      documentCount: docCountMap[f.id] || 0,
    }));

    const userId = req.user?.userId || req.user?.id;
    if (userId && orgId) {
      const { hasFullAccess, permissions } = await getAllUserPermissions(userId, orgId);

      if (!hasFullAccess) {
        const filteredFolders = foldersWithCount.filter((folder) => {
          const folderKey = `folder:${folder.id}`;
          return permissions[folderKey] && permissions[folderKey] !== 'none';
        });

        return res.json({ success: true, data: filteredFolders });
      }
    }

    res.json({ success: true, data: foldersWithCount });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch folders' });
  }
};

export const getFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const [folder] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.organizationId, orgId)));
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const folderDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.folderId, id))
      .orderBy(desc(documents.createdAt));

    const childFolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.parentId, id), eq(folders.isActive, true)))
      .orderBy(asc(folders.sortOrder), asc(folders.name));

    res.json({
      success: true,
      data: {
        folder,
        documents: folderDocs,
        children: childFolders,
      },
    });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch folder' });
  }
};

export const createFolder = async (req, res) => {
  try {
    const { name, parentId, color, icon, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!orgId || !userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Build materialized path
    let path = `/${name.trim()}`;
    let depth = 0;

    if (parentId) {
      const [parent] = await db.select().from(folders).where(and(eq(folders.id, parentId), eq(folders.organizationId, orgId)));
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent folder not found' });
      }
      path = `${parent.path}/${name.trim()}`;
      depth = (parent.depth || 0) + 1;
    }

    const siblings = await db
      .select()
      .from(folders)
      .where(
        parentId
          ? and(eq(folders.parentId, parentId), eq(folders.organizationId, orgId))
          : and(isNull(folders.parentId), eq(folders.organizationId, orgId)),
      );
    const sortOrder = siblings.length;

    const [newFolder] = await db.insert(folders).values({
      organizationId: orgId,
      name: name.trim(),
      parentId: parentId || null,
      path,
      depth,
      sortOrder,
      color: color || null,
      icon: icon || null,
      description: description || null,
      createdBy: userId,
      isActive: true,
    }).returning();

    if (userId && orgId) {
      await appendAuditEntry({
        organizationId: orgId,
        userId,
        action: 'create',
        resourceType: 'folder',
        resourceId: newFolder.id,
        details: { name: newFolder.name, parentId },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }

    res.status(201).json({ success: true, data: newFolder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to create folder' });
  }
};

export const updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon, description } = req.body;
    const orgId = req.user?.organizationId;

    const [existing] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.organizationId, orgId)));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;

    if (name && name.trim() !== existing.name) {
      const oldPath = existing.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${name.trim()}` : `/${name.trim()}`;
      updates.path = newPath;

      const descendants = await db
        .select()
        .from(folders)
        .where(like(folders.path, `${oldPath}/%`));

      for (const desc of descendants) {
        const updatedPath = desc.path.replace(oldPath, newPath);
        await db.update(folders).set({ path: updatedPath, updatedAt: new Date() }).where(eq(folders.id, desc.id));
      }
    }

    const [updated] = await db
      .update(folders)
      .set(updates)
      .where(eq(folders.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to update folder' });
  }
};

export const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const [existing] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.organizationId, orgId)));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const descendantFolders = await db
      .select()
      .from(folders)
      .where(like(folders.path, `${existing.path}/%`));

    const folderIds = [id, ...descendantFolders.map(f => f.id)];

    for (const fid of folderIds) {
      await db.update(folders).set({ isActive: false, updatedAt: new Date() }).where(eq(folders.id, fid));
    }

    // Docs go to trash (30-day retention) instead of being orphaned to root; mirrors deleteDocument.
    const userId = req.user?.userId || req.user?.id;
    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const docsInFolders = await db
      .select()
      .from(documents)
      .where(and(inArray(documents.folderId, folderIds), isNull(documents.deletedAt)));

    for (const doc of docsInFolders) {
      await db.update(documents).set({
        deletedAt: now, deletedBy: userId, status: 'deleted', updatedAt: now,
      }).where(eq(documents.id, doc.id));
      await db.insert(trashItems).values({
        organizationId: orgId,
        itemType: 'document',
        itemId: doc.id,
        originalFolderId: doc.folderId,
        originalPath: doc.originalFilename,
        itemMetadata: {
          originalFilename: doc.originalFilename,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          ownerId: doc.ownerId,
        },
        autoDeleteAt,
        deletedBy: userId,
        deletedAt: now,
      });
    }

    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete folder' });
  }
};

export const moveDocumentToFolder = async (req, res) => {
  try {
    const { documentId, folderId } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'documentId is required' });
    }

    const orgId = req.user?.organizationId;
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // folderId = null means move to root (unfiled)
    if (folderId) {
      const [folder] = await db.select().from(folders).where(and(eq(folders.id, folderId), eq(folders.organizationId, orgId)));
      if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
      }
    }

    await db
      .update(documents)
      .set({ folderId: folderId || null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    res.json({ success: true, message: 'Document moved successfully' });
  } catch (error) {
    console.error('Move document error:', error);
    res.status(500).json({ success: false, message: 'Failed to move document' });
  }
};

export const moveFolder = async (req, res) => {
  try {
    const { folderId, newParentId } = req.body;

    if (!folderId) {
      return res.status(400).json({ success: false, message: 'folderId is required' });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(folderId)) {
      return res.status(400).json({ success: false, message: 'Invalid folderId format' });
    }
    if (newParentId && !UUID_RE.test(newParentId)) {
      return res.status(400).json({ success: false, message: 'Invalid newParentId format' });
    }

    if (folderId === newParentId) {
      return res.status(400).json({ success: false, message: 'Cannot move folder into itself' });
    }

    const orgId = req.user?.organizationId;
    const [folder] = await db.select().from(folders).where(and(eq(folders.id, folderId), eq(folders.organizationId, orgId)));
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    let parentPath = '';
    if (newParentId) {
      const [parent] = await db.select().from(folders).where(and(eq(folders.id, newParentId), eq(folders.organizationId, orgId)));
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Target folder not found' });
      }
      if (parent.path.startsWith(folder.path + '/')) {
        return res.status(400).json({ success: false, message: 'Cannot move folder into its own descendant' });
      }
      parentPath = parent.path;
    }

    const oldPath = folder.path;
    const newPath = parentPath ? `${parentPath}/${folder.name}` : `/${folder.name}`;

    await db
      .update(folders)
      .set({ parentId: newParentId || null, path: newPath, updatedAt: new Date() })
      .where(eq(folders.id, folderId));

    const descendants = await db
      .select()
      .from(folders)
      .where(like(folders.path, `${oldPath}/%`));

    for (const desc of descendants) {
      const updatedPath = desc.path.replace(oldPath, newPath);
      await db.update(folders).set({ path: updatedPath, updatedAt: new Date() }).where(eq(folders.id, desc.id));
    }

    res.json({ success: true, message: 'Folder moved successfully' });
  } catch (error) {
    console.error('Move folder error:', error);
    res.status(500).json({ success: false, message: 'Failed to move folder' });
  }
};

export const grantFolderPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const grantedBy = req.user?.id || req.user?.userId;
    const { userId, teamId, permissionType = 'read', inheritToSubfolders = true } = req.body;

    if (!userId && !teamId) {
      return res.status(400).json({ success: false, message: 'userId or teamId required' });
    }
    if (!['read', 'read_edit', 'full_access'].includes(permissionType)) {
      return res.status(400).json({ success: false, message: 'permissionType must be read, read_edit, or full_access' });
    }

    const [folder] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.organizationId, orgId)));
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    const [perm] = await db.insert(folderPermissions).values({
      folderId: id,
      userId: userId || null,
      teamId: teamId || null,
      permissionType,
      inheritToSubfolders,
      grantedBy,
    }).returning();

    res.status(201).json({ success: true, data: perm });
  } catch (error) {
    console.error('Grant folder permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to grant permission' });
  }
};

export const revokeFolderPermission = async (req, res) => {
  try {
    const { permId } = req.params;
    const { id: folderId } = req.params;

    await db.delete(folderPermissions).where(and(eq(folderPermissions.id, permId), eq(folderPermissions.folderId, folderId)));
    res.json({ success: true, message: 'Permission revoked' });
  } catch (error) {
    console.error('Revoke folder permission error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke permission' });
  }
};

export const listFolderPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const [folder] = await db.select().from(folders).where(and(eq(folders.id, id), eq(folders.organizationId, orgId)));
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    const perms = await db.select().from(folderPermissions).where(eq(folderPermissions.folderId, id));
    res.json({ success: true, data: perms });
  } catch (error) {
    console.error('List folder permissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to list permissions' });
  }
};
