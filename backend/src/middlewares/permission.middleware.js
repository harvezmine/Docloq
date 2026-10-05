// Permission Middleware — checks user's document/folder access based on custom roles

import { db } from '../db/index.js';
import {
  users,
  customRoles,
  rolePermissions,
  userRoleAssignments,
  folders,
  documents,
  folderPermissions,
  documentPermissions,
  teamMembers,
} from '../db/schema.js';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';

// Resolve the team IDs a user belongs to (for team-granted permissions).
const getUserTeamIds = async (userId) => {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return rows.map((r) => r.teamId).filter(Boolean);
};

// Build the ancestor folder id chain (self + parents) for inheritance checks.
const getFolderChain = async (folderId) => {
  const chain = [];
  let current = folderId;
  let guard = 0;
  while (current && guard < 64) {
    const [f] = await db
      .select({ id: folders.id, parentId: folders.parentId })
      .from(folders)
      .where(eq(folders.id, current))
      .limit(1);
    if (!f) break;
    chain.push(f.id);
    current = f.parentId;
    guard++;
  }
  return chain;
};

const PERM_PRIORITY = { none: 0, viewer: 1, editor: 2, admin: 3 };

const mapPermType = (t) => t === 'full_access' ? 'admin' : t === 'read_edit' ? 'editor' : 'viewer';

// Returns the highest permission level granted from any assigned role.
export const getUserPermissionLevel = async (userId, resourceType, resourceId, organizationId) => {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return 'none';

  // Admin and super_admin have full access
  if (['owner', 'admin'].includes(user.role)) {
    return 'admin';
  }

  // Team memberships — permissions can be granted to a whole team.
  const teamIds = await getUserTeamIds(userId);
  const principalOr = (table) => teamIds.length > 0
    ? or(eq(table.userId, userId), inArray(table.teamId, teamIds))
    : eq(table.userId, userId);

  // Check direct documentPermissions (highest priority after admin shortcut)
  if (resourceType === 'document') {
    const directRows = await db
      .select({ permissionType: documentPermissions.permissionType })
      .from(documentPermissions)
      .where(and(eq(documentPermissions.documentId, resourceId), principalOr(documentPermissions)));
    // Take the highest level among user + team grants.
    let best = null;
    for (const r of directRows) {
      const lvl = mapPermType(r.permissionType);
      if (!best || PERM_PRIORITY[lvl] > PERM_PRIORITY[best]) best = lvl;
    }
    if (best) return best;
  }

  // Walk the folder ancestor chain so a parent grant with inheritToSubfolders=true cascades down.
  if (resourceType === 'folder' || resourceType === 'document') {
    let folderIdToCheck = resourceId;
    if (resourceType === 'document') {
      const [doc2] = await db
        .select({ folderId: documents.folderId })
        .from(documents)
        .where(and(eq(documents.id, resourceId), eq(documents.organizationId, organizationId)))
        .limit(1);
      folderIdToCheck = doc2?.folderId;
    }

    if (folderIdToCheck) {
      const chain = await getFolderChain(folderIdToCheck);
      let best = null;
      for (let i = 0; i < chain.length; i++) {
        const fid = chain[i];
        const rows = await db
          .select({ permissionType: folderPermissions.permissionType, inheritToSubfolders: folderPermissions.inheritToSubfolders })
          .from(folderPermissions)
          .where(and(eq(folderPermissions.folderId, fid), principalOr(folderPermissions)));
        for (const r of rows) {
          // Direct folder (i===0) always applies; ancestor grants only if they inherit.
          if (i === 0 || r.inheritToSubfolders) {
            const lvl = mapPermType(r.permissionType);
            if (!best || PERM_PRIORITY[lvl] > PERM_PRIORITY[best]) best = lvl;
          }
        }
      }
      if (best) return best;
    }
  }

  const assignments = await db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.id))
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(customRoles.organizationId, organizationId),
        eq(customRoles.isActive, true)
      )
    );

  if (assignments.length === 0) return 'none';

  const roleIds = assignments.map((a) => a.roleId);

  const perms = await db
    .select({ permissionLevel: rolePermissions.permissionLevel })
    .from(rolePermissions)
    .where(
      and(
        inArray(rolePermissions.roleId, roleIds),
        eq(rolePermissions.resourceType, resourceType),
        eq(rolePermissions.resourceId, resourceId)
      )
    );

  if (resourceType === 'document') {
    const [doc] = await db
      .select({ folderId: documents.folderId })
      .from(documents)
      .where(and(eq(documents.id, resourceId), eq(documents.organizationId, organizationId)))
      .limit(1);

    if (doc?.folderId) {
      const folderPerms = await db
        .select({ permissionLevel: rolePermissions.permissionLevel })
        .from(rolePermissions)
        .where(
          and(
            inArray(rolePermissions.roleId, roleIds),
            eq(rolePermissions.resourceType, 'folder'),
            eq(rolePermissions.resourceId, doc.folderId)
          )
        );
      perms.push(...folderPerms);
    }
  }

  let highest = 'none';
  for (const perm of perms) {
    if ((PERM_PRIORITY[perm.permissionLevel] || 0) > (PERM_PRIORITY[highest] || 0)) {
      highest = perm.permissionLevel;
    }
  }

  return highest;
};

/**
 * Get all resource permissions for a user (used for filtering document/folder lists).
 * Returns a map of { "folder:<id>": "viewer", "document:<id>": "editor", ... }
 */
export const getAllUserPermissions = async (userId, organizationId) => {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { hasFullAccess: false, permissions: {} };

  // Admin and super_admin have full access
  if (['owner', 'admin'].includes(user.role)) {
    return { hasFullAccess: true, permissions: {} };
  }

  const assignments = await db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.id))
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(customRoles.organizationId, organizationId),
        eq(customRoles.isActive, true)
      )
    );

  const merged = {};

  // Custom-role permissions (if any role assigned).
  if (assignments.length > 0) {
    const roleIds = assignments.map((a) => a.roleId);
    const allPerms = await db
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));
    for (const perm of allPerms) {
      const key = `${perm.resourceType}:${perm.resourceId}`;
      const current = merged[key] || 'none';
      if ((PERM_PRIORITY[perm.permissionLevel] || 0) > (PERM_PRIORITY[current] || 0)) {
        merged[key] = perm.permissionLevel;
      }
    }
  }

  // Team memberships — folder/doc grants can target a whole team.
  const teamIds = await getUserTeamIds(userId);
  const principalOr = (table) => teamIds.length > 0
    ? or(eq(table.userId, userId), inArray(table.teamId, teamIds))
    : eq(table.userId, userId);

  // Direct + team folderPermissions grants.
  const fpRows = await db
    .select({ folderId: folderPermissions.folderId, permissionType: folderPermissions.permissionType })
    .from(folderPermissions)
    .where(principalOr(folderPermissions));
  for (const fp of fpRows) {
    const key = `folder:${fp.folderId}`;
    const current = merged[key] || 'none';
    const mapped = mapPermType(fp.permissionType);
    if ((PERM_PRIORITY[mapped] || 0) > (PERM_PRIORITY[current] || 0)) {
      merged[key] = mapped;
    }
  }

  // Direct + team documentPermissions grants.
  const dpRows = await db
    .select({ documentId: documentPermissions.documentId, permissionType: documentPermissions.permissionType })
    .from(documentPermissions)
    .where(principalOr(documentPermissions));
  for (const dp of dpRows) {
    const key = `document:${dp.documentId}`;
    const current = merged[key] || 'none';
    const mapped = mapPermType(dp.permissionType);
    if ((PERM_PRIORITY[mapped] || 0) > (PERM_PRIORITY[current] || 0)) {
      merged[key] = mapped;
    }
  }

  return { hasFullAccess: false, permissions: merged };
};

// Expects req.params.id to be the document/folder ID.
export const requireDocumentPermission = (minLevel = 'viewer') => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      const organizationId = req.user?.organizationId;
      const resourceId = req.params.id;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const permLevel = await getUserPermissionLevel(userId, 'document', resourceId, organizationId);
      
      if ((PERM_PRIORITY[permLevel] || 0) < (PERM_PRIORITY[minLevel] || 0)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this document',
          requiredLevel: minLevel,
          currentLevel: permLevel,
        });
      }

      req.permissionLevel = permLevel;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
};

export const requireFolderPermission = (minLevel = 'viewer') => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      const organizationId = req.user?.organizationId;
      const resourceId = req.params.id;

      if (!userId || !organizationId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const permLevel = await getUserPermissionLevel(userId, 'folder', resourceId, organizationId);
      
      if ((PERM_PRIORITY[permLevel] || 0) < (PERM_PRIORITY[minLevel] || 0)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this folder',
          requiredLevel: minLevel,
          currentLevel: permLevel,
        });
      }

      req.permissionLevel = permLevel;
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed',
      });
    }
  };
};

export default {
  getUserPermissionLevel,
  getAllUserPermissions,
  requireDocumentPermission,
  requireFolderPermission,
};
