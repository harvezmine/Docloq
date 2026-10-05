import crypto from 'crypto';
import { db } from '../db/index.js';
import {
  aiProjects,
  aiProjectSources,
  aiProjectChats,
  aiProjectNotes,
  aiProjectMembers,
  aiProjectOutputs,
  documents,
  documentVersions,
  folders,
} from '../db/schema.js';
import { and, eq, desc, sql, isNull, or, ne } from 'drizzle-orm';
import { fetchUrl } from './url-ingest.service.js';
import { deletePoint } from './qdrant.service.js';
import { unwrapVersionKey, decryptDocumentKey } from './encryption.service.js';
import { decryptDocument } from './ai-analysis.service.js';
import { extractText } from './upload-pipeline.service.js';
import { detectContentType, extractTextFromPages } from './ocr.service.js';
import { chunkPages } from './chunking.service.js';
import { redactPII } from './pii-redaction.service.js';
import { fetchYouTubeTranscript, parseYouTubeId } from './youtube-ingest.service.js';
import {
  storeChunksForSource,
  deleteChunksForSource,
  resolveSourceKey,
  mintSourceKey,
} from './source-chunk.service.js';

const MAX_SOURCES = parseInt(process.env.AI_PROJECT_MAX_SOURCES || '10', 10);
const MAX_PROJECTS_PER_ORG = parseInt(process.env.AI_PROJECT_MAX_PER_ORG || '20', 10);
const MAX_INSTRUCTION_LEN = 2000;

// Body params never pass through validateUUID (it only guards route params), so anything
// interpolated into a query must be checked here or the driver error leaks the SQL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bad user input. Safe to echo to the client; maps to 400. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'VALIDATION_ERROR';
  }
}

/** Resource absent or not visible to this caller. Maps to 404. */
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.code = 'NOT_FOUND';
  }
}

export class RequiresConsentError extends Error {
  constructor(documentId) {
    super('Dokumen belum di-grant untuk AI access');
    this.code = 'REQUIRES_CONSENT';
    this.documentId = documentId;
  }
}
export class SourceLimitExceededError extends Error {
  constructor(used, max) {
    super(`Batas sumber tercapai (${used}/${max})`);
    this.code = 'SOURCE_LIMIT';
    this.used = used;
    this.max = max;
  }
}
export class ProjectLimitExceededError extends Error {
  constructor(used, max) {
    super(`Batas project tercapai (${used}/${max})`);
    this.code = 'PROJECT_LIMIT';
    this.used = used;
    this.max = max;
  }
}

export async function createProject({ name, description, customInstructions, userId, orgId, icon, color }) {
  if (!name?.trim()) throw new Error('Nama project wajib diisi');
  if (customInstructions && customInstructions.length > MAX_INSTRUCTION_LEN) {
    throw new Error(`Custom instructions maksimal ${MAX_INSTRUCTION_LEN} karakter`);
  }

  const [{ activeCount }] = await db
    .select({ activeCount: sql`count(*)::int` })
    .from(aiProjects)
    .where(and(eq(aiProjects.organizationId, orgId), isNull(aiProjects.archivedAt)));
  if (activeCount >= MAX_PROJECTS_PER_ORG) {
    throw new ProjectLimitExceededError(activeCount, MAX_PROJECTS_PER_ORG);
  }

  const [project] = await db.insert(aiProjects).values({
    organizationId: orgId,
    name: name.trim(),
    description: description?.trim() || null,
    customInstructions: customInstructions?.trim() || null,
    icon: icon || 'sparkles',
    color: color || 'indigo',
    createdBy: userId,
  }).returning();

  return project;
}

/**
 * Projects the user created, plus projects shared with them and accepted.
 *
 * Was org-wide: every member saw every project. That contradicts sharing (nothing to share if
 * everyone already sees it) and would leave users staring at projects requireProject 404s.
 * @param {string} userId required — the list is per-user, not per-org
 */
export async function listProjects(orgId, userId, { archived = false } = {}) {
  const visible = or(
    eq(aiProjects.createdBy, userId),
    sql`EXISTS (SELECT 1 FROM ${aiProjectMembers} m
                WHERE m.project_id = ${aiProjects.id}
                  AND m.user_id = ${userId}
                  AND m.status = 'accepted')`,
  );

  const rows = await db
    .select({
      id: aiProjects.id,
      name: aiProjects.name,
      description: aiProjects.description,
      icon: aiProjects.icon,
      color: aiProjects.color,
      createdAt: aiProjects.createdAt,
      updatedAt: aiProjects.updatedAt,
      archivedAt: aiProjects.archivedAt,
      createdBy: aiProjects.createdBy,
      isOwner: sql`(${aiProjects.createdBy} = ${userId})`,
      sourceCount: sql`(SELECT count(*) FROM ${aiProjectSources} WHERE project_id = ${aiProjects.id} AND status = 'active')::int`,
      messageCount: sql`(SELECT count(*) FROM ${aiProjectChats} WHERE project_id = ${aiProjects.id})::int`,
      outputCount: sql`(SELECT count(*) FROM ${aiProjectOutputs} WHERE project_id = ${aiProjects.id} AND status = 'ready')::int`,
    })
    .from(aiProjects)
    .where(
      archived
        ? and(eq(aiProjects.organizationId, orgId), visible)
        : and(eq(aiProjects.organizationId, orgId), isNull(aiProjects.archivedAt), visible)
    )
    .orderBy(desc(aiProjects.updatedAt));

  return rows;
}

export async function getProject(id, orgId) {
  // Explicit column list, NOT select(): the controller spreads this straight into the HTTP
  // response, and a bare select() would ship ai_projects.content_key — the wrapped project
  // DEK — to the browser. Wrapped key material must never cross the trust boundary.
  const [project] = await db
    .select({
      id: aiProjects.id,
      organizationId: aiProjects.organizationId,
      name: aiProjects.name,
      description: aiProjects.description,
      customInstructions: aiProjects.customInstructions,
      icon: aiProjects.icon,
      color: aiProjects.color,
      createdBy: aiProjects.createdBy,
      archivedAt: aiProjects.archivedAt,
      createdAt: aiProjects.createdAt,
      updatedAt: aiProjects.updatedAt,
    })
    .from(aiProjects)
    .where(and(eq(aiProjects.id, id), eq(aiProjects.organizationId, orgId)));
  if (!project) return null;

  const sources = await listSources(id);
  return { ...project, sources };
}

export async function updateProject(id, orgId, partial) {
  if (partial.customInstructions && partial.customInstructions.length > MAX_INSTRUCTION_LEN) {
    throw new Error(`Custom instructions maksimal ${MAX_INSTRUCTION_LEN} karakter`);
  }
  const allowed = ['name', 'description', 'customInstructions', 'icon', 'color'];
  const update = {};
  for (const k of allowed) if (partial[k] !== undefined) update[k] = partial[k];
  update.updatedAt = new Date();

  const [project] = await db.update(aiProjects)
    .set(update)
    .where(and(eq(aiProjects.id, id), eq(aiProjects.organizationId, orgId)))
    .returning();
  return project;
}

export async function archiveProject(id, orgId) {
  await db.update(aiProjects)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiProjects.id, id), eq(aiProjects.organizationId, orgId)));
}

export async function unarchiveProject(id, orgId) {
  await db.update(aiProjects)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(aiProjects.id, id), eq(aiProjects.organizationId, orgId)));
}

export async function deleteProject(id, orgId) {
  // Delete Qdrant vectors before the cascade drops the rows that point at them — the FK
  // cascade removes ai_source_chunks but Qdrant has no cascade, so the points would be
  // orphaned forever, retaining embeddings (which leak content via inversion) and titles.
  const sources = await db.select().from(aiProjectSources).where(eq(aiProjectSources.projectId, id));
  for (const s of sources) {
    await deleteChunksForSource(s.id).catch((e) =>
      console.warn('[ai-project] chunk cleanup gagal saat delete project:', e.message));
    // Legacy whole-source point from before chunking.
    if (s.qdrantPointId) {
      await deletePoint(s.qdrantPointId).catch(() => {});
    }
  }
  await db.delete(aiProjects).where(and(eq(aiProjects.id, id), eq(aiProjects.organizationId, orgId)));
}

/**
 * Insert a source while enforcing MAX_SOURCES atomically.
 *
 * A plain count-then-insert is a TOCTOU: N concurrent adds all read count < limit and all
 * insert (measured: 16 concurrent adds → 16 sources against a limit of 10). Locking the
 * project row serialises source creation per project — contention only ever exists between
 * concurrent adds to the SAME project, which is exactly the race being closed.
 *
 * Counts 'processing' as well as 'active': an in-flight ingest is a source that is about to
 * exist, so excluding it would let the same race back in through the side door.
 */
async function insertSourceLimited(values) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${aiProjects} WHERE id = ${values.projectId} FOR UPDATE`);
    const [{ c }] = await tx
      .select({ c: sql`count(*)::int` })
      .from(aiProjectSources)
      .where(and(
        eq(aiProjectSources.projectId, values.projectId),
        sql`${aiProjectSources.status} IN ('active', 'processing')`,
      ));
    if (c >= MAX_SOURCES) throw new SourceLimitExceededError(c, MAX_SOURCES);
    const [src] = await tx.insert(aiProjectSources).values(values).returning();
    return src;
  });
}

export async function listSources(projectId) {
  const rows = await db
    .select({
      id: aiProjectSources.id,
      sourceType: aiProjectSources.sourceType,
      documentId: aiProjectSources.documentId,
      sourceUrl: aiProjectSources.sourceUrl,
      title: aiProjectSources.title,
      status: aiProjectSources.status,
      errorMessage: aiProjectSources.errorMessage,
      addedAt: aiProjectSources.addedAt,
      // Document metadata kalau ada
      documentName: documents.originalFilename,
      documentMime: documents.mimeType,
      documentAccessGranted: documents.aiAccessGranted,
    })
    .from(aiProjectSources)
    .leftJoin(documents, eq(aiProjectSources.documentId, documents.id))
    .where(eq(aiProjectSources.projectId, projectId))
    .orderBy(desc(aiProjectSources.addedAt));
  return rows;
}

export class SourceExtractionError extends Error {
  constructor(reason, cause) {
    super(reason);
    this.code = 'SOURCE_EXTRACTION_FAILED';
    this.cause = cause;
  }
}

const MIN_TEXT_LEN = 20;
const MAX_WHITESPACE_RATIO = 0.95;

function looksUsable(text) {
  if (!text || text.trim().length < MIN_TEXT_LEN) return false;
  const whitespaceLen = (text.match(/\s/g) || []).length;
  if (whitespaceLen / text.length > MAX_WHITESPACE_RATIO) return false;
  return true;
}

/**
 * Decrypt a document and extract its text WITH page attribution.
 * PDFs go through extractTextFromPages, which already routes each page to pdfjs text
 * extraction or OCR based on pageDetails — so page numbers come free for text PDFs too,
 * and extractText()'s flat-string contract (shared with the upload pipeline) stays untouched.
 *
 * Returns the version too: the caller must pin chunks to the exact version it decrypted,
 * not re-resolve "latest" later (every version carries its own DEK).
 * @returns {Promise<{pages: Array<{page: number|null, text: string}>, version: object}>}
 */
async function extractDocumentPages(documentId, mimeType) {
  const [version] = await db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber))
    .limit(1);
  if (!version) throw new SourceExtractionError('Versi dokumen tidak ditemukan');

  let plain;
  try {
    plain = await decryptDocument(version);
  } catch (err) {
    console.warn('[ai-project] decrypt gagal:', err.message);
    throw new SourceExtractionError(`Gagal mendekripsi dokumen: ${err.message}`, err);
  }

  let pages;
  if (mimeType === 'application/pdf') {
    try {
      // pageDetails.length is the page count — no separate getPageCount parse.
      const { pageDetails } = await detectContentType(plain, mimeType);
      const extraction = await extractTextFromPages(plain, pageDetails.map((d) => d.page), pageDetails);
      pages = extraction.pages
        .filter((p) => (p.text || '').trim())
        .map((p) => ({ page: p.page, text: p.text }));
      if (extraction.ocrPages.length) {
        console.log(`[ai-project] OCR: ${extraction.ocrPages.length} page(s), avg confidence ${extraction.avgOCRConfidence}%`);
      }
    } catch (err) {
      console.warn('[ai-project] PDF page extraction gagal:', err.message);
      throw new SourceExtractionError(`Gagal mengekstrak PDF: ${err.message}`, err);
    }
  } else {
    let raw;
    try {
      raw = await extractText(plain, mimeType);
    } catch (err) {
      console.warn('[ai-project] extract gagal:', err.message);
      throw new SourceExtractionError(`Gagal mengekstrak teks: ${err.message}`, err);
    }
    // docx/xlsx/txt have no meaningful page structure — one logical page, page null.
    pages = [{ page: null, text: (raw || '').trim() }];
  }

  // Usability is judged on the ORIGINAL text: a page that is nothing but identifiers would
  // look empty after redaction and fail ingest for the wrong reason.
  const joined = pages.map((p) => p.text).join('\n\n').trim();
  if (!looksUsable(joined)) {
    throw new SourceExtractionError(
      'Teks dokumen kosong atau tidak terbaca. Untuk PDF/gambar hasil scan, pastikan kualitas scan cukup jelas; OCR tidak menemukan teks.'
    );
  }

  // Redact BEFORE chunking: chunk text is sent to OpenAI for embeddings, so redacting only
  // the prompt would mean the identifiers were already delivered at ingest.
  const [doc] = await db.select({ mode: documents.aiRedactionMode })
    .from(documents).where(eq(documents.id, documentId));
  if (doc?.mode === 'censored') {
    pages = pages.map((p) => ({ page: p.page, text: redactPII(p.text).redactedText }));
  }

  return { pages, version };
}

// Runs detached — OCR of multi-page scans can take many seconds; row starts 'processing', flips to 'active'/'failed' here.
async function processDocumentIngest(sourceId, documentId, mimeType, projectId, organizationId, title) {
  try {
    const { pages, version } = await extractDocumentPages(documentId, mimeType);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new SourceExtractionError('Tidak ada teks yang bisa di-chunk dari dokumen ini');

    // Encrypt under the DEK of the SAME version we just decrypted, and record which one —
    // re-resolving "latest" at read time would break every chunk after the next edit.
    // Using the document's own DEK is also what makes crypto-shred erase these chunks.
    const plaintextKey = await unwrapVersionKey(version);

    const stored = await storeChunksForSource({
      sourceId,
      documentId,
      projectId,
      organizationId,
      title,
      sourceType: 'document',
      plaintextKey,
    }, chunks);

    const [updated] = await db.update(aiProjectSources)
      .set({
        status: 'active',
        errorMessage: null,
        chunkCount: stored,
        contentText: null,
        contentVersionId: version.id,
      })
      .where(eq(aiProjectSources.id, sourceId))
      .returning();
    return updated;
  } catch (err) {
    await db.update(aiProjectSources)
      .set({ status: 'failed', errorMessage: err.message })
      .where(eq(aiProjectSources.id, sourceId));
    throw err;
  }
}

export async function addDocumentSource(projectId, documentId, userId, orgId) {
  // Body param — see UUID_RE. Without this a malformed id reaches the driver and the raw
  // query is echoed back to the caller.
  if (!UUID_RE.test(String(documentId || ''))) throw new ValidationError('documentId tidak valid');

  // Org-scoped: prevents pulling in (and decrypting) another tenant's document.
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)));
  if (!doc) throw new NotFoundError('Dokumen tidak ditemukan');
  if (!doc.aiAccessGranted) throw new RequiresConsentError(documentId);

  // Dedup
  const [existing] = await db.select().from(aiProjectSources)
    .where(and(eq(aiProjectSources.projectId, projectId), eq(aiProjectSources.documentId, documentId)));
  if (existing) {
    if (existing.status === 'active') return existing;
    if (existing.status === 'processing') return existing;
    // removed/failed → revive: mark processing, re-extract in background
    await db.update(aiProjectSources)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(aiProjectSources.id, existing.id));
    processDocumentIngest(existing.id, documentId, doc.mimeType, projectId, orgId, doc.originalFilename).catch((e) =>
      console.warn('[ai-project] doc ingest (revive) gagal:', e.message));
    return { ...existing, status: 'processing', errorMessage: null };
  }

  // Insert as 'processing' and return immediately; OCR/extract runs in background.
  // Limit enforced inside the insert transaction — see insertSourceLimited.
  const src = await insertSourceLimited({
    projectId,
    sourceType: 'document',
    documentId,
    title: doc.originalFilename,
    contentText: null,
    status: 'processing',
    addedBy: userId,
  });

  processDocumentIngest(src.id, documentId, doc.mimeType, projectId, orgId, doc.originalFilename).catch((e) =>
    console.warn('[ai-project] doc ingest gagal:', e.message));

  return src;
}

export async function retryDocumentSource(projectId, sourceId, orgId) {
  const [src] = await db.select().from(aiProjectSources)
    .where(and(
      eq(aiProjectSources.id, sourceId),
      eq(aiProjectSources.projectId, projectId),
      eq(aiProjectSources.sourceType, 'document'),
    ));
  if (!src) throw new Error('Source tidak ditemukan');
  // Already running — a second ingest would race the first through storeChunksForSource's
  // delete-then-insert and trip the (source_id, chunk_index) unique index, marking a source
  // 'failed' that actually holds good chunks. Mirrors addDocumentSource's guard.
  if (src.status === 'processing') return src;
  // Org-scoped document lookup (see addDocumentSource).
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, src.documentId), eq(documents.organizationId, orgId)));
  if (!doc) throw new Error('Dokumen tidak ditemukan');
  if (!doc.aiAccessGranted) throw new RequiresConsentError(src.documentId);

  await db.update(aiProjectSources)
    .set({ status: 'processing', errorMessage: null })
    .where(eq(aiProjectSources.id, src.id));
  processDocumentIngest(src.id, src.documentId, doc.mimeType, projectId, orgId, doc.originalFilename).catch((e) =>
    console.warn('[ai-project] doc ingest (retry) gagal:', e.message));
  return { ...src, status: 'processing', errorMessage: null };
}

async function processUrlIngest(sourceId, projectId, rawUrl, organizationId) {
  try {
    const { title, text, contentHash, url } = await fetchUrl(rawUrl);
    const chunks = chunkPages([{ page: null, text }]);
    if (!chunks.length) throw new SourceExtractionError('URL tidak menghasilkan teks yang bisa dibaca');

    // No document of its own → mint a DEK and store it wrapped on the source row.
    const { contentKey, plaintextKey } = await mintSourceKey();

    const stored = await storeChunksForSource({
      sourceId,
      documentId: null,
      projectId,
      organizationId,
      title,
      sourceType: 'url',
      plaintextKey,
    }, chunks);

    const [updated] = await db.update(aiProjectSources)
      .set({
        title,
        contentText: null,
        contentHash,
        contentKey,
        chunkCount: stored,
        status: 'active',
        sourceUrl: url,
        errorMessage: null,
      })
      .where(eq(aiProjectSources.id, sourceId))
      .returning();
    return updated;
  } catch (err) {
    await db.update(aiProjectSources)
      .set({ status: 'failed', errorMessage: err.message })
      .where(eq(aiProjectSources.id, sourceId));
    throw err;
  }
}

export async function addUrlSource(projectId, rawUrl, userId, organizationId) {
  // Dedup: URL pernah di-add (status apapun)? Re-use atau retry.
  const [existing] = await db.select().from(aiProjectSources)
    .where(and(eq(aiProjectSources.projectId, projectId), eq(aiProjectSources.sourceUrl, rawUrl)));
  if (existing) {
    if (existing.status === 'active') return existing;
    // Retry existing row: reset + re-fetch (jangan insert baru karena dedup constraint)
    await db.update(aiProjectSources)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(aiProjectSources.id, existing.id));
    return await processUrlIngest(existing.id, projectId, rawUrl, organizationId);
  }

  // Limit enforced inside the insert transaction — see insertSourceLimited.
  const src = await insertSourceLimited({
    projectId,
    sourceType: 'url',
    sourceUrl: rawUrl,
    title: rawUrl,
    status: 'processing',
    addedBy: userId,
  });

  return processUrlIngest(src.id, projectId, rawUrl, organizationId);
}

const MAX_TEXT_SOURCE_CHARS = parseInt(process.env.AI_PROJECT_TEXT_MAX_CHARS || '200000', 10);

/**
 * Add a source from raw text the user supplies — pasted text, or a note promoted to a source.
 * Both are the same thing mechanically: text with no document behind it, so it mints its own
 * DEK (no crypto-shred inheritance to hang off) exactly like a URL source.
 * @param {'text'|'note'} sourceType
 */
export async function addTextSource(projectId, { title, content, sourceType = 'text' }, userId, organizationId) {
  if (!title?.trim()) throw new ValidationError('Judul sumber wajib diisi');
  if (!content?.trim()) throw new ValidationError('Isi sumber wajib diisi');
  if (title.length > 200) throw new ValidationError('Judul maksimal 200 karakter');
  if (content.length > MAX_TEXT_SOURCE_CHARS) {
    throw new ValidationError(`Teks maksimal ${MAX_TEXT_SOURCE_CHARS.toLocaleString('id-ID')} karakter`);
  }
  if (!['text', 'note'].includes(sourceType)) throw new ValidationError('sourceType tidak valid');

  const chunks = chunkPages([{ page: null, text: content }]);
  if (!chunks.length) throw new SourceExtractionError('Teks tidak menghasilkan konten yang bisa dibaca');

  // Limit enforced inside the insert transaction — see insertSourceLimited.
  const src = await insertSourceLimited({
    projectId,
    sourceType,
    title: title.trim(),
    status: 'processing',
    addedBy: userId,
  });

  // Detached, like addDocumentSource. Embedding is one sequential OpenAI call per chunk, so
  // a 200K paste is ~72 calls / ~36s — well past a typical gateway timeout. Holding the
  // request open would make the client give up while the work continued server-side, and a
  // retrying user would silently create duplicates.
  processTextIngest(src.id, { title: title.trim(), content, sourceType, projectId, organizationId }, chunks)
    .catch((e) => console.warn('[ai-project] text ingest gagal:', e.message));

  return src;
}

async function processTextIngest(sourceId, { title, content, sourceType, projectId, organizationId }, chunks) {
  try {
    const { contentKey, plaintextKey } = await mintSourceKey();
    const stored = await storeChunksForSource({
      sourceId,
      documentId: null,
      projectId,
      organizationId,
      title,
      sourceType,
      plaintextKey,
    }, chunks);

    const [updated] = await db.update(aiProjectSources)
      .set({
        status: 'active',
        contentKey,
        chunkCount: stored,
        contentText: null,
        contentHash: crypto.createHash('sha256').update(content).digest('hex'),
        errorMessage: null,
      })
      .where(eq(aiProjectSources.id, sourceId))
      .returning();
    return updated;
  } catch (err) {
    await db.update(aiProjectSources)
      .set({ status: 'failed', errorMessage: err.message })
      .where(eq(aiProjectSources.id, sourceId));
    throw err;
  }
}

/** Promote a note to a citable source. Snapshots the note's text — later note edits do not
    propagate, so the chunks always match what was actually indexed. */
export async function addNoteSource(projectId, noteId, userId, organizationId) {
  // noteId comes from the request body, so validateUUID never sees it — an unparseable value
  // would reach the driver and surface as a raw query error. Reject it here.
  if (!UUID_RE.test(String(noteId || ''))) throw new ValidationError('noteId tidak valid');

  // Project-scoped, and the caller's ownership of the project is already enforced upstream
  // by requireProject — so a note from another org/project cannot be reached.
  const [note] = await db.select().from(aiProjectNotes)
    .where(and(eq(aiProjectNotes.id, noteId), eq(aiProjectNotes.projectId, projectId)));
  if (!note) throw new NotFoundError('Catatan tidak ditemukan');
  return addTextSource(projectId, { title: note.title, content: note.content, sourceType: 'note' }, userId, organizationId);
}

/**
 * Resolve the project's DEK, minting one on first use.
 *
 * Outputs derive from many sources, so there is no document DEK to reuse — this key is the
 * project's own. It deliberately does NOT inherit crypto-shred: erasing outputs when a source
 * is revoked or shredded is explicit code in ai-project-output.service.js.
 * @returns {Promise<Buffer>} plaintext DEK
 */
export async function resolveProjectKey(projectId) {
  const [project] = await db.select().from(aiProjects).where(eq(aiProjects.id, projectId));
  if (!project) throw new NotFoundError('Project tidak ditemukan');
  if (project.contentKey) return decryptDocumentKey(project.contentKey);

  const { contentKey, plaintextKey } = await mintSourceKey();
  // Claim the slot only if still empty — two concurrent first-generations would otherwise mint
  // different keys, and whichever lost would have written outputs nothing can decrypt.
  const [claimed] = await db.update(aiProjects)
    .set({ contentKey })
    .where(and(eq(aiProjects.id, projectId), isNull(aiProjects.contentKey)))
    .returning();
  if (claimed) return plaintextKey;

  // Lost the race — use the winner's key.
  const [fresh] = await db.select().from(aiProjects).where(eq(aiProjects.id, projectId));
  return decryptDocumentKey(fresh.contentKey);
}

async function processYouTubeIngest(sourceId, projectId, url, organizationId) {
  try {
    const { text, title } = await fetchYouTubeTranscript(url);
    const chunks = chunkPages([{ page: null, text }]);
    if (!chunks.length) throw new SourceExtractionError('Transkrip tidak menghasilkan teks');

    const { contentKey, plaintextKey } = await mintSourceKey();
    const stored = await storeChunksForSource({
      sourceId,
      documentId: null,
      projectId,
      organizationId,
      title,
      sourceType: 'youtube',
      plaintextKey,
    }, chunks);

    const [updated] = await db.update(aiProjectSources)
      .set({
        title,
        contentKey,
        chunkCount: stored,
        contentText: null,
        contentHash: crypto.createHash('sha256').update(text).digest('hex'),
        status: 'active',
        errorMessage: null,
      })
      .where(eq(aiProjectSources.id, sourceId))
      .returning();
    return updated;
  } catch (err) {
    await db.update(aiProjectSources)
      .set({ status: 'failed', errorMessage: err.message })
      .where(eq(aiProjectSources.id, sourceId));
    throw err;
  }
}

export async function addYouTubeSource(projectId, url, userId, organizationId) {
  if (!parseYouTubeId(url)) throw new ValidationError('URL YouTube tidak valid');

  const [existing] = await db.select().from(aiProjectSources)
    .where(and(eq(aiProjectSources.projectId, projectId), eq(aiProjectSources.sourceUrl, url)));
  if (existing?.status === 'active') return existing;

  const src = existing || await insertSourceLimited({
    projectId,
    sourceType: 'youtube',
    sourceUrl: url,
    title: url,
    status: 'processing',
    addedBy: userId,
  });

  if (existing) {
    await db.update(aiProjectSources)
      .set({ status: 'processing', errorMessage: null })
      .where(eq(aiProjectSources.id, src.id));
  }

  // Detached: transcript fetch + embedding is slow, same reasoning as text ingest.
  processYouTubeIngest(src.id, projectId, url, organizationId)
    .catch((e) => console.warn('[ai-project] youtube ingest gagal:', e.message));

  return { ...src, status: 'processing', errorMessage: null };
}

/**
 * Attach every AI-granted document in a folder. Partial success is normal and reported —
 * ungranted documents are skipped rather than silently dropped.
 */
export async function addFolderSources(projectId, folderId, userId, orgId) {
  if (!UUID_RE.test(String(folderId || ''))) throw new ValidationError('folderId tidak valid');

  const [folder] = await db.select({ id: folders.id }).from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.organizationId, orgId)));
  if (!folder) throw new NotFoundError('Folder tidak ditemukan');

  const docs = await db.select({
    id: documents.id,
    name: documents.originalFilename,
    granted: documents.aiAccessGranted,
  }).from(documents).where(and(
    eq(documents.folderId, folderId),
    eq(documents.organizationId, orgId),
    ne(documents.status, 'deleted'),
  ));

  const result = { total: docs.length, added: 0, skippedNotGranted: [], failed: [], limitHit: false };
  for (const d of docs) {
    if (!d.granted) { result.skippedNotGranted.push(d.name); continue; }
    try {
      await addDocumentSource(projectId, d.id, userId, orgId);
      result.added += 1;
    } catch (err) {
      if (err.code === 'SOURCE_LIMIT') { result.limitHit = true; break; }
      result.failed.push({ name: d.name, reason: err.message });
    }
  }
  return result;
}

export async function removeSource(projectId, sourceId) {
  const [src] = await db.select().from(aiProjectSources)
    .where(and(eq(aiProjectSources.id, sourceId), eq(aiProjectSources.projectId, projectId)));
  if (!src) return { ok: false, reason: 'not_found' };

  await deleteChunksForSource(sourceId).catch((e) =>
    console.warn('[ai-project] chunk cleanup gagal:', e.message));

  // Generated outputs restate this source's content. They live under the PROJECT key, so
  // nothing about deleting the source makes them unreadable — erase them explicitly.
  // Dynamic import breaks the cycle: ai-project-output imports resolveProjectKey from here.
  const { eraseOutputsForSource } = await import('./ai-project-output.service.js');
  await eraseOutputsForSource(sourceId, 'Sumber dihapus dari project').catch((e) =>
    console.warn('[ai-project] output erase gagal:', e.message));

  // Legacy whole-source point from before chunking.
  if (src.qdrantPointId) {
    await deletePoint(src.qdrantPointId).catch(() => {});
  }
  await db.delete(aiProjectSources).where(eq(aiProjectSources.id, sourceId));
  return { ok: true };
}

export async function retryUrlSource(projectId, sourceId, organizationId) {
  const [src] = await db.select().from(aiProjectSources)
    .where(and(eq(aiProjectSources.id, sourceId), eq(aiProjectSources.projectId, projectId), eq(aiProjectSources.sourceType, 'url')));
  if (!src) throw new Error('Source tidak ditemukan');
  await db.update(aiProjectSources).set({ status: 'processing', errorMessage: null }).where(eq(aiProjectSources.id, src.id));
  return addUrlSource(projectId, src.sourceUrl, src.addedBy, organizationId);
}

// One-time migration: turn legacy sources into encrypted chunks.
// Prefers the existing content_text so a 500-page scan is not re-OCR'd, and NULLs it
// afterwards so the plaintext stops sitting in Postgres. Sources chunked from the flat
// cache have no page numbers — re-adding the source re-extracts with pages.
export async function backfillDocumentSources() {
  const rows = await db.select({
    id: aiProjectSources.id,
    projectId: aiProjectSources.projectId,
    sourceType: aiProjectSources.sourceType,
    documentId: aiProjectSources.documentId,
    title: aiProjectSources.title,
    contentText: aiProjectSources.contentText,
    contentKey: aiProjectSources.contentKey,
    chunkCount: aiProjectSources.chunkCount,
    mimeType: documents.mimeType,
    redactionMode: documents.aiRedactionMode,
    organizationId: aiProjects.organizationId,
  })
    .from(aiProjectSources)
    .innerJoin(aiProjects, eq(aiProjectSources.projectId, aiProjects.id))
    .leftJoin(documents, eq(aiProjectSources.documentId, documents.id))
    .where(eq(aiProjectSources.status, 'active'));

  const results = { total: rows.length, chunked: 0, reextracted: 0, failed: 0, skipped: 0, shredded: 0 };

  for (const row of rows) {
    if (row.chunkCount > 0) { results.skipped++; continue; }
    try {
      let pages;
      let versionId = null;
      if (row.contentText && row.contentText.trim()) {
        // Cheap path — no re-OCR. Legacy content_text is unredacted, so honour a censored doc
        // here too (defence-in-depth: today all content_text rows are 'full', but don't rely on it).
        const cheap = row.redactionMode === 'censored' ? redactPII(row.contentText).redactedText : row.contentText;
        pages = [{ page: null, text: cheap }];
      } else if (row.sourceType === 'document' && row.documentId) {
        const extracted = await extractDocumentPages(row.documentId, row.mimeType);
        pages = extracted.pages;
        versionId = extracted.version.id;
        results.reextracted++;
      } else {
        results.skipped++;
        continue;
      }

      const chunks = chunkPages(pages);
      if (!chunks.length) throw new SourceExtractionError('Backfill: tidak ada teks');

      let plaintextKey;
      let contentKey = row.contentKey;
      if (row.sourceType === 'document') {
        // Cheap path has no version of its own — pin whichever version's DEK we encrypt with.
        if (!versionId) {
          const [latest] = await db.select({ id: documentVersions.id })
            .from(documentVersions)
            .where(eq(documentVersions.documentId, row.documentId))
            .orderBy(desc(documentVersions.versionNumber))
            .limit(1);
          versionId = latest?.id || null;
        }
        plaintextKey = await resolveSourceKey({ ...row, contentVersionId: versionId });
      } else {
        const minted = await mintSourceKey();
        plaintextKey = minted.plaintextKey;
        contentKey = minted.contentKey;
      }

      const stored = await storeChunksForSource({
        sourceId: row.id,
        documentId: row.documentId,
        projectId: row.projectId,
        organizationId: row.organizationId,
        title: row.title,
        sourceType: row.sourceType,
        plaintextKey,
      }, chunks);

      await db.update(aiProjectSources)
        .set({
          chunkCount: stored,
          contentKey,
          contentVersionId: versionId,
          contentText: null,
          errorMessage: null,
        })
        .where(eq(aiProjectSources.id, row.id));
      results.chunked++;
    } catch (err) {
      console.warn('[backfill]', row.id, err.message);
      // The key is gone (crypto-shredded), so content_text can never be re-derived OR
      // re-encrypted — it is unrecoverable plaintext of a document the user asked us to
      // forget. Leaving it as 'failed' would strand it in Postgres indefinitely, which is
      // exactly what this migration exists to prevent.
      const keyGone = err?.code === 'SOURCE_KEY_UNAVAILABLE';
      await db.update(aiProjectSources)
        .set(keyGone
          ? { status: 'revoked', contentText: null, chunkCount: 0, errorMessage: 'Kunci dokumen sudah dihancurkan (crypto-shred)' }
          : { status: 'failed', errorMessage: err.message })
        .where(eq(aiProjectSources.id, row.id));
      if (keyGone) results.shredded++; else results.failed++;
    }
  }
  return results;
}

// Org-wide AI usage analytics: tokens from chat metadata JSONB, source counts by type.
export async function getOrgUsage(orgId, rangeDays = 30) {
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const dailyRows = await db.execute(sql`
    SELECT
      DATE(${aiProjectChats.createdAt}) AS day,
      COALESCE(SUM((${aiProjectChats.metadata} ->> 'promptTokens')::int), 0) AS prompt_tokens,
      COALESCE(SUM((${aiProjectChats.metadata} ->> 'completionTokens')::int), 0) AS completion_tokens,
      COUNT(*) FILTER (WHERE ${aiProjectChats.role} = 'assistant') AS responses
    FROM ${aiProjectChats}
    INNER JOIN ${aiProjects} ON ${aiProjects.id} = ${aiProjectChats.projectId}
    WHERE ${aiProjects.organizationId} = ${orgId}
      AND ${aiProjectChats.createdAt} >= ${since}
    GROUP BY DATE(${aiProjectChats.createdAt})
    ORDER BY day ASC
  `);

  const daily = (dailyRows.rows || dailyRows).map((r) => ({
    date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
    promptTokens: parseInt(r.prompt_tokens, 10) || 0,
    completionTokens: parseInt(r.completion_tokens, 10) || 0,
    totalTokens: (parseInt(r.prompt_tokens, 10) || 0) + (parseInt(r.completion_tokens, 10) || 0),
    responses: parseInt(r.responses, 10) || 0,
  }));

  const totals = daily.reduce((acc, d) => {
    acc.promptTokens += d.promptTokens;
    acc.completionTokens += d.completionTokens;
    acc.totalTokens += d.totalTokens;
    acc.responses += d.responses;
    return acc;
  }, { promptTokens: 0, completionTokens: 0, totalTokens: 0, responses: 0 });

  const sourceRows = await db.execute(sql`
    SELECT
      ${aiProjectSources.sourceType} AS source_type,
      COUNT(*)::int AS count
    FROM ${aiProjectSources}
    INNER JOIN ${aiProjects} ON ${aiProjects.id} = ${aiProjectSources.projectId}
    WHERE ${aiProjects.organizationId} = ${orgId}
      AND ${aiProjectSources.status} = 'active'
    GROUP BY ${aiProjectSources.sourceType}
  `);

  const bySourceType = (sourceRows.rows || sourceRows).map((r) => ({
    type: r.source_type,
    count: parseInt(r.count, 10) || 0,
  }));

  const [{ projectCount }] = await db
    .select({ projectCount: sql`count(*)::int` })
    .from(aiProjects)
    .where(and(eq(aiProjects.organizationId, orgId), isNull(aiProjects.archivedAt)));

  return {
    rangeDays,
    since: since.toISOString(),
    totals,
    daily,
    bySourceType,
    projectCount,
  };
}

export const LIMITS = {
  MAX_SOURCES,
  MAX_PROJECTS_PER_ORG,
  MAX_INSTRUCTION_LEN,
  MAX_TEXT_SOURCE_CHARS,
};
