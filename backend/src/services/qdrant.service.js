// Qdrant vector index — stores only embeddings + metadata, never document content.

import { QdrantClient } from '@qdrant/js-client-rest';
import uploadConfig from '../config/upload.config.js';

let client = null;
let collectionReady = false;

const getClient = () => {
  if (client) return client;

  const opts = { url: uploadConfig.qdrant.url };
  const apiKey = process.env.QDRANT_API_KEY;
  if (apiKey) opts.apiKey = apiKey;

  client = new QdrantClient(opts);

  const mode = apiKey ? 'Cloud (API key)' : 'Local';
  console.log(`[Qdrant] Client initialized → ${uploadConfig.qdrant.url} [${mode}]`);
  return client;
};

const ensureCollection = async () => {
  if (collectionReady) return;

  const qdrant = getClient();
  const collectionName = uploadConfig.qdrant.collection;

  try {
    await qdrant.getCollection(collectionName);
    collectionReady = true;
  } catch {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: uploadConfig.qdrant.vectorSize,
        distance: 'Cosine',
      },
      // Optimized for filtered search by organization
      optimizers_config: {
        indexing_threshold: 100,
      },
    });

    await qdrant.createPayloadIndex(collectionName, {
      field_name: 'organizationId',
      field_schema: 'keyword',
    });

    await qdrant.createPayloadIndex(collectionName, {
      field_name: 'folderId',
      field_schema: 'keyword',
    });

    collectionReady = true;
    console.log(`[Qdrant] Collection "${collectionName}" created with Cosine distance`);
  }
};

let chunkCollectionReady = false;

const ensureChunkCollection = async () => {
  if (chunkCollectionReady) return;

  const qdrant = getClient();
  const name = uploadConfig.qdrant.chunkCollection;

  try {
    await qdrant.getCollection(name);
    chunkCollectionReady = true;
  } catch {
    await qdrant.createCollection(name, {
      vectors: {
        size: uploadConfig.qdrant.vectorSize,
        distance: 'Cosine',
      },
      optimizers_config: {
        indexing_threshold: 100,
      },
    });
    for (const field of ['organizationId', 'projectSourceId', 'documentId']) {
      await qdrant.createPayloadIndex(name, { field_name: field, field_schema: 'keyword' });
    }
    chunkCollectionReady = true;
    console.log(`[Qdrant] Chunk collection "${name}" created with Cosine distance`);
  }
};

// Returns embedding vector, or null if OpenAI is unavailable.
export const generateEmbedding = async (text) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[Qdrant] OPENAI_API_KEY not set — skipping embedding generation');
    return null;
  }

  try {
    // Truncate to ~8000 tokens (~32000 chars) to stay within model limits
    const truncated = text.length > 32000 ? text.substring(0, 32000) : text;

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: truncated,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Qdrant] OpenAI embedding error:', err);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error('[Qdrant] Embedding generation failed:', err.message);
    return null;
  }
};

// Called async after upload (non-blocking); skips silently if embeddings unavailable.
export const indexDocument = async (documentId, textContent, organizationId, metadata = {}) => {
  const embedding = await generateEmbedding(textContent);
  if (!embedding) return;

  await ensureCollection();
  const qdrant = getClient();

  await qdrant.upsert(uploadConfig.qdrant.collection, {
    points: [
      {
        id: documentId,
        vector: embedding,
        payload: {
          organizationId,
          folderId: metadata.folderId || null,
          filename: metadata.filename || '',
          mimeType: metadata.mimeType || '',
          indexedAt: new Date().toISOString(),
        },
      },
    ],
  });

  console.log(`[Qdrant] Indexed document: ${documentId}`);
};

// Results filtered by organization for multi-tenant isolation.
export const searchDocuments = async (query, organizationId, limit = 10) => {
  const queryVector = await generateEmbedding(query);
  if (!queryVector) return [];

  await ensureCollection();
  const qdrant = getClient();

  const results = await qdrant.search(uploadConfig.qdrant.collection, {
    vector: queryVector,
    filter: {
      must: [
        { key: 'organizationId', match: { value: organizationId } },
      ],
    },
    limit,
    with_payload: true,
  });

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload,
  }));
};

// Raw-filter search — used by AI Projects URL/YouTube sources.
export const searchByFilter = async (query, filter, limit = 8) => {
  const queryVector = await generateEmbedding(query);
  if (!queryVector) return [];

  await ensureCollection();
  const qdrant = getClient();

  const results = await qdrant.search(uploadConfig.qdrant.collection, {
    vector: queryVector,
    filter,
    limit,
    with_payload: true,
  });

  return results.map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
};

// Index arbitrary text (URL/transcript) with custom id; payload must include organizationId.
export const indexCustomContent = async (pointId, text, payload) => {
  const embedding = await generateEmbedding(text);
  if (!embedding) return null;

  await ensureCollection();
  const qdrant = getClient();

  await qdrant.upsert(uploadConfig.qdrant.collection, {
    points: [
      {
        id: pointId,
        vector: embedding,
        payload: { ...payload, indexedAt: new Date().toISOString() },
      },
    ],
  });
  return pointId;
};

export const deletePoint = async (pointId) => {
  if (!pointId) return;
  await ensureCollection();
  const qdrant = getClient();
  try {
    await qdrant.delete(uploadConfig.qdrant.collection, { points: [pointId] });
  } catch (e) {
    console.warn('[Qdrant] deletePoint warning:', e.message);
  }
};

export const findSimilarDocuments = async (documentId, organizationId, limit = 5) => {
  await ensureCollection();
  const qdrant = getClient();

  try {
    const results = await qdrant.recommend(uploadConfig.qdrant.collection, {
      positive: [documentId],
      filter: {
        must: [
          { key: 'organizationId', match: { value: organizationId } },
        ],
        must_not: [
          { has_id: [documentId] },
        ],
      },
      limit,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  } catch {
    return [];
  }
};

// Called during crypto shredding (GDPR Art 17) — no trace may remain.
export const deleteDocumentVector = async (documentId) => {
  try {
    await ensureCollection();
    const qdrant = getClient();

    await qdrant.delete(uploadConfig.qdrant.collection, {
      points: [documentId],
    });

    console.log(`[Qdrant] Deleted vector: ${documentId}`);
  } catch (err) {
    console.warn(`[Qdrant] Failed to delete vector ${documentId}:`, err.message);
  }
};

export const isDocumentIndexed = async (documentId) => {
  try {
    await ensureCollection();
    const qdrant = getClient();
    const results = await qdrant.retrieve(uploadConfig.qdrant.collection, {
      ids: [documentId],
      with_payload: false,
      with_vector: false,
    });
    return results.length > 0;
  } catch {
    return false;
  }
};

export const healthCheck = async () => {
  try {
    const qdrant = getClient();
    const collections = await qdrant.getCollections();
    return {
      available: true,
      collectionsCount: collections.collections.length,
    };
  } catch {
    return { available: false, collectionsCount: 0 };
  }
};

// ── Chunk collection ────────────────────────────────────────────────────────
// Same invariant as the file header: payload carries pointers + metadata only.
// Chunk text lives encrypted in Postgres and never reaches Qdrant.

export const upsertChunkPoints = async (points) => {
  if (!points?.length) return 0;
  await ensureChunkCollection();
  const qdrant = getClient();

  await qdrant.upsert(uploadConfig.qdrant.chunkCollection, {
    points: points.map((p) => ({
      id: p.pointId,
      vector: p.vector,
      payload: {
        organizationId: p.organizationId,
        projectId: p.projectId,
        projectSourceId: p.projectSourceId,
        documentId: p.documentId || null,
        chunkId: p.chunkId,
        chunkIndex: p.chunkIndex,
        page: p.page ?? null,
        title: p.title || '',
        sourceType: p.sourceType,
        indexedAt: new Date().toISOString(),
      },
    })),
  });
  return points.length;
};

// Always org-filtered and restricted to the caller's sources — multi-tenant isolation.
export const searchChunks = async (query, organizationId, projectSourceIds, limit = 12) => {
  if (!projectSourceIds?.length) return [];
  const queryVector = await generateEmbedding(query);
  if (!queryVector) return [];

  await ensureChunkCollection();
  const qdrant = getClient();

  const results = await qdrant.search(uploadConfig.qdrant.chunkCollection, {
    vector: queryVector,
    filter: {
      must: [
        { key: 'organizationId', match: { value: organizationId } },
        { key: 'projectSourceId', match: { any: projectSourceIds } },
      ],
    },
    limit,
    with_payload: true,
  });

  return results.map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
};

// Best-effort: runs on ordinary source removal, where a stale vector is not a correctness bug.
export const deleteChunkPointsBySource = async (projectSourceId) => {
  try {
    await ensureChunkCollection();
    const qdrant = getClient();
    await qdrant.delete(uploadConfig.qdrant.chunkCollection, {
      filter: { must: [{ key: 'projectSourceId', match: { value: projectSourceId } }] },
    });
  } catch (err) {
    console.warn(`[Qdrant] deleteChunkPointsBySource ${projectSourceId}:`, err.message);
  }
};

// Erasure path — must remove every chunk vector of a document across ALL projects.
// Deliberately does NOT swallow errors: callers record the failure as residual.
export const deleteChunkPointsByDocument = async (documentId) => {
  await ensureChunkCollection();
  const qdrant = getClient();
  await qdrant.delete(uploadConfig.qdrant.chunkCollection, {
    filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
  });
  console.log(`[Qdrant] Deleted chunk vectors for document: ${documentId}`);
};

// DoKi knowledge collection — small, separate from document/chunk collections.
const KB_COLLECTION = process.env.QDRANT_KB_COLLECTION || 'doki_knowledge';
let kbCollectionReady = false;

export const ensureKbCollection = async () => {
  if (kbCollectionReady) return;
  const qdrant = getClient();
  try {
    await qdrant.getCollection(KB_COLLECTION);
    kbCollectionReady = true;
  } catch {
    await qdrant.createCollection(KB_COLLECTION, {
      vectors: { size: uploadConfig.qdrant.vectorSize, distance: 'Cosine' },
    });
    kbCollectionReady = true;
    console.log(`[Qdrant] KB collection "${KB_COLLECTION}" created`);
  }
};

export const upsertKbPoints = async (points) => {
  await ensureKbCollection();
  const qdrant = getClient();
  await qdrant.upsert(KB_COLLECTION, { wait: true, points });
};

export const searchKb = async (queryVector, limit = 4) => {
  await ensureKbCollection();
  const qdrant = getClient();
  const res = await qdrant.search(KB_COLLECTION, { vector: queryVector, limit, with_payload: true });
  return res.map((r) => ({ score: r.score, payload: r.payload }));
};

export const kbCollectionName = () => KB_COLLECTION;
