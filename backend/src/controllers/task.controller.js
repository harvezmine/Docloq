// Task CRUD; completing a task advances its linked form workflow.

import { db } from '../db/index.js';
import {
  tasks,
  taskComments,
  users,
  documents,
  documentVersions,
  documentSignatures,
  forms,
  formInstances,
  formWorkflowSteps,
} from '../db/schema.js';
import { eq, and, desc, asc, sql, or, inArray } from 'drizzle-orm';
import path from 'path';
import { createNotification } from '../services/notification.service.js';
import { generateOOToken } from './document.controller.js';
import { previewManifest, previewPage } from '../services/share-preview.service.js';

function resolveOrgId(req) {
  return req.user?.organizationId || null;
}

function resolveUserId(req) {
  return req.user?.userId || null;
}

// GET /api/tasks — list tasks (optional filters: status, assignedTo)
export const getTasks = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const userId = resolveUserId(req);
    const { status, priority } = req.query;

    const conditions = [eq(tasks.organizationId, orgId)];
    if (status) conditions.push(eq(tasks.status, status));
    if (priority) conditions.push(eq(tasks.priority, priority));

    // A task is personal to its assignee — everyone (owner included) sees only their own.
    // Cross-user oversight is the Forms workflow-progress view, not this inbox.
    if (userId) {
      conditions.push(eq(tasks.assignedTo, userId));
    }

    const allTasks = await db
      .select({
        task: tasks,
        assigneeName: users.firstName,
        assigneeLastName: users.lastName,
        assigneeEmail: users.email,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));

    const creatorIds = [...new Set(allTasks.map(t => t.task.createdBy).filter(Boolean))];
    let creatorsMap = {};
    if (creatorIds.length > 0) {
      const creators = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(inArray(users.id, creatorIds));
      for (const c of creators) {
        creatorsMap[c.id] = {
          name: c.firstName ? `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}` : c.email,
          avatar: c.firstName ? c.firstName.charAt(0).toUpperCase() + (c.lastName ? c.lastName.charAt(0).toUpperCase() : '') : c.email.charAt(0).toUpperCase(),
        };
      }
    }

    const docIds = [...new Set(allTasks.map(t => t.task.relatedDocumentId).filter(Boolean))];
    let docsMap = {};
    if (docIds.length > 0) {
      const docs = await db
        .select({ id: documents.id, filename: documents.filename, originalFilename: documents.originalFilename })
        .from(documents)
        .where(inArray(documents.id, docIds));
      for (const d of docs) {
        docsMap[d.id] = d.originalFilename || d.filename;
      }
    }

    const formIds = [...new Set(allTasks.map(t => t.task.relatedFormId).filter(Boolean))];
    let formsMap = {};
    if (formIds.length > 0) {
      const formsList = await db
        .select({ id: forms.id, title: forms.title })
        .from(forms)
        .where(inArray(forms.id, formIds));
      for (const f of formsList) {
        formsMap[f.id] = f.title;
      }
    }

    const data = allTasks.map(row => ({
      ...row.task,
      assignee: row.assigneeName
        ? {
            name: `${row.assigneeName}${row.assigneeLastName ? ' ' + row.assigneeLastName : ''}`,
            avatar: row.assigneeName.charAt(0).toUpperCase() + (row.assigneeLastName ? row.assigneeLastName.charAt(0).toUpperCase() : ''),
          }
        : row.assigneeEmail ? { name: row.assigneeEmail, avatar: row.assigneeEmail.charAt(0).toUpperCase() } : null,
      assignedBy: creatorsMap[row.task.createdBy] || { name: 'System', avatar: 'S' },
      documentName: docsMap[row.task.relatedDocumentId] || null,
      formName: formsMap[row.task.relatedFormId] || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// GET /api/tasks/:id — single task
export const getTask = async (req, res) => {
  try {
    const { id } = req.params;

    const [row] = await db
      .select({
        task: tasks,
        assigneeName: users.firstName,
        assigneeLastName: users.lastName,
        assigneeEmail: users.email,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(eq(tasks.id, id));

    if (!row) return res.status(404).json({ success: false, message: 'Task not found' });

    // Only the assignee can view a task
    const userId = resolveUserId(req);
    if (row.task.assignedTo !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied. This task is not assigned to you.' });
    }

    const comments = await db
      .select({
        comment: taskComments,
        authorName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.createdBy, users.id))
      .where(eq(taskComments.taskId, id))
      .orderBy(asc(taskComments.createdAt));

    const data = {
      ...row.task,
      assignee: row.assigneeName
        ? `${row.assigneeName}${row.assigneeLastName ? ' ' + row.assigneeLastName : ''}`
        : row.assigneeEmail || null,
      comments: comments.map(c => ({
        ...c.comment,
        author: c.authorName ? `${c.authorName}${c.authorLastName ? ' ' + c.authorLastName : ''}` : 'Unknown',
      })),
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch task' });
  }
};

// POST /api/tasks — create task
export const createTask = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const { title, description, taskType, assignedTo, priority, dueDate, relatedDocumentId, relatedFormId, checklist } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const createdBy = resolveUserId(req);

    const [task] = await db.insert(tasks).values({
      organizationId: orgId,
      title,
      description: description || null,
      taskType: taskType || 'general',
      assignedTo: assignedTo || null,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      relatedDocumentId: relatedDocumentId || null,
      relatedFormId: relatedFormId || null,
      checklist: checklist || null,
      createdBy,
    }).returning();

    // Notify the assignee (skip self-assignment). Best-effort — don't fail task creation.
    if (task.assignedTo && task.assignedTo !== createdBy) {
      try {
        await createNotification(task.assignedTo, {
          type: 'task_assigned',
          title: 'Tugas baru ditugaskan',
          message: `Anda ditugaskan: "${task.title}"`,
          relatedType: 'task',
          relatedId: task.id,
        });
      } catch (e) { console.warn('[Task] assignee notification failed:', e.message); }
    }

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

// PUT /api/tasks/:id — update task
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) return res.status(404).json({ success: false, message: 'Task not found' });

    const updateData = { updatedAt: new Date() };
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

// PUT /api/tasks/:id/complete — complete a task (+ sync workflow step)
export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Only the assignee can complete a task
    const userId = resolveUserId(req);
    if (task.assignedTo !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied. Only the assigned user can complete this task.' });
    }

    const [updated] = await db.update(tasks).set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tasks.id, id)).returning();

    const [linkedStep] = await db.select().from(formWorkflowSteps)
      .where(eq(formWorkflowSteps.taskId, id));

    if (linkedStep) {
      await db.update(formWorkflowSteps).set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(formWorkflowSteps.id, linkedStep.id));

      const [nextStep] = await db.select().from(formWorkflowSteps)
        .where(and(
          eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
          eq(formWorkflowSteps.stepOrder, linkedStep.stepOrder + 1),
        ));

      if (nextStep) {
        await db.update(formWorkflowSteps).set({
          status: 'in_progress', updatedAt: new Date(),
        }).where(eq(formWorkflowSteps.id, nextStep.id));

        if (nextStep.taskId) {
          await db.update(tasks).set({
            status: 'in_progress', updatedAt: new Date(),
          }).where(eq(tasks.id, nextStep.taskId));
        }
      } else {
        // All steps done — complete the form instance
        await db.update(formInstances).set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(formInstances.id, linkedStep.formInstanceId));
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete task' });
  }
};

// DELETE /api/tasks/:id — delete task
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(taskComments).where(eq(taskComments.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};

// POST /api/tasks/:id/comments — add comment
export const addTaskComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

    const createdBy = resolveUserId(req);

    const [comment] = await db.insert(taskComments).values({
      taskId: id,
      content,
      createdBy,
    }).returning();

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Add task comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

// GET /api/tasks/:id/document-config — OnlyOffice config based on task type
export const getTaskDocumentConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Only the assignee can access the document config
    const currentUserId = resolveUserId(req);
    if (task.assignedTo !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied. This task is not assigned to you.' });
    }

    let userName = req.user?.email || 'User';
    if (currentUserId) {
      const [userRecord] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, currentUserId));
      if (userRecord?.firstName) {
        userName = `${userRecord.firstName}${userRecord.lastName ? ' ' + userRecord.lastName : ''}`;
      }
    }

    const docId = task.relatedDocumentId;
    if (!docId) return res.status(404).json({ success: false, message: 'No document linked to this task' });

    const orgId = resolveOrgId(req);
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.organizationId, orgId)));
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // fill → edit; sign/review/approve → view (signing goes through DocuSeal, not OnlyOffice). Completed/cancelled always view.
    const isCompleted = task.status === 'completed' || task.status === 'cancelled';
    const mode = isCompleted ? 'view' : (task.taskType === 'fill' ? 'edit' : 'view');

    const ext = path.extname(doc.originalFilename || doc.filename).toLowerCase().slice(1);
    const backendUrlDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
    const onlyOfficeUrl = process.env.ONLYOFFICE_URL || 'http://localhost:8082';

    const documentType = ext === 'docx' || ext === 'doc' ? 'word'
      : ext === 'xlsx' || ext === 'xls' ? 'cell'
      : ext === 'pptx' || ext === 'ppt' ? 'slide' : 'word';

    // OnlyOffice fetches /file and posts to /callback WITHOUT the user's Bearer token,
    // so both URLs must carry the signed oo_token (same as the document/form editors).
    const ooToken = generateOOToken(doc.id);
    const config = {
      document: {
        fileType: ext,
        // Dashless, version-based key + mode suffix so a cached VIEW session (reviewer)
        // is never reused for the EDIT session (filler).
        key: `${doc.id.replace(/-/g, '')}_v${doc.versionCount || 1}_${mode}`,
        title: doc.originalFilename || doc.filename,
        url: `${backendUrlDocker}/api/documents/${doc.id}/file?oo_token=${encodeURIComponent(ooToken)}`,
        permissions: {
          edit: mode === 'edit',
          download: true,
          print: true,
          review: false,
          comment: !isCompleted && task.taskType === 'review',
        },
      },
      documentType,
      editorConfig: {
        mode,
        lang: 'en',
        callbackUrl: mode === 'edit' ? `${backendUrlDocker}/api/documents/${doc.id}/callback?oo_token=${encodeURIComponent(ooToken)}` : undefined,
        user: {
          id: (currentUserId || 'guest').replace(/-/g, ''),
          name: userName,
        },
        customization: {
          autosave: !isCompleted && task.taskType === 'fill',
          forcesave: !isCompleted && task.taskType === 'fill',
          chat: false,
          comments: !isCompleted && task.taskType === 'review',
          help: false,
        },
      },
      type: 'desktop',
    };

    let workflowContext = null;
    if (task.relatedFormInstanceId) {
      const allSteps = await db.select({
        step: formWorkflowSteps,
        userName: users.firstName,
        userLastName: users.lastName,
      })
        .from(formWorkflowSteps)
        .leftJoin(users, eq(formWorkflowSteps.assignedTo, users.id))
        .where(eq(formWorkflowSteps.formInstanceId, task.relatedFormInstanceId))
        .orderBy(asc(formWorkflowSteps.stepOrder));

      const currentStep = allSteps.find(s => s.step.taskId === id);

      workflowContext = {
        steps: allSteps.map(s => ({
          id: s.step.id,
          stepOrder: s.step.stepOrder,
          action: s.step.action,
          status: s.step.status,
          assignee: s.userName ? `${s.userName}${s.userLastName ? ' ' + s.userLastName : ''}` : 'Unknown',
          notes: s.step.notes,
          completedAt: s.step.completedAt,
        })),
        currentStepOrder: currentStep?.step.stepOrder || null,
        totalSteps: allSteps.length,
      };
    }

    let signedDocumentInfo = null;
    if (isCompleted && task.taskType === 'sign') {
      const [sigRecord] = await db.select().from(documentSignatures)
        .where(eq(documentSignatures.taskId, task.id))
        .orderBy(desc(documentSignatures.createdAt));
      if (sigRecord && sigRecord.status === 'completed' && sigRecord.signedDocumentPath) {
        signedDocumentInfo = {
          signatureId: sigRecord.id,
          signedDocumentUrl: sigRecord.signedDocumentUrl,
          hasLocalFile: !!sigRecord.signedDocumentPath,
          signedConfig: {
            document: {
              fileType: 'pdf',
              key: `signed-${sigRecord.id}-${sigRecord.updatedAt?.getTime() || Date.now()}`,
              title: `Signed - ${doc.originalFilename || doc.filename}`,
              url: `${backendUrlDocker}/api/signing/${sigRecord.id}/file`,
              permissions: { edit: false, download: true, print: true, review: false, comment: false },
            },
            documentType: 'pdf',
            editorConfig: {
              mode: 'view',
              lang: 'en',
              user: { id: currentUserId, name: userName },
              customization: { autosave: false, forcesave: false, chat: false, comments: false, help: false },
            },
            type: 'desktop',
          },
        };
      }
    }

    res.json({
      success: true,
      data: {
        task,
        document: doc,
        config,
        onlyOfficeUrl: `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`,
        mode,
        workflowContext,
        signedDocumentInfo,
      },
    });
  } catch (error) {
    console.error('Get task document config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get task document config' });
  }
};

// Inline preview reuses the share-preview pipeline (no watermark); auth = assignee or admin.

// Resolve + authorize the task's linked document → { doc } or { error: { status, message } }.
const resolveTaskDoc = async (req) => {
  const { id } = req.params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return { error: { status: 404, message: 'Task not found' } };

  const currentUserId = resolveUserId(req);
  if (task.assignedTo !== currentUserId) {
    return { error: { status: 403, message: 'Access denied. This task is not assigned to you.' } };
  }
  if (!task.relatedDocumentId) return { error: { status: 404, message: 'No document linked to this task' } };

  const orgId = resolveOrgId(req);
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, task.relatedDocumentId), eq(documents.organizationId, orgId)));
  if (!doc) return { error: { status: 404, message: 'Document not found' } };
  return { doc };
};

// GET /api/tasks/:id/document/preview — page-count manifest for the inline viewer
export const getTaskDocumentPreview = async (req, res) => {
  try {
    const { error, doc } = await resolveTaskDoc(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const manifest = await previewManifest(doc);
    return res.json({ success: true, data: manifest });
  } catch (err) {
    console.error('getTaskDocumentPreview error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load document preview' });
  }
};

// GET /api/tasks/:id/document/preview/:n — render page n as PNG
export const getTaskDocumentPreviewPage = async (req, res) => {
  try {
    const { error, doc } = await resolveTaskDoc(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const png = await previewPage(doc, req.params.n);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=120');
    return res.send(png);
  } catch (err) {
    if (err?.code === 'NOT_PREVIEWABLE') return res.status(415).json({ success: false, message: err.message });
    console.error('getTaskDocumentPreviewPage error:', err);
    return res.status(500).json({ success: false, message: 'Failed to render document page' });
  }
};

// PUT /api/tasks/:id/submit — review: { notes }; approve: { approved, notes? }; fill/sign: empty body.
export const submitTaskAction = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, approved } = req.body;

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // Only the assignee can submit a task action
    const currentUserId = resolveUserId(req);
    if (task.assignedTo !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied. Only the assigned user can submit this task.' });
    }

    if (task.status === 'completed') return res.status(400).json({ success: false, message: 'Task already completed' });
    if (task.status === 'pending') return res.status(400).json({ success: false, message: 'Task is not yet active' });

    // Approve rejected → cancel the whole workflow.
    if (task.taskType === 'approve' && approved === false) {
      await db.update(tasks).set({
        status: 'cancelled',
        updatedAt: new Date(),
      }).where(eq(tasks.id, id));

      const [linkedStep] = await db.select().from(formWorkflowSteps)
        .where(eq(formWorkflowSteps.taskId, id));

      if (linkedStep) {
        await db.update(formWorkflowSteps).set({
          status: 'skipped',
          notes: notes || 'Rejected by approver',
          updatedAt: new Date(),
        }).where(eq(formWorkflowSteps.id, linkedStep.id));

        await db.update(formWorkflowSteps).set({
          status: 'skipped',
          updatedAt: new Date(),
        }).where(and(
          eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
          eq(formWorkflowSteps.status, 'pending'),
        ));

        const remainingSteps = await db.select().from(formWorkflowSteps)
          .where(and(
            eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
            eq(formWorkflowSteps.status, 'skipped'),
          ));
        for (const s of remainingSteps) {
          if (s.taskId && s.taskId !== id) {
            await db.update(tasks).set({ status: 'cancelled', updatedAt: new Date() })
              .where(eq(tasks.id, s.taskId));
          }
        }

        await db.update(formInstances).set({
          status: 'cancelled',
          updatedAt: new Date(),
        }).where(eq(formInstances.id, linkedStep.formInstanceId));
      }

      if (notes) {
        const userId = resolveUserId(req);
        await db.insert(taskComments).values({
          taskId: id,
          content: `Rejected: ${notes}`,
          createdBy: userId,
        });
      }

      return res.json({ success: true, message: 'Task rejected, workflow cancelled', data: { status: 'cancelled' } });
    }

    if (task.taskType === 'review' && notes) {
      const [linkedStep] = await db.select().from(formWorkflowSteps)
        .where(eq(formWorkflowSteps.taskId, id));
      if (linkedStep) {
        await db.update(formWorkflowSteps).set({
          notes,
          updatedAt: new Date(),
        }).where(eq(formWorkflowSteps.id, linkedStep.id));
      }

      const userId = resolveUserId(req);
      await db.insert(taskComments).values({
        taskId: id,
        content: `Review notes: ${notes}`,
        createdBy: userId,
      });
    }

    const [updated] = await db.update(tasks).set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tasks.id, id)).returning();

    const [linkedStep] = await db.select().from(formWorkflowSteps)
      .where(eq(formWorkflowSteps.taskId, id));

    if (linkedStep) {
      await db.update(formWorkflowSteps).set({
        status: 'completed',
        completedAt: new Date(),
        notes: notes || linkedStep.notes,
        updatedAt: new Date(),
      }).where(eq(formWorkflowSteps.id, linkedStep.id));

      const [nextStep] = await db.select().from(formWorkflowSteps)
        .where(and(
          eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
          eq(formWorkflowSteps.stepOrder, linkedStep.stepOrder + 1),
        ));

      if (nextStep) {
        await db.update(formWorkflowSteps).set({
          status: 'in_progress', updatedAt: new Date(),
        }).where(eq(formWorkflowSteps.id, nextStep.id));

        if (nextStep.taskId) {
          await db.update(tasks).set({
            status: 'in_progress', updatedAt: new Date(),
          }).where(eq(tasks.id, nextStep.taskId));
        }
      } else {
        // All steps done — complete the form instance
        await db.update(formInstances).set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(formInstances.id, linkedStep.formInstanceId));
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Submit task action error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit task action' });
  }
};
