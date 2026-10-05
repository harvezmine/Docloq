import { db } from '../db/index.js';
import { departments, users } from '../db/schema.js';
import { eq, and, sql, asc, desc } from 'drizzle-orm';

export const getDepartments = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const result = await db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description,
        color: departments.color,
        isActive: departments.isActive,
        createdAt: departments.createdAt,
        updatedAt: departments.updatedAt,
        memberCount: sql`(
          SELECT COUNT(*)::int FROM users 
          WHERE users.department_id = ${departments.id} 
          AND users.organization_id = ${organizationId}
        )`,
      })
      .from(departments)
      .where(eq(departments.organizationId, organizationId))
      .orderBy(asc(departments.name));

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [department] = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)))
      .limit(1);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [department] = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)))
      .limit(1);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    const members = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        position: users.position,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.departmentId, id),
          eq(users.organizationId, organizationId)
        )
      )
      .orderBy(asc(users.firstName));

    res.status(200).json({
      success: true,
      data: {
        department,
        members,
      },
    });
  } catch (error) {
    console.error('Get department members error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const { organizationId, userId } = req.user;
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required',
      });
    }

    const [existing] = await db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.organizationId, organizationId),
          eq(departments.name, name.trim())
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A department with this name already exists',
      });
    }

    const [created] = await db
      .insert(departments)
      .values({
        organizationId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || null,
        createdBy: userId,
        isActive: true,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: created,
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const { name, description, color, isActive } = req.body;

    const [existing] = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (name && name.trim() !== existing.name) {
      const [duplicate] = await db
        .select()
        .from(departments)
        .where(
          and(
            eq(departments.organizationId, organizationId),
            eq(departments.name, name.trim())
          )
        )
        .limit(1);

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'A department with this name already exists',
        });
      }
    }

    const updateData = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (color !== undefined) updateData.color = color;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(departments)
      .set(updateData)
      .where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)))
      .returning();

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const [existing] = await db
      .select()
      .from(departments)
      .where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(users)
      .where(
        and(
          eq(users.departmentId, id),
          eq(users.organizationId, organizationId)
        )
      );

    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department. ${count} user(s) are still assigned to it. Please reassign them first.`,
      });
    }

    await db.delete(departments).where(and(eq(departments.id, id), eq(departments.organizationId, organizationId)));

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
