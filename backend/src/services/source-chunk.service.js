// Chunk lifecycle: encrypt → persist → index, and erase.
// Document chunks use that document version's DEK, so crypto-shred kills them automatically.
// Sources with no document of their own (url/text/note) get a minted DEK in content_key.

import crypto from 'crypto';
import { eq, inArray, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiSourceChunks, aiProjectSources, documentVersions } from '../db/schema.js';
import {
  encryptFile,
  decryptWithKey,
  unwrapVersionKey,
  decryptDocumentKey,
  generateDocumentKey,
} from './encryption.service.js';
import uploadConfig from '../config/upload.config.js';
import {
  generateEmbedding,
  upsertChunkPoints,
  deleteChunkPointsBySource,
  deleteChunkPointsByDocument,
} from './qdrant.service.js';

const { ivLength } = uploadConfig.encryption;

/** Raised when a source's key is gone (shredded). Callers skip the source; they do not 500. */
export class SourceKeyUnavailableError extends Error {
  constructor(sourceId, reason) {
    super(`Kunci sumber tidak tersedia (${reason})`);
    this.code = 'SOURCE_KEY_UNAVAILABLE';
    this.sourceId = sourceId;
  }
}

// ── Pure crypto (unit-testable without a DB) ────────────────────────────────

/** Fresh IV per chunk — reusing one under a GCM key breaks confidentiality and authenticity. */
export function encryptChunkText(plaintext, plaintextKey) {
  const iv = crypto.randomBytes(ivLength).toString('base64');
  const { encryptedBuffer, authTag } = encryptFile(Buffer.from(plaintext, 'utf8'), plaintextKey, iv);
  return {
    cipherText: encryptedBuffer.toString('base64'),
    iv,
    authTag,
    charLen: plaintext.length,
  };
}

export function decryptChunkText(row, plaintextKey) {
  return decryptWithKey(Buffer.from(row.cipherText, 'base64'), plaintextKey, row.iv, row.authTag)
    .toString('utf8');
}

// ── Key resolution ──────────────────────────────────────────────────────────

/** @returns {Promise<Buffer>} plaintext DEK for a source. Throws SourceKeyUnavailableError if shredded. */
export async function resolveSourceKey(source) {
  if (source.sourceType === 'document') {
    // Pinned to the version the chunks were encrypted under; "latest" would break every chunk
    // the moment the document is edited. The fallback only serves pre-pinning legacy rows.
    const [version] = source.contentVersionId
      ? await db.select().from(documentVersions)
        .where(eq(documentVersions.id, source.contentVersionId))
        .limit(1)
      : await db.select().from(documentVersions)
        .where(eq(documentVersions.documentId, source.documentId))
        .orderBy(desc(documentVersions.versionNumber))
        .limit(1);
    if (!version) throw new SourceKeyUnavailableError(source.id, 'versi dokumen tidak ada');
    try {
      return await unwrapVersionKey(version);
    } catch (err) {
      // encryption_key_id / pqcEnvelope nulled by crypto-shred → erasure working as designed.
      throw new SourceKeyUnavailableError(source.id, err.message);
    }
  }
  if (!source.contentKey) throw new SourceKeyUnavailableError(source.id, 'content_key kosong');
  try {
    return await decryptDocumentKey(source.contentKey);
  } catch (err) {
    throw new SourceKeyUnavailableError(source.id, err.message);
  }
}

/** Mint a wrapped DEK for a source that has no document of its own. */
export async function mintSourceKey() {
  const { encryptedKey, plaintextKey } = await generateDocumentKey();
  return { contentKey: encryptedKey, plaintextKey };
}

// ── Persistence ─────────────────────────────────────────────────────────────

/**
 * Replace all chunks for a source: encrypt, embed, persist, index.
 * @param {{sourceId, documentId, projectId, organizationId, title, sourceType, plaintextKey}} ctx
 * @param {Array<{chunkIndex, page, text}>} chunks
 * @returns {Promise<number>} chunks stored
 */
export async function storeChunksForSource(ctx, chunks) {
  await deleteChunksForSource(ctx.sourceId);
  if (!chunks.length) return 0;

  // Embed first so qdrant_point_id is only set on chunks whose vector really reached Qdrant —
  // it is the only signal for "is this source searchable?". Best-effort; stuff mode needs none.
  const vectors = [];
  for (const c of chunks) vectors.push(await generateEmbedding(c.text));

  const rows = chunks.map((c, i) => ({
    id: crypto.randomUUID(),
    sourceId: ctx.sourceId,
    documentId: ctx.documentId || null,
    chunkIndex: c.chunkIndex,
    page: c.page ?? null,
    qdrantPointId: vectors[i] ? crypto.randomUUID() : null,
    ...encryptChunkText(c.text, ctx.plaintextKey),
  }));

  await db.insert(aiSourceChunks).values(rows);

  const points = rows
    .map((r, i) => (vectors[i] ? {
      pointId: r.qdrantPointId,
      vector: vectors[i],
      chunkId: r.id,
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      projectSourceId: ctx.sourceId,
      documentId: ctx.documentId || null,
      chunkIndex: chunks[i].chunkIndex,
      page: chunks[i].page ?? null,
      title: ctx.title,
      sourceType: ctx.sourceType,
    } : null))
    .filter(Boolean);

  if (points.length) {
    try {
      await upsertChunkPoints(points);
    } catch (err) {
      // Nothing reached Qdrant, so no chunk may keep claiming a point id.
      console.warn('[source-chunk] vector upsert failed, stuff mode only:', err.message);
      await db.update(aiSourceChunks)
        .set({ qdrantPointId: null })
        .where(eq(aiSourceChunks.sourceId, ctx.sourceId))
        .catch(() => {});
    }
  }

  const indexed = points.length;
  if (indexed < chunks.length) {
    console.warn(`[source-chunk] ${ctx.sourceId}: only ${indexed}/${chunks.length} chunks indexed`);
  }
  return rows.length;
}

/** Chunk metadata WITHOUT ciphertext — lets the context builder budget without decrypting. */
export async function listChunkMeta(sourceIds) {
  if (!sourceIds?.length) return [];
  return db.select({
    id: aiSourceChunks.id,
    sourceId: aiSourceChunks.sourceId,
    chunkIndex: aiSourceChunks.chunkIndex,
    page: aiSourceChunks.page,
    charLen: aiSourceChunks.charLen,
    // Non-null only when the vector actually reached Qdrant — see storeChunksForSource.
    qdrantPointId: aiSourceChunks.qdrantPointId,
  })
    .from(aiSourceChunks)
    .where(inArray(aiSourceChunks.sourceId, sourceIds))
    .orderBy(aiSourceChunks.sourceId, aiSourceChunks.chunkIndex);
}

export async function loadChunkRows(chunkIds) {
  if (!chunkIds?.length) return [];
  return db.select().from(aiSourceChunks).where(inArray(aiSourceChunks.id, chunkIds));
}

export async function deleteChunksForSource(sourceId) {
  await db.delete(aiSourceChunks).where(eq(aiSourceChunks.sourceId, sourceId));
  await deleteChunkPointsBySource(sourceId);
}

/** Erasure: remove every chunk of a document across ALL projects. Throws — callers record residual. */
export async function deleteChunksForDocument(documentId) {
  await db.delete(aiSourceChunks).where(eq(aiSourceChunks.documentId, documentId));
  await deleteChunkPointsByDocument(documentId);
  await db.update(aiProjectSources)
    .set({ chunkCount: 0, contentText: null })
    .where(eq(aiProjectSources.documentId, documentId));
}
