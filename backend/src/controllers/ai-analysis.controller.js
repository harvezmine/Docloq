import {
  getDocumentsForAnalysis,
  grantAIAccess,
  revokeAIAccess,
  analyzeDocument,
  getDocumentAIStatus,
  getAnalysisHistory,
  getDocumentPageInfo,
  getQuotaStatus,
  QuotaExceededError,
} from '../services/ai-analysis.service.js';

// GET /api/ai-analysis/documents
export const listDocuments = async (req, res) => {
  try {
    const { search } = req.query;
    const docs = await getDocumentsForAnalysis(
      req.user.id,
      req.user.organizationId,
      req.user.role,
      search || '',
    );

    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('[AI Analysis] listDocuments error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ai-analysis/documents/:id/grant — decrypts, embeds, and indexes the document in Qdrant
export const grant = async (req, res) => {
  try {
    // Default 'censored' when a client sends nothing — the safe direction.
    const result = await grantAIAccess(
      req.params.id,
      req.user.id,
      req.user.organizationId,
      req.body?.redactionMode || 'censored',
    );

    if (result.alreadyGranted) {
      return res.json({ success: true, message: 'AI access already granted', data: result });
    }

    res.json({ success: true, message: 'AI access granted successfully', data: result });
  } catch (error) {
    console.error('[AI Analysis] grant error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/ai-analysis/documents/:id/revoke — deletes the document's vector from Qdrant
export const revoke = async (req, res) => {
  try {
    const result = await revokeAIAccess(
      req.params.id,
      req.user.id,
      req.user.organizationId,
    );

    res.json({ success: true, message: 'AI access revoked successfully', data: result });
  } catch (error) {
    console.error('[AI Analysis] revoke error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/ai-analysis/documents/:id/analyze
export const analyze = async (req, res) => {
  try {
    const { prompt, pageRange } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    let validatedPageRange = null;
    if (pageRange && Array.isArray(pageRange)) {
      validatedPageRange = pageRange
        .filter(p => typeof p === 'number' && p >= 1)
        .map(p => Math.floor(p));
    }

    const result = await analyzeDocument(
      req.params.id,
      prompt,
      req.user.id,
      req.user.organizationId,
      { pageRange: validatedPageRange },
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Analysis] analyze error:', error.message);
    // Was `error.message.includes('quota')` — a string match that broke the moment the quota
    // message was localised to Indonesian ("Kuota ... habis"), silently downgrading 429 to 400.
    // Match on the type instead, so the wording can change freely.
    if (error instanceof QuotaExceededError) {
      return res.status(429).json({
        success: false,
        code: 'ORG_QUOTA_EXCEEDED',
        message: error.message,
        kind: error.kind,
        used: error.used,
        limit: error.limit,
        resetAt: error.resetAt,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/ai-analysis/documents/:id/page-info
export const pageInfo = async (req, res) => {
  try {
    const result = await getDocumentPageInfo(
      req.params.id,
      req.user.organizationId,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Analysis] pageInfo error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/ai-analysis/quota
export const quota = async (req, res) => {
  try {
    const result = await getQuotaStatus(req.user.organizationId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Analysis] quota error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ai-analysis/documents/:id/history
export const history = async (req, res) => {
  try {
    const data = await getAnalysisHistory(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[AI Analysis] history error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// GET /api/ai-analysis/documents/:id/status
export const status = async (req, res) => {
  try {
    const result = await getDocumentAIStatus(
      req.params.id,
      req.user.organizationId,
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[AI Analysis] status error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
