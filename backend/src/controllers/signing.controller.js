// Signing Controller — DocuSeal e-signing integration

import { db } from '../db/index.js';
import {
  documentSignatures,
  documents,
  documentVersions,
  tasks,
  formWorkflowSteps,
  formInstances,
  users,
  taskComments,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';
import { createNotification } from '../services/notification.service.js';
import {
  createSubmissionFromPDF,
  getSubmission,
  getSubmissionDocuments,
  getSubmitter,
  downloadSignedDocument,
} from '../services/docuseal.service.js';
import { downloadFile } from '../services/storage.service.js';
import { decryptFile } from '../services/encryption.service.js';
import { convertDocument, downloadFromUrl } from '../services/conversion.service.js';
import { generateOOToken } from './document.controller.js';
import sharp from 'sharp';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const SIGNED_DIR = path.join(process.cwd(), 'storage', 'signed');

function resolveOrgId(req) {
  return req.user?.organizationId || null;
}
function resolveUserId(req) {
  return req.user?.userId || null;
}

// Reads the document buffer from disk, trying encrypted storage before falling back to legacy plain files
async function getDocumentBuffer(doc) {
  if (doc.currentVersionId) {
    try {
      const [version] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, doc.currentVersionId));

      if (version && version.encryptionKeyId && version.encryptionIv && version.s3Key) {
        const encryptedBuffer = await downloadFile(version.s3Key);

        let authTag = null;
        try {
          const metaBuffer = await downloadFile(`${version.s3Key}.meta.json`);
          const meta = JSON.parse(metaBuffer.toString());
          authTag = meta.authTag;
        } catch {
          const metaPath = path.join(process.cwd(), 'storage', 'documents', `${version.s3Key}.meta.json`);
          try {
            const metaRaw = await fs.readFile(metaPath, 'utf-8');
            authTag = JSON.parse(metaRaw).authTag;
          } catch { /* no meta */ }
        }

        if (authTag) {
          return await decryptFile(encryptedBuffer, version.encryptionKeyId, version.encryptionIv, authTag, version);
        }
      }
    } catch (err) {
      console.warn('[Signing] Encrypted read failed, trying legacy:', err.message);
    }
  }

  const filePath = path.join(UPLOAD_DIR, doc.filename);
  return fs.readFile(filePath);
}

// POST /api/signing/request — creates a DocuSeal submission for the task's document, returns the embed URL
export const createSigningRequest = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const userId = resolveUserId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const { taskId, documentId, signatureAreas } = req.body;
    if (!taskId) return res.status(400).json({ success: false, message: 'taskId is required' });

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (task.taskType !== 'sign') return res.status(400).json({ success: false, message: 'Task is not a sign task' });
    // Signing is personal: only the assigned signer may initiate, even an owner/admin.
    if (task.assignedTo && task.assignedTo !== userId) {
      return res.status(403).json({ success: false, message: 'This signing task is not assigned to you' });
    }

    const [existing] = await db.select().from(documentSignatures)
      .where(and(
        eq(documentSignatures.taskId, taskId),
        eq(documentSignatures.status, 'pending'),
      ));

    if (existing && existing.embedSrc) {
      const docusealHost = (process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com').replace('api.', '').replace('/api', '');
      const existingFormUrl = existing.docusealSlug ? `${docusealHost}/s/${existing.docusealSlug}` : null;
      return res.json({
        success: true,
        data: {
          signatureId: existing.id,
          embedSrc: existing.embedSrc,
          slug: existing.docusealSlug,
          formUrl: existingFormUrl,
          status: existing.status,
          submissionId: existing.docusealSubmissionId,
        },
      });
    }

    const docId = documentId || task.relatedDocumentId;
    if (!docId) return res.status(400).json({ success: false, message: 'No document linked to this task' });

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.organizationId, orgId)));
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const [signer] = await db.select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, userId));

    if (!signer) return res.status(400).json({ success: false, message: 'Signer user not found' });

    const signerName = signer.firstName
      ? `${signer.firstName}${signer.lastName ? ' ' + signer.lastName : ''}`
      : signer.email;

    let pdfBuffer;
    try {
      pdfBuffer = await getDocumentBuffer(doc);
    } catch (err) {
      console.error('[Signing] Failed to read document:', err);
      return res.status(500).json({ success: false, message: 'Failed to read document file' });
    }

    // DocuSeal needs an actual PDF; documents may be stored as DOCX, so check the %PDF magic bytes
    const isPdf = pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50 &&
                  pdfBuffer[2] === 0x44 && pdfBuffer[3] === 0x46;

    if (!isPdf) {
      console.log('[Signing] Document is not PDF, converting via OnlyOffice before DocuSeal...');
      try {
        const backendUrl = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
        const fileUrl = `${backendUrl}/api/documents/${docId}/file?oo_token=${encodeURIComponent(generateOOToken(docId))}`;
        const srcExt = (doc.mimeType || '').includes('wordprocessing') ? 'docx'
          : (doc.mimeType || '').includes('spreadsheet') ? 'xlsx'
          : (doc.originalFilename || doc.filename || '').split('.').pop() || 'docx';
        const convKey = `signing-${docId}-${Date.now()}`;
        const { url: convertedUrl } = await convertDocument(fileUrl, srcExt, 'pdf', convKey);
        pdfBuffer = await downloadFromUrl(convertedUrl);
        console.log('[Signing] Conversion successful,', pdfBuffer.length, 'bytes PDF');
      } catch (convErr) {
        console.error('[Signing] DOCX→PDF conversion failed:', convErr);
        // Surface the real cause (usually OnlyOffice unreachable, or it cannot fetch the
        // document URL because BACKEND_URL_DOCKER/ONLYOFFICE_URL_INTERNAL is misconfigured).
        return res.status(500).json({
          success: false,
          message: 'Failed to convert document to PDF for signing',
          detail: convErr?.message || undefined,
        });
      }
    }

    const submission = await createSubmissionFromPDF(
      pdfBuffer,
      doc.originalFilename || doc.filename,
      {
        email: signer.email,
        name: signerName,
        role: 'First Party',
      },
      {
        sendEmail: false,
        signatureAreas: signatureAreas || undefined,
      },
    );

    // /submissions/pdf responds with the full submission object, with a submitters array
    const submitters = submission.submitters || (Array.isArray(submission) ? submission : []);
    const submitter = submitters[0] || submission;

    const embedSrc = submitter.embed_src || null;
    const docusealSubmissionId = submitter.submission_id || submission.id;
    const docusealSubmitterId = submitter.id;
    const docusealSlug = submitter.slug;

    const [sigRecord] = await db.insert(documentSignatures).values({
      organizationId: orgId,
      taskId,
      documentId: docId,
      formInstanceId: task.relatedFormInstanceId || null,
      docusealSubmissionId: docusealSubmissionId,
      docusealSubmitterId: docusealSubmitterId,
      docusealSlug: docusealSlug,
      signerUserId: userId,
      signerEmail: signer.email,
      signerName,
      signerRole: 'First Party',
      status: 'sent',
      sentAt: new Date(),
      embedSrc,
      metadata: { submissionResponse: submission },
    }).returning();

    if (task.status === 'pending') {
      await db.update(tasks).set({
        status: 'in_progress',
        updatedAt: new Date(),
      }).where(eq(tasks.id, taskId));
    }

    const docusealHost = (process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com').replace('api.', '').replace('/api', '');
    const formUrl = docusealSlug ? `${docusealHost}/s/${docusealSlug}` : null;

    res.json({
      success: true,
      data: {
        signatureId: sigRecord.id,
        embedSrc,
        slug: docusealSlug,
        formUrl,
        status: sigRecord.status,
        submissionId: docusealSubmissionId,
      },
    });
  } catch (error) {
    console.error('[Signing] Create request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create signing request' });
  }
};

// GET /api/signing/:taskId/status
export const getSigningStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(taskId)) {
      return res.status(400).json({ success: false, message: 'Invalid taskId format' });
    }

    const [sigRecord] = await db.select().from(documentSignatures)
      .where(eq(documentSignatures.taskId, taskId))
      .orderBy(desc(documentSignatures.createdAt));

    if (!sigRecord) {
      return res.json({
        success: true,
        data: { status: 'not_initiated', signatureId: null, embedSrc: null },
      });
    }

    const docusealHost = (process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com').replace('api.', '').replace('/api', '');
    const formUrl = sigRecord.docusealSlug ? `${docusealHost}/s/${sigRecord.docusealSlug}` : null;

    res.json({
      success: true,
      data: {
        signatureId: sigRecord.id,
        status: sigRecord.status,
        embedSrc: sigRecord.embedSrc,
        slug: sigRecord.docusealSlug,
        formUrl,
        submissionId: sigRecord.docusealSubmissionId,
        signedDocumentUrl: sigRecord.signedDocumentUrl,
        signedDocumentPath: sigRecord.signedDocumentPath,
        auditLogUrl: sigRecord.auditLogUrl,
        completedAt: sigRecord.completedAt,
        declineReason: sigRecord.declineReason,
      },
    });
  } catch (error) {
    console.error('[Signing] Status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get signing status' });
  }
};

// POST /api/signing/:taskId/check — polls DocuSeal as a fallback for when webhooks don't arrive
export const manualCheckStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    const [sigRecord] = await db.select().from(documentSignatures)
      .where(eq(documentSignatures.taskId, taskId))
      .orderBy(desc(documentSignatures.createdAt));

    if (!sigRecord) {
      return res.status(404).json({ success: false, message: 'No signing request found for this task' });
    }

    if (sigRecord.status === 'completed') {
      return res.json({
        success: true,
        data: { status: 'completed', signedDocumentPath: sigRecord.signedDocumentPath },
      });
    }

    const submitterData = await getSubmitter(sigRecord.docusealSubmitterId);

    if (submitterData.status === 'completed') {
      await processSigningCompletion(sigRecord, submitterData);

      return res.json({
        success: true,
        data: { status: 'completed', message: 'Signing completed and processed' },
      });
    }

    if (submitterData.status === 'declined') {
      await processSigningDecline(sigRecord, submitterData);
      return res.json({
        success: true,
        data: { status: 'declined', reason: submitterData.decline_reason },
      });
    }

    // Update status if changed (e.g., opened)
    if (submitterData.status !== sigRecord.status) {
      await db.update(documentSignatures).set({
        status: submitterData.status,
        openedAt: submitterData.opened_at ? new Date(submitterData.opened_at) : sigRecord.openedAt,
        updatedAt: new Date(),
      }).where(eq(documentSignatures.id, sigRecord.id));
    }

    res.json({
      success: true,
      data: { status: submitterData.status },
    });
  } catch (error) {
    console.error('[Signing] Manual check error:', error);
    res.status(500).json({ success: false, message: 'Failed to check signing status' });
  }
};

// POST /api/signing/webhook — receives form.completed/declined/viewed/started events from DocuSeal
export const handleWebhook = async (req, res) => {
  try {
    const { event_type, data } = req.body;

    console.log(`[DocuSeal Webhook] ${event_type}`, JSON.stringify(data?.id || data?.email));

    if (!data) {
      return res.status(400).json({ error: 'No data in webhook' });
    }

    const submitterId = data.id;
    const submissionId = data.submission?.id;

    let sigRecord = null;

    if (submitterId) {
      [sigRecord] = await db.select().from(documentSignatures)
        .where(eq(documentSignatures.docusealSubmitterId, submitterId));
    }

    if (!sigRecord && submissionId) {
      [sigRecord] = await db.select().from(documentSignatures)
        .where(eq(documentSignatures.docusealSubmissionId, submissionId));
    }

    if (!sigRecord) {
      console.warn('[DocuSeal Webhook] No matching signature record found');
      return res.json({ received: true, matched: false });
    }

    switch (event_type) {
      case 'form.viewed':
        await db.update(documentSignatures).set({
          status: 'opened',
          openedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(documentSignatures.id, sigRecord.id));
        break;

      case 'form.started':
        await db.update(documentSignatures).set({
          status: 'opened',
          openedAt: sigRecord.openedAt || new Date(),
          updatedAt: new Date(),
        }).where(eq(documentSignatures.id, sigRecord.id));
        break;

      case 'form.completed':
        await processSigningCompletion(sigRecord, data);
        break;

      case 'form.declined':
        await processSigningDecline(sigRecord, data);
        break;

      default:
        console.log(`[DocuSeal Webhook] Unhandled event: ${event_type}`);
    }

    res.json({ received: true, matched: true });
  } catch (error) {
    console.error('[DocuSeal Webhook] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// GET /api/signing/:signatureId/file — serves the signed PDF inline for OnlyOffice.
// No auth check: OnlyOffice's server calls this directly (like serveDocument).
export const serveSignedDocumentFile = async (req, res) => {
  try {
    const { signatureId } = req.params;

    const [sigRecord] = await db.select().from(documentSignatures)
      .where(eq(documentSignatures.id, signatureId));

    if (!sigRecord) {
      return res.status(404).json({ success: false, message: 'Signature record not found' });
    }

    if (sigRecord.signedDocumentPath) {
      try {
        await fs.access(sigRecord.signedDocumentPath);
        const buffer = await fs.readFile(sigRecord.signedDocumentPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="signed_${path.basename(sigRecord.signedDocumentPath)}"`);
        return res.send(buffer);
      } catch {
        // File not on disk
      }
    }

    if (sigRecord.signedDocumentUrl) {
      try {
        const response = await fetch(sigRecord.signedDocumentUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="signed_document.pdf"');
          return res.send(buffer);
        }
      } catch (err) {
        console.error('[Signing] Failed to proxy signed document:', err);
      }
    }

    res.status(404).json({ success: false, message: 'Signed document not available' });
  } catch (error) {
    console.error('[Signing] Serve signed file error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve signed document' });
  }
};

// GET /api/signing/:signatureId/documents
export const getSignedDocuments = async (req, res) => {
  try {
    const { signatureId } = req.params;

    const [sigRecord] = await db.select().from(documentSignatures)
      .where(eq(documentSignatures.id, signatureId));

    if (!sigRecord) {
      return res.status(404).json({ success: false, message: 'Signature record not found' });
    }

    if (sigRecord.signedDocumentPath) {
      try {
        await fs.access(sigRecord.signedDocumentPath);
        const buffer = await fs.readFile(sigRecord.signedDocumentPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="signed_${path.basename(sigRecord.signedDocumentPath)}"`);
        return res.send(buffer);
      } catch {
        // File not on disk, fall through
      }
    }

    if (sigRecord.signedDocumentUrl) {
      return res.json({
        success: true,
        data: {
          url: sigRecord.signedDocumentUrl,
          auditLogUrl: sigRecord.auditLogUrl,
        },
      });
    }

    res.status(404).json({ success: false, message: 'Signed document not available yet' });
  } catch (error) {
    console.error('[Signing] Get signed docs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get signed documents' });
  }
};

async function processSigningCompletion(sigRecord, data) {
  const signedDocs = data.documents || [];
  const signedDocUrl = signedDocs[0]?.url || null;
  const auditLogUrl = data.audit_log_url || data.submission?.audit_log_url || null;

  let signedDocPath = null;
  if (signedDocUrl) {
    try {
      await fs.mkdir(SIGNED_DIR, { recursive: true });
      const filename = `signed_${sigRecord.documentId}_${Date.now()}.pdf`;
      signedDocPath = path.join(SIGNED_DIR, filename);
      await downloadSignedDocument(signedDocUrl, signedDocPath);
    } catch (err) {
      console.error('[Signing] Failed to download signed document:', err);
      // Continue — we still have the URL
    }
  }

  await db.update(documentSignatures).set({
    status: 'completed',
    completedAt: new Date(),
    signedDocumentUrl: signedDocUrl,
    signedDocumentPath: signedDocPath,
    auditLogUrl,
    updatedAt: new Date(),
  }).where(eq(documentSignatures.id, sigRecord.id));

  // Auto-complete the linked task
  if (sigRecord.taskId) {
    await db.update(tasks).set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tasks.id, sigRecord.taskId));

    // Add comment
    if (sigRecord.signerUserId) {
      await db.insert(taskComments).values({
        taskId: sigRecord.taskId,
        content: `Document signed electronically via DocuSeal.`,
        createdBy: sigRecord.signerUserId,
      });
    }

    const [linkedStep] = await db.select().from(formWorkflowSteps)
      .where(eq(formWorkflowSteps.taskId, sigRecord.taskId));

    if (linkedStep) {
      await db.update(formWorkflowSteps).set({
        status: 'completed',
        completedAt: new Date(),
        notes: 'Signed electronically',
        updatedAt: new Date(),
      }).where(eq(formWorkflowSteps.id, linkedStep.id));

      const [nextStep] = await db.select().from(formWorkflowSteps)
        .where(and(
          eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
          eq(formWorkflowSteps.stepOrder, linkedStep.stepOrder + 1),
        ));

      if (nextStep) {
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
        if (linkedStep.formInstanceId) {
          await db.update(formInstances).set({
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(formInstances.id, linkedStep.formInstanceId));
        }
      }
    }
  }
}

async function processSigningDecline(sigRecord, data) {
  const declineReason = data.decline_reason || 'Declined by signer';

  await db.update(documentSignatures).set({
    status: 'declined',
    declinedAt: new Date(),
    declineReason,
    updatedAt: new Date(),
  }).where(eq(documentSignatures.id, sigRecord.id));

  if (sigRecord.taskId) {
    const [linkedTask] = await db.select().from(tasks).where(eq(tasks.id, sigRecord.taskId));

    await db.update(tasks).set({
      status: 'cancelled',
      updatedAt: new Date(),
    }).where(eq(tasks.id, sigRecord.taskId));

    if (sigRecord.signerUserId) {
      await db.insert(taskComments).values({
        taskId: sigRecord.taskId,
        content: `Signing declined: ${declineReason}`,
        createdBy: sigRecord.signerUserId,
      });
    }

    if (linkedTask?.createdBy) {
      try {
        await createNotification(linkedTask.createdBy, {
          type: 'signing_declined',
          title: 'Penandatanganan ditolak',
          message: `Tugas "${linkedTask.title}" ditolak: ${declineReason}`,
          relatedType: 'task',
          relatedId: sigRecord.taskId,
        });
      } catch (e) { console.warn('[Signing] decline notification failed:', e.message); }
    }

    const [linkedStep] = await db.select().from(formWorkflowSteps)
      .where(eq(formWorkflowSteps.taskId, sigRecord.taskId));

    if (linkedStep) {
      await db.update(formWorkflowSteps).set({
        status: 'skipped',
        notes: `Signing declined: ${declineReason}`,
        updatedAt: new Date(),
      }).where(eq(formWorkflowSteps.id, linkedStep.id));

      await db.update(formWorkflowSteps).set({
        status: 'skipped',
        updatedAt: new Date(),
      }).where(and(
        eq(formWorkflowSteps.formInstanceId, linkedStep.formInstanceId),
        eq(formWorkflowSteps.status, 'pending'),
      ));

      if (linkedStep.formInstanceId) {
        await db.update(formInstances).set({
          status: 'cancelled',
          updatedAt: new Date(),
        }).where(eq(formInstances.id, linkedStep.formInstanceId));
      }
    }
  }
}

// POST /api/signing/remove-bg — makes near-white pixels transparent, returns a PNG as base64
export const removeSignatureBackground = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'image (base64) is required' });

    let base64Data = image;
    if (image.startsWith('data:')) {
      base64Data = image.split(',')[1];
    }

    const inputBuffer = Buffer.from(base64Data, 'base64');

    const rawImage = sharp(inputBuffer).ensureAlpha();
    const metadata = await rawImage.metadata();
    const { data: pixelData, info } = await rawImage.raw().toBuffer({ resolveWithObject: true });

    const { width, height, channels } = info;

    // Pixels with R, G, B all above 200 are treated as background
    const THRESHOLD = 200;
    const outputPixels = Buffer.from(pixelData);

    for (let i = 0; i < outputPixels.length; i += channels) {
      const r = outputPixels[i];
      const g = outputPixels[i + 1];
      const b = outputPixels[i + 2];

      if (r > THRESHOLD && g > THRESHOLD && b > THRESHOLD) {
        outputPixels[i + 3] = 0;
      }
    }

    const resultBuffer = await sharp(outputPixels, {
      raw: { width, height, channels },
    }).png().toBuffer();

    const resultBase64 = `data:image/png;base64,${resultBuffer.toString('base64')}`;

    res.json({
      success: true,
      data: { image: resultBase64 },
    });
  } catch (error) {
    console.error('[Signing] Remove bg error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove background' });
  }
};
