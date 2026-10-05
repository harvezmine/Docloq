import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { users, organizations, userSessions, downloadWatermarks } from '../db/schema.js';
import { eq, and, like, or, desc, asc, sql } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';

export const getUsers = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role = '', 
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = [eq(users.organizationId, organizationId)];

    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`)
        )
      );
    }

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }

    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(and(...conditions));

    const rawUsers = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(sortOrder === 'desc' ? desc(users[sortBy]) : asc(users[sortBy]))
      .limit(parseInt(limit))
      .offset(offset);

    const userList = rawUsers.map(({ passwordHash, twoFactorSecret, ...user }) => user);

    res.status(200).json({
      success: true,
      data: {
        users: userList,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [rawUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!rawUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { passwordHash, twoFactorSecret, ...user } = rawUser;

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role = 'user',
      departmentId,
      position,
      phone,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Validate role — owner is assigned only via ownership transfer, never created here.
    // Only the owner may create/grant the admin role; an admin can create regular users only.
    const allowedRoles = req.user.role === 'owner' ? ['user', 'admin'] : ['user'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: role === 'owner'
          ? 'Cannot create an owner. Use transfer ownership instead.'
          : role === 'admin'
            ? 'Only the owner can grant the admin role.'
            : 'Invalid role. Allowed: user',
      });
    }

    const passwordHash = await bcrypt.hash(password, authConfig.password.saltRounds);

    const userId = uuidv4();
    await db.insert(users).values({
      id: userId,
      organizationId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      departmentId: departmentId || null,
      position,
      phone,
      isActive: true,
      isEmailVerified: true, // Auto verify for admin-created users so they can login immediately
    });

    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const { passwordHash: _, twoFactorSecret, ...newUser } = createdUser;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role: currentUserRole, userId: currentUserId } = req.user;
    const { 
      firstName, 
      lastName, 
      role,
      departmentId,
      position,
      phone,
      isActive,
    } = req.body;

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent changing your own role here (ownership changes go through transfer).
    if (id === currentUserId && role && role !== existingUser.role) {
      return res.status(403).json({
        success: false,
        message: 'Cannot change your own role',
      });
    }

    if (existingUser.role === 'owner' && currentUserRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify the owner',
      });
    }

    // Validate role if being changed — owner via transfer only; only the owner may
    // grant/assign the admin role, so an admin can only (re)assign the user role.
    if (role) {
      const allowedRoles = currentUserRole === 'owner' ? ['user', 'admin'] : ['user'];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: role === 'owner'
            ? 'Use transfer ownership to assign owner'
            : role === 'admin'
              ? 'Only the owner can grant the admin role.'
              : 'Invalid role',
        });
      }
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (position !== undefined) updateData.position = position;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        departmentId: users.departmentId,
        position: users.position,
        phone: users.phone,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        updatedAt: users.updatedAt,
      });

    if (isActive === false) {
      await db.delete(userSessions).where(eq(userSessions.userId, id));
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role: currentUserRole, userId: currentUserId } = req.user;

    if (id === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (existingUser.role === 'owner' && currentUserRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete the owner',
      });
    }

    await db.delete(userSessions).where(eq(userSessions.userId, id));

    // Preserve forensic watermark records: detach from the user instead of losing them.
    await db.update(downloadWatermarks)
      .set({ downloadedBy: null })
      .where(eq(downloadWatermarks.downloadedBy, id));

    await db.delete(users).where(eq(users.id, id));

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role: currentUserRole } = req.user;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (existingUser.role === 'owner' && currentUserRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset the owner password',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, authConfig.password.saltRounds);

    await db
      .update(users)
      .set({ 
        passwordHash, 
        updatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, id));

    await db.delete(userSessions).where(eq(userSessions.userId, id));

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. User will need to login again.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Exactly one owner per tenant: the caller is demoted to admin as the target becomes owner.
export const transferOwnership = async (req, res) => {
  try {
    const { organizationId, userId: currentUserId, role: currentUserRole } = req.user;
    const { id: targetId } = req.params;

    if (currentUserRole !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the owner can transfer ownership' });
    }
    if (targetId === currentUserId) {
      return res.status(400).json({ success: false, message: 'You are already the owner' });
    }

    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!target) {
      return res.status(404).json({ success: false, message: 'Target user not found' });
    }
    if (!target.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot transfer ownership to an inactive user' });
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, currentUserId));
      await tx.update(users).set({ role: 'owner', updatedAt: new Date() }).where(eq(users.id, targetId));
    });

    return res.status(200).json({
      success: true,
      message: 'Ownership transferred. You are now an admin.',
      data: { newOwnerId: targetId },
    });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId, role: currentUserRole, userId: currentUserId } = req.user;

    if (id === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot change your own status',
      });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (existingUser.role === 'owner' && currentUserRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot change the owner status',
      });
    }

    const newStatus = !existingUser.isActive;

    await db
      .update(users)
      .set({ 
        isActive: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    if (!newStatus) {
      await db.delete(userSessions).where(eq(userSessions.userId, id));
    }

    res.status(200).json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: newStatus },
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
