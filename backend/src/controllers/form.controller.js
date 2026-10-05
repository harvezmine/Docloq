import { db } from '../db/index.js';
import {
  forms,
  formInstances,
  formWorkflowSteps,
  formSubmissions,
  tasks,
  users,
  documents,
  documentVersions,
  trashItems,
  folders,
} from '../db/schema.js';
import { eq, and, desc, asc, sql, count, inArray, isNull } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { createBlankDocx, convertDocument, downloadFromUrl } from '../services/conversion.service.js';
import { downloadFile, uploadFile } from '../services/storage.service.js';
import { decryptFile, encryptFile as encryptFileService, generateDocumentKey } from '../services/encryption.service.js';
import { uploadPipeline } from '../services/upload-pipeline.service.js';
import { generateOOToken } from './document.controller.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const ensureUploadDir = async () => {
  try { await fs.access(UPLOAD_DIR); } catch { await fs.mkdir(UPLOAD_DIR, { recursive: true }); }
};

function resolveOrgId(req) {
  return req.user?.organizationId || null;
}

export const getFormTemplates = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const allForms = await db
      .select()
      .from(forms)
      .where(and(eq(forms.organizationId, orgId), eq(forms.isActive, true)))
      .orderBy(desc(forms.createdAt));

    res.json({ success: true, data: allForms });
  } catch (error) {
    console.error('Get form templates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch form templates' });
  }
};

export const getFormTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await resolveOrgId(req);
    const [form] = await db.select().from(forms).where(and(eq(forms.id, id), eq(forms.organizationId, orgId)));
    if (!form) return res.status(404).json({ success: false, message: 'Form template not found' });

    res.json({ success: true, data: form });
  } catch (error) {
    console.error('Get form template error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch form template' });
  }
};

export const createFormTemplate = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const { title, description, icon, category, schema: formSchema, uiSchema, linkedTemplateId } = req.body;
    if (!title || !formSchema) {
      return res.status(400).json({ success: false, message: 'Title and schema are required' });
    }

    let createdBy = req.user?.id;
    if (!createdBy) {
      const [firstUser] = await db.select().from(users).limit(1);
      if (firstUser) createdBy = firstUser.id;
    }

    const [newForm] = await db.insert(forms).values({
      organizationId: orgId,
      title,
      description: description || null,
      icon: icon || 'document',
      category: category || 'general',
      schema: formSchema,
      uiSchema: uiSchema || null,
      linkedTemplateId: linkedTemplateId || null,
      createdBy,
    }).returning();

    res.status(201).json({ success: true, data: newForm });
  } catch (error) {
    console.error('Create form template error:', error);
    res.status(500).json({ success: false, message: 'Failed to create form template' });
  }
};

export const updateFormTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = await resolveOrgId(req);
    const { title, description, icon, category, schema: formSchema, uiSchema } = req.body;

    const [existing] = await db.select().from(forms).where(and(eq(forms.id, id), eq(forms.organizationId, orgId)));
    if (!existing) return res.status(404).json({ success: false, message: 'Form template not found' });

    const [updated] = await db.update(forms).set({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(icon && { icon }),
      ...(category && { category }),
      ...(formSchema && { schema: formSchema }),
      ...(uiSchema !== undefined && { uiSchema }),
      updatedAt: new Date(),
    }).where(and(eq(forms.id, id), eq(forms.organizationId, orgId))).returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update form template error:', error);
    res.status(500).json({ success: false, message: 'Failed to update form template' });
  }
};

export const deleteFormTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const reqOrgId = await resolveOrgId(req);

    const [template] = await db.select().from(forms).where(and(eq(forms.id, id), eq(forms.organizationId, reqOrgId)));
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const userId = req.user?.id || template.createdBy;
    const orgId = template.organizationId;
    const now = new Date();
    const autoDeleteDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.update(forms).set({ isActive: false, updatedAt: now }).where(eq(forms.id, id));

    await db.insert(trashItems).values({
      organizationId: orgId,
      itemType: 'template',
      itemId: id,
      originalFolderId: null,
      originalPath: template.title,
      itemMetadata: {
        title: template.title,
        description: template.description,
        icon: template.icon,
        category: template.category,
        createdBy: template.createdBy,
        documentId: template.schema?.documentId || null,
      },
      autoDeleteAt: autoDeleteDate,
      deletedBy: userId,
      deletedAt: now,
    });

    res.json({ success: true, message: 'Template moved to trash' });
  } catch (error) {
    console.error('Delete form template error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete form template' });
  }
};

export const getFormInstances = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const instances = await db
      .select({
        instance: formInstances,
        formTitle: forms.title,
        formIcon: forms.icon,
        formCategory: forms.category,
      })
      .from(formInstances)
      .leftJoin(forms, eq(formInstances.formId, forms.id))
      .where(eq(formInstances.organizationId, orgId))
      .orderBy(desc(formInstances.createdAt));

    const instanceIds = instances.map(i => i.instance.id);
    let allSteps = [];
    if (instanceIds.length > 0) {
      allSteps = await db
        .select({
          step: formWorkflowSteps,
          userName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(formWorkflowSteps)
        .leftJoin(users, eq(formWorkflowSteps.assignedTo, users.id))
        .where(inArray(formWorkflowSteps.formInstanceId, instanceIds))
        .orderBy(asc(formWorkflowSteps.stepOrder));
    }

    const stepsMap = {};
    for (const row of allSteps) {
      const instId = row.step.formInstanceId;
      if (!stepsMap[instId]) stepsMap[instId] = [];
      stepsMap[instId].push({
        ...row.step,
        user: row.userName
          ? `${row.userName}${row.userLastName ? ' ' + row.userLastName : ''}`
          : row.userEmail || 'Unknown',
      });
    }

    const creatorIds = [...new Set(instances.map(i => i.instance.createdBy).filter(Boolean))];
    let creatorsMap = {};
    if (creatorIds.length > 0) {
      const creators = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users)
        .where(inArray(users.id, creatorIds));
      for (const c of creators) {
        creatorsMap[c.id] = c.firstName ? `${c.firstName}${c.lastName ? ' ' + c.lastName : ''}` : c.email;
      }
    }

    const data = instances.map(row => ({
      ...row.instance,
      templateName: row.formTitle,
      templateIcon: row.formIcon,
      templateCategory: row.formCategory,
      creatorName: creatorsMap[row.instance.createdBy] || 'Unknown',
      workflow: stepsMap[row.instance.id] || [],
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get form instances error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch form instances' });
  }
};

export const getFormInstance = async (req, res) => {
  try {
    const { id } = req.params;

    const [instanceRow] = await db
      .select({
        instance: formInstances,
        formTitle: forms.title,
        formIcon: forms.icon,
        formCategory: forms.category,
        formSchema: forms.schema,
      })
      .from(formInstances)
      .leftJoin(forms, eq(formInstances.formId, forms.id))
      .where(eq(formInstances.id, id));

    if (!instanceRow) return res.status(404).json({ success: false, message: 'Form instance not found' });

    const steps = await db
      .select({
        step: formWorkflowSteps,
        userName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(formWorkflowSteps)
      .leftJoin(users, eq(formWorkflowSteps.assignedTo, users.id))
      .where(eq(formWorkflowSteps.formInstanceId, id))
      .orderBy(asc(formWorkflowSteps.stepOrder));

    const data = {
      ...instanceRow.instance,
      templateName: instanceRow.formTitle,
      templateIcon: instanceRow.formIcon,
      templateCategory: instanceRow.formCategory,
      formSchema: instanceRow.formSchema,
      workflow: steps.map(row => ({
        ...row.step,
        user: row.userName
          ? `${row.userName}${row.userLastName ? ' ' + row.userLastName : ''}`
          : row.userEmail || 'Unknown',
      })),
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get form instance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch form instance' });
  }
};

export const createFormInstance = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const { name, formId, startDate, dueDate, workflowSteps } = req.body;
    if (!name || !formId) {
      return res.status(400).json({ success: false, message: 'Name and formId are required' });
    }

    const [formTemplate] = await db.select().from(forms).where(eq(forms.id, formId));
    if (!formTemplate) return res.status(404).json({ success: false, message: 'Form template not found' });

    let createdBy = req.user?.id;
    if (!createdBy) {
      const [firstUser] = await db.select().from(users).limit(1);
      if (firstUser) createdBy = firstUser.id;
    }

    // Copy the template's document, if it has one
    let copiedDocumentId = null;
    const templateDocId = formTemplate.schema?.documentId;

    if (templateDocId) {
      const [originalDoc] = await db.select().from(documents).where(and(eq(documents.id, templateDocId), eq(documents.organizationId, orgId)));

      if (originalDoc) {
        let fileBuffer = null;

        // Strategy 1: encrypted pipeline file (has a version with encryption data)
        if (originalDoc.currentVersionId) {
          try {
            const [version] = await db.select().from(documentVersions)
              .where(eq(documentVersions.id, originalDoc.currentVersionId));

            if (version && version.encryptionKeyId && version.encryptionIv && version.s3Key) {
              const encryptedBuffer = await downloadFile(version.s3Key);

              let authTag = null;
              try {
                const metaBuffer = await downloadFile(`${version.s3Key}.meta.json`);
                const meta = JSON.parse(metaBuffer.toString());
                authTag = meta.authTag;
              } catch { /* no meta file */ }

              if (authTag) {
                fileBuffer = await decryptFile(encryptedBuffer, version.encryptionKeyId, version.encryptionIv, authTag, version);
              }
            }
          } catch (err) {
            console.warn('Encrypted copy failed, trying legacy:', err.message);
          }
        }

        // Strategy 2: legacy plain file in uploads/
        if (!fileBuffer && originalDoc.filename) {
          try {
            const legacyPath = path.join(process.cwd(), 'uploads', originalDoc.filename);
            fileBuffer = await fs.readFile(legacyPath);
          } catch { /* file not found */ }
        }

        if (fileBuffer) {
          // Save the copy through the full security pipeline, in the org's Template Forms folder
          const fileExt = path.extname(originalDoc.originalFilename || originalDoc.filename);
          const templateFolder = await getOrCreateTemplateFolder(orgId, createdBy);
          const copiedDoc = await createDocumentRecord(
            orgId,
            createdBy,
            `${name}${fileExt}`,
            fileBuffer,
            originalDoc.mimeType,
            templateFolder.id,
          );

          copiedDocumentId = copiedDoc.id;
          console.log(`[CreateFormInstance] Copied template doc ${templateDocId} → ${copiedDocumentId}`);
        }
      }
    }

    const [instance] = await db.insert(formInstances).values({
      organizationId: orgId,
      formId,
      name,
      status: 'active',
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      generatedDocumentId: copiedDocumentId,
      createdBy,
    }).returning();

    await db.update(forms).set({
      usageCount: sql`${forms.usageCount} + 1`,
    }).where(eq(forms.id, formId));

    // Create a task and a workflow step for each configured step
    let createdSteps = [];
    if (workflowSteps && workflowSteps.length > 0) {
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];

        const [task] = await db.insert(tasks).values({
          organizationId: orgId,
          title: `${step.action.charAt(0).toUpperCase() + step.action.slice(1)} — ${name}`,
          description: `Workflow step: ${step.action} for form "${name}" (based on ${formTemplate.title})`,
          taskType: step.action,
          assignedTo: step.userId,
          relatedDocumentId: copiedDocumentId,
          relatedFormId: formId,
          relatedFormInstanceId: instance.id,
          status: i === 0 ? 'in_progress' : 'pending', // First step is active
          priority: 'medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          createdBy,
        }).returning();

        const [createdStep] = await db.insert(formWorkflowSteps).values({
          formInstanceId: instance.id,
          stepOrder: i + 1,
          action: step.action,
          assignedTo: step.userId,
          status: i === 0 ? 'in_progress' : 'pending',
          taskId: task.id,
        }).returning();

        createdSteps.push(createdStep);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ...instance,
        templateName: formTemplate.title,
        workflow: createdSteps,
        copiedDocumentId,
      },
    });
  } catch (error) {
    console.error('Create form instance error:', error);
    res.status(500).json({ success: false, message: 'Failed to create form instance' });
  }
};

export const updateFormInstance = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status, startDate, dueDate } = req.body;

    const [existing] = await db.select().from(formInstances).where(eq(formInstances.id, id));
    if (!existing) return res.status(404).json({ success: false, message: 'Form instance not found' });

    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (status) updateData.status = status;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db.update(formInstances)
      .set(updateData)
      .where(eq(formInstances.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update form instance error:', error);
    res.status(500).json({ success: false, message: 'Failed to update form instance' });
  }
};

export const deleteFormInstance = async (req, res) => {
  try {
    const { id } = req.params;

    const steps = await db.select().from(formWorkflowSteps)
      .where(eq(formWorkflowSteps.formInstanceId, id));

    for (const step of steps) {
      if (step.taskId) {
        await db.update(tasks).set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(tasks.id, step.taskId));
      }
    }

    // Explicit delete even though cascade should also handle it
    await db.delete(formWorkflowSteps).where(eq(formWorkflowSteps.formInstanceId, id));

    await db.delete(formInstances).where(eq(formInstances.id, id));

    res.json({ success: true, message: 'Form instance deleted' });
  } catch (error) {
    console.error('Delete form instance error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete form instance' });
  }
};

export const updateWorkflowStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const [step] = await db.select().from(formWorkflowSteps).where(eq(formWorkflowSteps.id, id));
    if (!step) return res.status(404).json({ success: false, message: 'Workflow step not found' });

    const updateData = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db.update(formWorkflowSteps)
      .set(updateData)
      .where(eq(formWorkflowSteps.id, id))
      .returning();

    if (step.taskId) {
      const taskStatus = status === 'completed' ? 'completed' : status === 'in_progress' ? 'in_progress' : 'pending';
      await db.update(tasks).set({
        status: taskStatus,
        ...(status === 'completed' && { completedAt: new Date() }),
        updatedAt: new Date(),
      }).where(eq(tasks.id, step.taskId));
    }

    if (status === 'completed') {
      const nextSteps = await db.select().from(formWorkflowSteps)
        .where(and(
          eq(formWorkflowSteps.formInstanceId, step.formInstanceId),
          eq(formWorkflowSteps.stepOrder, step.stepOrder + 1),
        ));

      if (nextSteps.length > 0) {
        const nextStep = nextSteps[0];
        await db.update(formWorkflowSteps).set({
          status: 'in_progress',
          updatedAt: new Date(),
        }).where(eq(formWorkflowSteps.id, nextStep.id));

        if (nextStep.taskId) {
          await db.update(tasks).set({
            status: 'in_progress',
            updatedAt: new Date(),
          }).where(eq(tasks.id, nextStep.taskId));
        }
      } else {
        await db.update(formInstances).set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(formInstances.id, step.formInstanceId));
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update workflow step error:', error);
    res.status(500).json({ success: false, message: 'Failed to update workflow step' });
  }
};

export const getOrgUsers = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const orgUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.organizationId, orgId))
      .orderBy(asc(users.firstName));

    const data = orgUsers.map(u => ({
      ...u,
      name: u.firstName ? `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}` : u.email,
      avatar: u.firstName ? u.firstName.charAt(0).toUpperCase() + (u.lastName ? u.lastName.charAt(0).toUpperCase() : '') : u.email.charAt(0).toUpperCase(),
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get org users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// Idempotent — returns the org's existing "Template Forms" folder, or creates one
const TEMPLATE_FOLDER_NAME = 'Template Forms';
async function getOrCreateTemplateFolder(orgId, userId) {
  const [existing] = await db
    .select()
    .from(folders)
    .where(and(
      eq(folders.organizationId, orgId),
      eq(folders.name, TEMPLATE_FOLDER_NAME),
      isNull(folders.parentId),
      eq(folders.isActive, true),
    ))
    .limit(1);
  if (existing) return existing;

  const rootSiblings = await db
    .select()
    .from(folders)
    .where(and(isNull(folders.parentId), eq(folders.organizationId, orgId)));

  const [newFolder] = await db.insert(folders).values({
    organizationId: orgId,
    name: TEMPLATE_FOLDER_NAME,
    parentId: null,
    path: `/${TEMPLATE_FOLDER_NAME}`,
    depth: 0,
    sortOrder: rootSiblings.length,
    icon: 'folder',
    createdBy: userId,
    isActive: true,
  }).returning();

  return newFolder;
}

async function createDocumentRecord(orgId, userId, filename, buffer, mimeType, folderId = null) {
  // uploadPipeline expects a multer-style file object
  const fileObj = {
    originalname: filename,
    mimetype: mimeType,
    buffer,
    size: buffer.length,
  };

  const result = await uploadPipeline(fileObj, userId, orgId, folderId);

  if (!result.success) {
    throw new Error(result.message || 'Upload pipeline failed for template document');
  }

  return result.data.document;
}

// Creates a blank DOCX + a form template linked to it; returns both so the frontend can open OnlyOffice
export const createBlankTemplate = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    let userId = req.user?.id;
    if (!userId) {
      const [firstUser] = await db.select().from(users).limit(1);
      if (firstUser) userId = firstUser.id;
    }
    if (!userId) return res.status(400).json({ success: false, message: 'No user found' });

    const { title, description, icon, category } = req.body;
    const templateName = title || 'Untitled Template';

    const docxBuffer = await createBlankDocx();

    const templateFolder = await getOrCreateTemplateFolder(orgId, userId);
    const doc = await createDocumentRecord(
      orgId,
      userId,
      `${templateName.replace(/[^a-zA-Z0-9 ]/g, '')}.docx`,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      templateFolder.id,
    );

    const [template] = await db.insert(forms).values({
      organizationId: orgId,
      title: templateName,
      description: description || null,
      icon: icon || 'document',
      category: category || 'general',
      schema: { type: 'document-template', documentId: doc.id, fields: [] },
      createdBy: userId,
    }).returning();

    res.status(201).json({
      success: true,
      data: { template, document: doc },
    });
  } catch (error) {
    console.error('Create blank template error:', error);
    res.status(500).json({ success: false, message: 'Failed to create blank template' });
  }
};

// Accepts an uploaded template file, converting PDF to DOCX via OnlyOffice first if needed
export const uploadExistingTemplate = async (req, res) => {
  try {
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    let userId = req.user?.id;
    if (!userId) {
      const [firstUser] = await db.select().from(users).limit(1);
      if (firstUser) userId = firstUser.id;
    }
    if (!userId) return res.status(400).json({ success: false, message: 'No user found' });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { title, description, icon, category } = req.body;
    const { originalname, mimetype, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    const templateName = title || path.basename(originalname, ext);

    let finalBuffer = buffer;
    let finalMimeType = mimetype;
    let finalExt = ext;
    let finalOriginalName = originalname;

    if (ext === '.pdf' || mimetype === 'application/pdf') {
      console.log('[UploadTemplate] PDF detected, converting to DOCX...');

      // Write the PDF to disk so OnlyOffice (running in Docker) can fetch it via URL
      await ensureUploadDir();
      const tempFilename = `temp_${randomUUID()}.pdf`;
      const tempPath = path.join(UPLOAD_DIR, tempFilename);
      await fs.writeFile(tempPath, buffer);

      try {
        const backendUrlDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
        const tempFileUrl = `${backendUrlDocker}/uploads/${tempFilename}`;

        const { url: convertedUrl } = await convertDocument(tempFileUrl, 'pdf', 'docx');

        finalBuffer = await downloadFromUrl(convertedUrl);
        finalMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        finalExt = '.docx';
        finalOriginalName = originalname.replace(/\.pdf$/i, '.docx');
        console.log('[UploadTemplate] PDF→DOCX conversion successful');
      } finally {
        try { await fs.unlink(tempPath); } catch {}
      }
    }

    const templateFolder = await getOrCreateTemplateFolder(orgId, userId);
    const doc = await createDocumentRecord(
      orgId,
      userId,
      finalOriginalName,
      finalBuffer,
      finalMimeType,
      templateFolder.id,
    );

    const [template] = await db.insert(forms).values({
      organizationId: orgId,
      title: templateName,
      description: description || null,
      icon: icon || 'document',
      category: category || 'general',
      schema: { type: 'document-template', documentId: doc.id, fields: [] },
      createdBy: userId,
    }).returning();

    res.status(201).json({
      success: true,
      data: { template, document: doc },
    });
  } catch (error) {
    console.error('Upload existing template error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload template' });
  }
};

// Returns the document info and OnlyOffice config for a template's linked document
export const getTemplateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const mode = req.query.mode === 'view' ? 'view' : 'edit';
    const orgId = await resolveOrgId(req);

    const [template] = await db.select().from(forms).where(and(eq(forms.id, id), eq(forms.organizationId, orgId)));
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const docId = template.schema?.documentId;
    if (!docId) return res.status(404).json({ success: false, message: 'No document linked to this template' });

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.organizationId, orgId)));
    if (!doc) return res.status(404).json({ success: false, message: 'Linked document not found' });

    // Mirrors document.controller.js's OnlyOffice config
    const ext = path.extname(doc.originalFilename).toLowerCase().slice(1);
    const backendUrlDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
    const onlyOfficeUrl = process.env.ONLYOFFICE_URL || 'http://localhost:8082';
    // OnlyOffice calls /file and /callback without the user's Bearer token, so it carries a signed oo_token instead
    const ooToken = generateOOToken(doc.id);

    const displayTitle = `${template.title}.${ext}`;

    // Key is version+mode suffixed so a cached VIEW session is never reused for EDIT
    // (that collision previously left the template editor read-only after opening a template)
    const ooKey = `${doc.id.replace(/-/g, '')}_v${doc.versionCount || 1}_${mode}`;
    const config = {
      document: {
        fileType: ext,
        key: ooKey,
        title: displayTitle,
        url: `${backendUrlDocker}/api/documents/${doc.id}/file?oo_token=${encodeURIComponent(ooToken)}`,
        permissions: {
          edit: mode === 'edit',
          download: true,
          print: true,
          review: mode === 'edit',
          comment: mode === 'edit',
        },
      },
      documentType: ext === 'docx' || ext === 'doc' ? 'word' : ext === 'xlsx' || ext === 'xls' ? 'cell' : ext === 'pptx' || ext === 'ppt' ? 'slide' : 'word',
      editorConfig: {
        mode: mode,
        lang: 'en',
        callbackUrl: `${backendUrlDocker}/api/documents/${doc.id}/callback?oo_token=${encodeURIComponent(ooToken)}`,
        user: {
          id: (req.user?.id || 'guest').replace(/-/g, ''),
          name: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Guest User',
        },
        customization: {
          autosave: mode === 'edit',
          forcesave: mode === 'edit',
          chat: false,
          comments: true,
          help: false,
        },
      },
      type: 'desktop',
    };

    res.json({
      success: true,
      data: {
        document: doc,
        templateTitle: template.title,
        config,
        onlyOfficeUrl: `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`,
      },
    });
  } catch (error) {
    console.error('Get template document error:', error);
    res.status(500).json({ success: false, message: 'Failed to get template document' });
  }
};