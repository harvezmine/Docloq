// Owner-facing activity log — tenant-scoped view over the audit_logs hash chain.
// Every query is FORCED to req.user.organizationId (never a client-supplied orgId),
// so an owner can only ever see their own organization's activity.

import { and, eq, gte, lte, desc, count, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, users, documents, blockchainAnchors } from '../db/schema.js';
import { verifyChainForOrg } from '../services/audit.service.js';
import { verifyAnchorsForOrg } from '../services/audit-anchor.service.js';
import { explorerTxUrl } from '../services/verification.service.js';

// Coarse filter values map 1:1 to the indexed audit_action enum column.
const FILTERABLE_ACTIONS = ['create', 'update', 'download', 'share', 'archive', 'restore', 'delete', 'read'];

// Fine-grained category (for the UI icon/color/verb) derived from action + resourceType + details.
const deriveCategory = (row) => {
  const a = row.action;
  const rt = row.resourceType;
  const d = row.details || {};
  if (a === 'create') {
    if (rt === 'folder') return 'folder_create';
    if (rt === 'document') return 'upload';
    if (rt === 'document_version') return 'version';
    if (rt === 'ai_answer') return d.subjectType === 'output' ? 'ai_output_receipt' : 'ai_chat_receipt';
    if (rt === 'organization') return 'org_create';
    if (rt === 'user') return 'user_create';
    return 'create';
  }
  if (a === 'update') {
    if (d.action === 'rename') return 'rename';
    if (d.editedVia) return 'edit';
    if (d.aiAction || d.ai || rt === 'document') return 'ai_access';
    return 'update';
  }
  if (a === 'download') return 'download';
  if (a === 'share') return rt === 'ai_project' ? 'ai_project_share' : 'share';
  if (a === 'archive') return 'archive';
  if (a === 'restore') return 'restore';
  if (a === 'delete') return 'delete';
  if (a === 'read') return rt === 'chatbot' ? 'chatbot' : rt === 'document' ? 'ai_analyze' : 'read';
  return 'other';
};

const actorName = (u, row) => {
  if (u?.firstName || u?.lastName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
  if (u?.email) return u.email.split('@')[0];
  if (row?.details?.actor === 'superadmin_gate') return 'Administrator sistem';
  return 'Sistem';
};

// GET /api/activity?action=&from=&to=&page=&pageSize=
export const getActivityFeed = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization context' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const conds = [eq(auditLogs.organizationId, orgId)];

    const action = (req.query.action || '').trim();
    if (action && action !== 'all' && FILTERABLE_ACTIONS.includes(action)) {
      conds.push(eq(auditLogs.action, action));
    }
    const from = (req.query.from || '').trim();
    const to = (req.query.to || '').trim();
    if (from && !Number.isNaN(Date.parse(from))) conds.push(gte(auditLogs.createdAt, new Date(from)));
    if (to && !Number.isNaN(Date.parse(to))) {
      // inclusive end-of-day when a bare date is given
      const end = new Date(to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setHours(23, 59, 59, 999);
      conds.push(lte(auditLogs.createdAt, end));
    }

    const where = and(...conds);

    const [{ n: total }] = await db.select({ n: count() }).from(auditLogs).where(where);

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        sequenceNumber: auditLogs.sequenceNumber,
        userId: auditLogs.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        docName: documents.originalFilename,
        docDeletedAt: documents.deletedAt,
        docAnchored: documents.blockchainAnchored,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(documents, eq(auditLogs.resourceId, documents.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = rows.map((r) => {
      const isDoc = r.resourceType === 'document';
      const resourceName = (isDoc && r.docName) || r.details?.filename || r.details?.companyName || null;
      const resourceExists = isDoc ? !!r.docName && !r.docDeletedAt : false;
      return {
        id: r.id,
        category: deriveCategory(r),
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        resourceName,
        resourceExists,
        onChain: isDoc ? !!r.docAnchored : false,
        actorName: actorName({ firstName: r.firstName, lastName: r.lastName, email: r.email }, r),
        createdAt: r.createdAt,
        sequenceNumber: r.sequenceNumber,
      };
    });

    return res.json({
      success: true,
      data: { items, page, pageSize, total, hasMore: offset + items.length < total },
    });
  } catch (error) {
    console.error('getActivityFeed error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load activity' });
  }
};

// GET /api/activity/integrity — tamper-evident hash-chain verdict for THIS org only.
export const getActivityIntegrity = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization context' });
    const result = await verifyChainForOrg(orgId);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('getActivityIntegrity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify integrity' });
  }
};

// GET /api/activity/blockchain — anchor coverage + recent document anchors for THIS org.
export const getActivityBlockchain = async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization context' });

    // Documents belonging to this org (used to scope anchors — blockchain_anchors has no org column).
    const orgDocs = await db
      .select({ id: documents.id, anchored: documents.blockchainAnchored })
      .from(documents)
      .where(and(eq(documents.organizationId, orgId)));

    const totalDocs = orgDocs.length;
    const anchoredDocs = orgDocs.filter((d) => d.anchored).length;
    const docIds = orgDocs.map((d) => d.id);

    let recent = [];
    if (docIds.length) {
      const anchorRows = await db
        .select({
          id: blockchainAnchors.id,
          documentId: blockchainAnchors.documentId,
          network: blockchainAnchors.blockchainNetwork,
          txHash: blockchainAnchors.transactionHash,
          blockNumber: blockchainAnchors.blockNumber,
          status: blockchainAnchors.status,
          anchoredHash: blockchainAnchors.anchoredHash,
          createdAt: blockchainAnchors.createdAt,
          confirmedAt: blockchainAnchors.confirmedAt,
          docName: documents.originalFilename,
        })
        .from(blockchainAnchors)
        .leftJoin(documents, eq(blockchainAnchors.documentId, documents.id))
        .where(inArray(blockchainAnchors.documentId, docIds))
        .orderBy(desc(blockchainAnchors.createdAt))
        .limit(10);

      recent = anchorRows.map((a) => ({
        id: a.id,
        documentId: a.documentId,
        docName: a.docName,
        network: a.network,
        txHash: a.txHash,
        blockNumber: a.blockNumber,
        status: a.status,
        explorerUrl: explorerTxUrl(a.network, a.txHash),
        anchoredAt: a.confirmedAt || a.createdAt,
      }));
    }

    // Best-effort audit-chain anchor verification (never fail the whole endpoint on RPC issues).
    let auditAnchors = null;
    try {
      auditAnchors = await verifyAnchorsForOrg(orgId);
    } catch (e) {
      console.warn('[Activity] verifyAnchorsForOrg failed:', e.message);
    }

    return res.json({
      success: true,
      data: {
        totalDocuments: totalDocs,
        anchoredDocuments: anchoredDocs,
        coverage: totalDocs ? Math.round((anchoredDocs / totalDocs) * 100) : 0,
        recentAnchors: recent,
        auditAnchors,
      },
    });
  } catch (error) {
    console.error('getActivityBlockchain error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load blockchain status' });
  }
};
