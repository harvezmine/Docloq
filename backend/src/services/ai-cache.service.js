// MongoDB cache for AI analysis results (avoids redundant OpenAI calls), plus a
// per-document analysis history for audit trail.

import mongoose from 'mongoose';
import crypto from 'crypto';

let connected = false;

export const connectMongo = async () => {
  if (connected) return;

  const uri = process.env.MONGO_URI || process.env.MONGO_URL;
  if (!uri) {
    const msg = '[AI Cache] neither MONGO_URI nor MONGO_URL is set — result cache disabled, every analysis will re-bill OpenAI';
    if (process.env.NODE_ENV === 'production') console.error(msg);
    else console.warn(msg);
    return;
  }

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    connected = true;
    console.log('[AI Cache] MongoDB connected');
  } catch (err) {
    console.error('[AI Cache] MongoDB connection failed (cache disabled, analyses will re-bill):', err.message);
  }
};

const analysisResultSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, index: true, unique: true },

  documentId: { type: String, required: true, index: true },
  versionId: { type: String, default: '', index: true },
  organizationId: { type: String, required: true },
  userId: { type: String, required: true },
  prompt: { type: String, required: true },

  result: { type: mongoose.Schema.Types.Mixed, required: true },
  model: { type: String },
  tokensUsed: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  hitCount: { type: Number, default: 0 },
  lastHitAt: { type: Date },
}, { collection: 'analysis_results' });

const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);

// Permanent history of all analyses per document (unlike the TTL'd cache above).
const analysisHistorySchema = new mongoose.Schema({
  documentId: { type: String, required: true, index: true },
  organizationId: { type: String, required: true },
  userId: { type: String, required: true },
  prompt: { type: String, required: true },
  resultSummary: { type: String },
  model: { type: String },
  tokensUsed: { type: Number, default: 0 },
  cached: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'analysis_history' });

const AnalysisHistory = mongoose.model('AnalysisHistory', analysisHistorySchema);


const generateCacheKey = (documentId, prompt, versionId = '', extra = null) => {
  const normalized = prompt.toLowerCase().trim();
  const extraStr = extra ? JSON.stringify(extra) : '';
  return crypto
    .createHash('sha256')
    .update(`${documentId}:${versionId}:${normalized}:${extraStr}`)
    .digest('hex');
};

/** Supports legacy 2-arg call (documentId, prompt); preferred: (documentId, prompt, { versionId, pageRange }). */
export const getCachedResult = async (documentId, prompt, opts = {}) => {
  if (!connected) return null;

  try {
    const { versionId = '', pageRange = null } = opts || {};
    const cacheKey = generateCacheKey(documentId, prompt, versionId, pageRange);
    const cached = await AnalysisResult.findOneAndUpdate(
      { cacheKey, expiresAt: { $gt: new Date() } },
      { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } },
      { new: true },
    ).lean();

    if (cached) {
      console.log(`[AI Cache] HIT for document ${documentId}@${versionId || 'latest'} (hits: ${cached.hitCount})`);
      return cached.result;
    }

    return null;
  } catch (err) {
    console.warn('[AI Cache] Get error:', err.message);
    return null;
  }
};

export const setCachedResult = async (documentId, prompt, result, metadata = {}, ttlHours = 24) => {
  if (!connected) return;

  try {
    const cacheKey = generateCacheKey(
      documentId,
      prompt,
      metadata.versionId || '',
      metadata.pageRange || null,
    );
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await AnalysisResult.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        documentId,
        versionId: metadata.versionId || '',
        organizationId: metadata.organizationId || '',
        userId: metadata.userId || '',
        prompt,
        result,
        model: metadata.model || '',
        tokensUsed: metadata.tokensUsed || 0,
        expiresAt,
        hitCount: 0,
        lastHitAt: null,
        createdAt: new Date(),
      },
      { upsert: true, new: true },
    );

    console.log(`[AI Cache] STORED for document ${documentId}@${metadata.versionId || 'latest'} (TTL: ${ttlHours}h)`);
  } catch (err) {
    console.warn('[AI Cache] Set error:', err.message);
  }
};


export const recordAnalysisHistory = async (documentId, prompt, metadata = {}) => {
  if (!connected) return;

  try {
    await AnalysisHistory.create({
      documentId,
      organizationId: metadata.organizationId || '',
      userId: metadata.userId || '',
      prompt,
      resultSummary: metadata.resultSummary || '',
      model: metadata.model || '',
      tokensUsed: metadata.tokensUsed || 0,
      cached: metadata.cached || false,
    });
  } catch (err) {
    console.warn('[AI Cache] History record error:', err.message);
  }
};

export const getAnalysisHistory = async (documentId, limit = 20) => {
  if (!connected) return [];

  try {
    return await AnalysisHistory
      .find({ documentId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch {
    return [];
  }
};

/**
 * Invalidate cache for a document (e.g., when AI access is revoked).
 */
export const invalidateDocumentCache = async (documentId) => {
  if (!connected) return;

  try {
    const result = await AnalysisResult.deleteMany({ documentId });
    if (result.deletedCount > 0) {
      console.log(`[AI Cache] Invalidated ${result.deletedCount} entries for document ${documentId}`);
    }
  } catch (err) {
    console.warn('[AI Cache] Invalidation error:', err.message);
  }
};

export const cacheHealthCheck = () => {
  return {
    connected,
    readyState: mongoose.connection.readyState, // 0=disconnected, 1=connected, 2=connecting
  };
};
