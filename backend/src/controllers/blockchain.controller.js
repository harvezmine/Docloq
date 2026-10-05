// Only admin/owner roles can anchor and verify documents

import { db } from '../db/index.js';
import { documents, documentVersions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  anchorDocument,
  updateAnchor,
  verifyDocument,
  anchorBatch,
  getBlockchainStats,
  getTransactionHistory,
  getDocumentAnchorDetails,
  isReady,
} from '../services/blockchain.service.js';

// POST /api/blockchain/anchor/:documentId
export const anchorDocumentHandler = async (req, res) => {
  try {
    const { documentId } = req.params;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (doc.blockchainAnchored) {
      return res.status(400).json({ success: false, message: 'Document is already anchored. Use update instead.' });
    }

    if (!doc.contentHash) {
      return res.status(400).json({ success: false, message: 'Document has no content hash. Cannot anchor.' });
    }

    let version = null;
    if (doc.currentVersionId) {
      [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, doc.currentVersionId));
    }

    const result = await anchorDocument(
      doc.id,
      version?.id || doc.currentVersionId,
      doc.contentHash,
      doc.organizationId,
      version?.versionNumber || 1,
    );

    if (!result.success) {
      return res.status(503).json({ success: false, message: result.message });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Blockchain] Anchor handler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to anchor document' });
  }
};

// PUT /api/blockchain/anchor/:documentId — re-anchors after a document edit (manual trigger)
export const updateAnchorHandler = async (req, res) => {
  try {
    const { documentId } = req.params;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!doc.blockchainAnchored) {
      return res.status(400).json({ success: false, message: 'Document is not anchored yet. Use anchor first.' });
    }

    if (!doc.contentHash) {
      return res.status(400).json({ success: false, message: 'Document has no content hash' });
    }

    let version = null;
    if (doc.currentVersionId) {
      [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, doc.currentVersionId));
    }

    const result = await updateAnchor(doc.id, doc.contentHash, version?.versionNumber || 1, doc.organizationId);

    if (!result.success) {
      return res.status(503).json({ success: false, message: result.message });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Blockchain] Update anchor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update anchor' });
  }
};

// POST /api/blockchain/verify/:documentId
export const verifyDocumentHandler = async (req, res) => {
  try {
    const { documentId } = req.params;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!doc.contentHash) {
      return res.status(400).json({ success: false, message: 'Document has no content hash' });
    }

    const result = await verifyDocument(doc.id, doc.contentHash);
    const anchorRecords = await getDocumentAnchorDetails(documentId);

    return res.json({
      success: true,
      data: {
        ...result,
        document: {
          id: doc.id,
          name: doc.originalFilename,
          hash: doc.contentHash,
        },
        anchors: anchorRecords,
      },
    });
  } catch (error) {
    console.error('[Blockchain] Verify error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify document' });
  }
};

// GET /api/blockchain/anchor/:documentId
export const getDocumentAnchorHandler = async (req, res) => {
  try {
    const { documentId } = req.params;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const anchors = await getDocumentAnchorDetails(documentId);

    return res.json({
      success: true,
      data: {
        isAnchored: doc.blockchainAnchored,
        autoAnchorOnEdit: doc.autoAnchorOnEdit,
        anchors,
      },
    });
  } catch (error) {
    console.error('[Blockchain] Get anchor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get anchor info' });
  }
};

// PATCH /api/blockchain/auto-anchor/:documentId — toggles auto-anchor-on-edit
export const setAutoAnchorHandler = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { enabled } = req.body;
    const orgId = req.user?.organizationId;

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    await db.update(documents).set({
      autoAnchorOnEdit: enabled === true,
    }).where(eq(documents.id, documentId));

    return res.json({
      success: true,
      data: { documentId, autoAnchorOnEdit: enabled === true },
    });
  } catch (error) {
    console.error('[Blockchain] Set auto-anchor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update auto-anchor setting' });
  }
};

// POST /api/blockchain/anchor-batch — anchors multiple documents via a Merkle root
export const anchorBatchHandler = async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'documentIds array required' });
    }

    const orgId = req.user?.organizationId;
    const docs = [];
    for (const id of documentIds) {
      const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.organizationId, orgId)));
      if (doc && doc.contentHash && !doc.blockchainAnchored) {
        docs.push({
          documentId: doc.id,
          versionId: doc.currentVersionId,
          contentHash: doc.contentHash,
          organizationId: doc.organizationId,
        });
      }
    }

    if (docs.length === 0) {
      return res.status(400).json({ success: false, message: 'No eligible documents to anchor' });
    }

    const result = await anchorBatch(docs);

    if (!result.success) {
      return res.status(503).json({ success: false, message: result.message });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Blockchain] Batch anchor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to batch anchor' });
  }
};

export const getStatsHandler = async (req, res) => {
  try {
    const stats = await getBlockchainStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Blockchain] Stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get blockchain stats' });
  }
};

export const getTransactionsHandler = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const transactions = await getTransactionHistory(limit, offset);
    return res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('[Blockchain] Transactions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get transactions' });
  }
};

// PUT /api/blockchain/wallet — wallet config is env-managed (needs a restart); this just reports status
export const updateWalletHandler = async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        message: 'Wallet configuration is managed via environment variables.',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to get wallet config' });
  }
};

// Need to import uploadConfig for wallet handler
import uploadConfig from '../config/upload.config.js';
