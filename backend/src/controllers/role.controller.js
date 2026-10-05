import { db } from '../db/index.js';
import {
  customRoles,
  rolePermissions,
  userRoleAssignments,
  users,
  folders,
  documents,
} from '../db/schema.js';
import { eq, and, sql, desc, count, inArray } from 'drizzle-orm';

// Keeps only userIds belonging to the caller's org, preventing cross-tenant role assignment
const filterOrgUserIds = async (userIds, organizationId) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.organizationId, organizationId)));
  return rows.map((r) => r.id);
};

export const getRoles = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const allRoles = await db
      .select({
        id: customRoles.id,
        name: customRoles.name,
        description: customRoles.description,
        color: customRoles.color,
        isActive: customRoles.isActive,
        createdBy: customRoles.createdBy,
        createdAt: customRoles.createdAt,
        updatedAt: customRoles.updatedAt,
      })
      .from(customRoles)
      .where(eq(customRoles.organizationId, organizationId))
      .orderBy(desc(customRoles.createdAt));

    const memberCounts = await db
      .select({
        roleId: userRoleAssignments.roleId,
        count: count(),
      })
      .from(userRoleAssignments)
      .where(
        inArray(
          userRoleAssignments.roleId,
          allRoles.map((r) => r.id)
        )
      )
      .groupBy(userRoleAssignments.roleId);

    const memberCountMap = Object.fromEntries(
      memberCounts.map((mc) => [mc.roleId, Number(mc.count)])
    );

    const allPermissions = await db
      .select()
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          allRoles.map((r) => r.id)
        )
      );

    const permissionMap = {};
    for (const perm of allPermissions) {
      if (!permissionMap[perm.roleId]) permissionMap[perm.roleId] = {};
      const key = `${perm.resourceType}:${perm.resourceId}`;
      permissionMap[perm.roleId][key] = perm.permissionLevel;
    }

    const allAssignments = await db
      .select({
        roleId: userRoleAssignments.roleId,
        userId: userRoleAssignments.userId,
        assignedAt: userRoleAssignments.assignedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(userRoleAssignments)
      .innerJoin(users, eq(userRoleAssignments.userId, users.id))
      .where(
        inArray(
          userRoleAssignments.roleId,
          allRoles.map((r) => r.id)
        )
      );

    const assignmentMap = {};
    for (const assignment of allAssignments) {
      if (!assignmentMap[assignment.roleId]) assignmentMap[assignment.roleId] = [];
      assignmentMap[assignment.roleId].push({
        userId: assignment.userId,
        email: assignment.userEmail,
        firstName: assignment.userFirstName,
        lastName: assignment.userLastName,
        assignedAt: assignment.assignedAt,
      });
    }

    const rolesWithData = allRoles.map((role) => ({
      ...role,
      members: memberCountMap[role.id] || 0,
      permissions: permissionMap[role.id] || {},
      assignedUsers: assignmentMap[role.id] || [],
    }));

    res.json({
      success: true,
      data: rolesWithData,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
    });
  }
};

export const getRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [role] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)))
      .limit(1);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const perms = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id));

    const permissions = {};
    for (const perm of perms) {
      const key = `${perm.resourceType}:${perm.resourceId}`;
      permissions[key] = perm.permissionLevel;
    }

    const assignments = await db
      .select({
        userId: userRoleAssignments.userId,
        assignedAt: userRoleAssignments.assignedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(userRoleAssignments)
      .innerJoin(users, eq(userRoleAssignments.userId, users.id))
      .where(eq(userRoleAssignments.roleId, id));

    const memberCount = assignments.length;

    res.json({
      success: true,
      data: {
        ...role,
        members: memberCount,
        permissions,
        assignedUsers: assignments,
      },
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch role' });
  }
};

export const createRole = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const userId = req.user.userId || req.user.id;
    const { name, description, color, permissions, assignedUsers } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    const [existing] = await db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.organizationId, organizationId),
          eq(customRoles.name, name.trim())
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A role with this name already exists',
      });
    }

    const [newRole] = await db
      .insert(customRoles)
      .values({
        organizationId,
        name: name.trim(),
        description: description || null,
        color: color || 'indigo',
        createdBy: userId,
      })
      .returning();

    if (permissions && typeof permissions === 'object') {
      const permEntries = Object.entries(permissions);
      if (permEntries.length > 0) {
        const permValues = permEntries.map(([key, level]) => {
          // key format: "folder:<uuid>" or "document:<uuid>"
          const [resourceType, resourceId] = key.split(':');
          return {
            roleId: newRole.id,
            resourceType,
            resourceId,
            permissionLevel: level,
          };
        });
        await db.insert(rolePermissions).values(permValues);
      }
    }

    // Only assign users belonging to the caller's org
    if (assignedUsers && Array.isArray(assignedUsers) && assignedUsers.length > 0) {
      const orgUserIds = await filterOrgUserIds(assignedUsers, organizationId);
      if (orgUserIds.length > 0) {
        await db.insert(userRoleAssignments).values(orgUserIds.map((uid) => ({
          userId: uid,
          roleId: newRole.id,
          assignedBy: userId,
        })));
      }
    }

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        ...newRole,
        members: assignedUsers?.length || 0,
        permissions: permissions || {},
        assignedUsers: assignedUsers || [],
      },
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
    });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const userId = req.user.userId || req.user.id;
    const { name, description, color, permissions, assignedUsers } = req.body;

    const [existingRole] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)))
      .limit(1);

    if (!existingRole) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (name && name.trim() !== existingRole.name) {
      const [duplicate] = await db
        .select()
        .from(customRoles)
        .where(
          and(
            eq(customRoles.organizationId, organizationId),
            eq(customRoles.name, name.trim())
          )
        )
        .limit(1);

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'A role with this name already exists',
        });
      }
    }

    const updateData = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    const [updatedRole] = await db
      .update(customRoles)
      .set(updateData)
      .where(eq(customRoles.id, id))
      .returning();

    if (permissions !== undefined && typeof permissions === 'object') {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

      const permEntries = Object.entries(permissions);
      if (permEntries.length > 0) {
        const permValues = permEntries
          .filter(([, level]) => level !== 'none')
          .map(([key, level]) => {
            const [resourceType, resourceId] = key.split(':');
            return {
              roleId: id,
              resourceType,
              resourceId,
              permissionLevel: level,
            };
          });
        if (permValues.length > 0) {
          await db.insert(rolePermissions).values(permValues);
        }
      }
    }

    if (assignedUsers !== undefined && Array.isArray(assignedUsers)) {
      await db.delete(userRoleAssignments).where(eq(userRoleAssignments.roleId, id));

      const orgUserIds = await filterOrgUserIds(assignedUsers, organizationId);
      if (orgUserIds.length > 0) {
        await db.insert(userRoleAssignments).values(orgUserIds.map((uid) => ({
          userId: uid,
          roleId: id,
          assignedBy: userId,
        })));
      }
    }

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
    });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [existingRole] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)))
      .limit(1);

    if (!existingRole) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Cascade deletes will handle role_permissions and user_role_assignments
    await db.delete(customRoles).where(eq(customRoles.id, id));

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
    });
  }
};

export const assignUsersToRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const userId = req.user.userId || req.user.id;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required',
      });
    }

    const [role] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)))
      .limit(1);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const orgUserIds = await filterOrgUserIds(userIds, organizationId);
    for (const uid of orgUserIds) {
      try {
        await db.insert(userRoleAssignments).values({
          userId: uid,
          roleId: id,
          assignedBy: userId,
        });
      } catch (e) {
        // Ignore duplicate assignment errors
        if (!e.message?.includes('unique') && !e.message?.includes('duplicate')) {
          throw e;
        }
      }
    }

    res.json({
      success: true,
      message: 'Users assigned to role successfully',
    });
  } catch (error) {
    console.error('Assign users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign users',
    });
  }
};

export const removeUserFromRole = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { organizationId } = req.user;

    const [role] = await db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.id, id), eq(customRoles.organizationId, organizationId)))
      .limit(1);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await db
      .delete(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.roleId, id),
          eq(userRoleAssignments.userId, targetUserId)
        )
      );

    res.json({
      success: true,
      message: 'User removed from role successfully',
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove user from role',
    });
  }
};

export const getUserPermissions = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.userId || req.user.id;
    const { organizationId } = req.user;

    // Owner/admin have full access; org-scoped so an admin can't probe another tenant's user
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (['owner', 'admin'].includes(targetUser.role)) {
      return res.json({
        success: true,
        data: {
          hasFullAccess: true,
          permissions: {},
          assignedRoles: [],
        },
      });
    }

    const assignments = await db
      .select({
        roleId: userRoleAssignments.roleId,
        roleName: customRoles.name,
        roleColor: customRoles.color,
      })
      .from(userRoleAssignments)
      .innerJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.id))
      .where(
        and(
          eq(userRoleAssignments.userId, targetUserId),
          eq(customRoles.organizationId, organizationId),
          eq(customRoles.isActive, true)
        )
      );

    if (assignments.length === 0) {
      return res.json({
        success: true,
        data: {
          hasFullAccess: false,
          permissions: {},
          assignedRoles: [],
        },
      });
    }

    const roleIds = assignments.map((a) => a.roleId);
    const perms = await db
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds));

    // Merge permissions: highest level wins
    const PERM_PRIORITY = { none: 0, viewer: 1, editor: 2, admin: 3 };
    const mergedPermissions = {};

    for (const perm of perms) {
      const key = `${perm.resourceType}:${perm.resourceId}`;
      const currentLevel = mergedPermissions[key] || 'none';
      if ((PERM_PRIORITY[perm.permissionLevel] || 0) > (PERM_PRIORITY[currentLevel] || 0)) {
        mergedPermissions[key] = perm.permissionLevel;
      }
    }

    res.json({
      success: true,
      data: {
        hasFullAccess: false,
        permissions: mergedPermissions,
        assignedRoles: assignments.map((a) => ({
          id: a.roleId,
          name: a.roleName,
          color: a.roleColor,
        })),
      },
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user permissions',
    });
  }
};
