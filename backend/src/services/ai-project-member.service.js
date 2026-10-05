// Project sharing. An AI project is a read-channel into its sources, so sharing grants
// implicit read to those documents — agreed behaviour, which is why the share is audited with
// the document ids and the UI warns before it happens.

import crypto from 'crypto';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  aiProjects, aiProjectMembers, aiProjectSources, documents, users,
} from '../db/schema.js';
import { appendAuditEntry } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { ValidationError, NotFoundError } from './ai-project.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creator, or a member who accepted. Pending and declined get nothing. */
export async function isMember(projectId, userId) {
  const [m] = await db.select({ id: aiProjectMembers.id })
    .from(aiProjectMembers)
    .where(and(
      eq(aiProjectMembers.projectId, projectId),
      eq(aiProjectMembers.userId, userId),
      eq(aiProjectMembers.status, 'accepted'),
    ));
  return !!m;
}

export async function listMembers(projectId) {
  return db.select({
    userId: aiProjectMembers.userId,
    status: aiProjectMembers.status,
    source: aiProjectMembers.source,
    invitedAt: aiProjectMembers.invitedAt,
    respondedAt: aiProjectMembers.respondedAt,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
  })
    .from(aiProjectMembers)
    .innerJoin(users, eq(aiProjectMembers.userId, users.id))
    .where(eq(aiProjectMembers.projectId, projectId))
    .orderBy(aiProjectMembers.invitedAt);
}

/** Documents a sharee will be able to read through this project — powers the warning + audit. */
export async function exposedDocuments(projectId) {
  return db.select({
    documentId: aiProjectSources.documentId,
    name: aiProjectSources.title,
  })
    .from(aiProjectSources)
    .where(and(
      eq(aiProjectSources.projectId, projectId),
      eq(aiProjectSources.status, 'active'),
      eq(aiProjectSources.sourceType, 'document'),
    ));
}

async function auditShare(project, targetUserIds, actorId, via) {
  const docs = await exposedDocuments(project.id);
  await appendAuditEntry({
    organizationId: project.organizationId,
    userId: actorId,
    action: 'share',
    resourceType: 'ai_project',
    resourceId: project.id,
    details: {
      via, // 'invite' | 'link'
      targetUserIds,
      // Document ids, not just the project: sharing grants implicit read, and the trail must
      // say what was exposed rather than merely that a project changed hands.
      documentIds: docs.map((d) => d.documentId).filter(Boolean),
      documentNames: docs.map((d) => d.name),
    },
  });
}

export async function inviteMembers(projectId, userIds, invitedBy, orgId) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError('Pilih minimal 1 user');
  }
  if (userIds.some((id) => !UUID_RE.test(String(id || '')))) {
    throw new ValidationError('userId tidak valid');
  }

  const [project] = await db.select().from(aiProjects)
    .where(and(eq(aiProjects.id, projectId), eq(aiProjects.organizationId, orgId)));
  if (!project) throw new NotFoundError('Project tidak ditemukan');

  // Same-org only. Sharing must never cross the tenancy boundary.
  const targets = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(and(
      inArray(users.id, userIds),
      eq(users.organizationId, orgId),
      eq(users.isActive, true),
    ));
  if (targets.length !== userIds.length) {
    throw new ValidationError('Sebagian user tidak ditemukan di organisasi ini');
  }

  const invited = [];
  for (const t of targets) {
    if (t.id === project.createdBy) continue; // the creator is implicit
    // Re-inviting a declined user resets them to pending.
    await db.insert(aiProjectMembers)
      .values({ projectId, userId: t.id, status: 'pending', source: 'invite', invitedBy })
      .onConflictDoUpdate({
        target: [aiProjectMembers.projectId, aiProjectMembers.userId],
        set: { status: 'pending', invitedBy, invitedAt: new Date(), respondedAt: null },
      });

    await createNotification(t.id, {
      type: 'ai_project_invite',
      title: 'Undangan AI Project',
      message: `Kamu diundang ke project "${project.name}".`,
      relatedType: 'ai_project',
      relatedId: projectId,
    });
    invited.push(t.id);
  }

  await auditShare(project, invited, invitedBy, 'invite');
  return { invited: invited.length };
}

export async function respondToInvite(projectId, userId, accept) {
  const [m] = await db.select().from(aiProjectMembers)
    .where(and(eq(aiProjectMembers.projectId, projectId), eq(aiProjectMembers.userId, userId)));
  if (!m) throw new NotFoundError('Undangan tidak ditemukan');
  if (m.status !== 'pending') throw new ValidationError('Undangan sudah direspons');

  const status = accept ? 'accepted' : 'declined';
  await db.update(aiProjectMembers)
    .set({ status, respondedAt: new Date() })
    .where(eq(aiProjectMembers.id, m.id));
  return { status };
}

export async function listPendingInvites(userId) {
  return db.select({
    projectId: aiProjectMembers.projectId,
    invitedAt: aiProjectMembers.invitedAt,
    name: aiProjects.name,
    description: aiProjects.description,
    icon: aiProjects.icon,
    color: aiProjects.color,
  })
    .from(aiProjectMembers)
    .innerJoin(aiProjects, eq(aiProjectMembers.projectId, aiProjects.id))
    .where(and(eq(aiProjectMembers.userId, userId), eq(aiProjectMembers.status, 'pending')))
    .orderBy(aiProjectMembers.invitedAt);
}

export async function removeMember(projectId, userId) {
  await db.delete(aiProjectMembers)
    .where(and(eq(aiProjectMembers.projectId, projectId), eq(aiProjectMembers.userId, userId)));
}

export async function enableShareLink(projectId) {
  const token = crypto.randomBytes(32).toString('hex');
  const [row] = await db.update(aiProjects)
    .set({ shareLinkToken: token, shareLinkEnabled: true })
    .where(eq(aiProjects.id, projectId))
    .returning({ token: aiProjects.shareLinkToken });
  return { token: row.token };
}

/** Clears the token too — a disabled link must die, not merely be flagged off. */
export async function disableShareLink(projectId) {
  await db.update(aiProjects)
    .set({ shareLinkToken: null, shareLinkEnabled: false })
    .where(eq(aiProjects.id, projectId));
}

export async function joinViaLink(token, userId, orgId) {
  if (!token || typeof token !== 'string') throw new ValidationError('Link tidak valid');

  const [project] = await db.select().from(aiProjects)
    .where(and(eq(aiProjects.shareLinkToken, token), eq(aiProjects.shareLinkEnabled, true)));
  if (!project) throw new NotFoundError('Link tidak berlaku atau sudah dinonaktifkan');

  // Same org, always. A valid link from another tenant must not work.
  if (project.organizationId !== orgId) {
    throw new NotFoundError('Link tidak berlaku untuk organisasi kamu');
  }

  if (project.createdBy === userId) return { projectId: project.id, status: 'accepted' };

  // Link joins are accepted immediately — clicking the link IS the acceptance.
  await db.insert(aiProjectMembers)
    .values({
      projectId: project.id, userId, status: 'accepted', source: 'link',
      invitedBy: project.createdBy, respondedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiProjectMembers.projectId, aiProjectMembers.userId],
      set: { status: 'accepted', respondedAt: new Date() },
    });

  await auditShare(project, [userId], userId, 'link');
  return { projectId: project.id, status: 'accepted' };
}

/** Projects shared WITH this user (accepted only) — merged into their project list. */
export async function listSharedProjectIds(userId) {
  const rows = await db.select({ projectId: aiProjectMembers.projectId })
    .from(aiProjectMembers)
    .where(and(eq(aiProjectMembers.userId, userId), eq(aiProjectMembers.status, 'accepted')));
  return rows.map((r) => r.projectId);
}
