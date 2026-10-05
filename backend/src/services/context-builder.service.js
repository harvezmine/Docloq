// Builds the LLM context for AI Project chat: size is measured from char_len without
// decrypting, then either every chunk goes in (stuff) or the top-K by embedding do (retrieve).

import { and, eq, inArray, or, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiProjectSources, aiProjects, documents } from '../db/schema.js';
import {
  listChunkMeta as svcListChunkMeta,
  loadChunkRows as svcLoadChunkRows,
  resolveSourceKey as svcResolveSourceKey,
  decryptChunkText as svcDecryptChunkText,
  SourceKeyUnavailableError,
} from './source-chunk.service.js';
import { searchChunks as svcSearchChunks } from './qdrant.service.js';
import { detectPromptInjection } from './chatbot.service.js';

export const STUFF_BUDGET_CHARS = parseInt(process.env.AI_PROJECT_STUFF_BUDGET_CHARS || '120000', 10);
export const TOP_K = parseInt(process.env.AI_PROJECT_TOP_K || '12', 10);

/** Active sources whose document (if any) is still AI-granted and not deleted. */
async function listEligibleSources(projectId, sourceIds, organizationId) {
  const filters = [
    eq(aiProjectSources.projectId, projectId),
    // In stuff mode the org-filtered searchChunks never runs, so this is the only tenancy check.
    eq(aiProjects.organizationId, organizationId),
    eq(aiProjectSources.status, 'active'),
    // Read-time consent recheck: a revoked document must stop answering even if cleanup failed.
    or(
      ne(aiProjectSources.sourceType, 'document'),
      and(eq(documents.aiAccessGranted, true), ne(documents.status, 'deleted')),
    ),
  ];
  if (sourceIds?.length) filters.push(inArray(aiProjectSources.id, sourceIds));

  return db.select({
    id: aiProjectSources.id,
    sourceType: aiProjectSources.sourceType,
    documentId: aiProjectSources.documentId,
    title: aiProjectSources.title,
    sourceUrl: aiProjectSources.sourceUrl,
    contentKey: aiProjectSources.contentKey,
    contentVersionId: aiProjectSources.contentVersionId,
  })
    .from(aiProjectSources)
    .innerJoin(aiProjects, eq(aiProjectSources.projectId, aiProjects.id))
    .leftJoin(documents, eq(aiProjectSources.documentId, documents.id))
    .where(and(...filters))
    .orderBy(aiProjectSources.addedAt);
}

// Swappable for unit tests — same pattern as ai-project.controller's _projectResolver.
export const _deps = {
  listEligibleSources,
  listChunkMeta: svcListChunkMeta,
  loadChunkRows: svcLoadChunkRows,
  resolveSourceKey: svcResolveSourceKey,
  decryptChunkText: svcDecryptChunkText,
  searchChunks: svcSearchChunks,
};

// Injection-looking lines are prefixed rather than dropped, so the model still reads them as data.
function sanitizeChunkText(text) {
  if (!text) return '';
  return text
    .split(/\n/)
    .map((line) => (detectPromptInjection(line)
      ? `[REDACTED—potential instruction]: ${line.replace(/[<>]/g, '')}`
      : line.replace(/<\/?source[^>]*>/gi, ''))) // strip forged source tags
    .join('\n');
}

/**
 * @param {{projectId: string, organizationId: string, query: string, sourceIds?: string[]}} args
 * @returns {Promise<{snippets: Array, mode: 'stuff'|'retrieve', skipped: Array, totalChars: number}>}
 */
export async function buildContext({ projectId, organizationId, query, sourceIds }) {
  const empty = { snippets: [], mode: 'stuff', skipped: [], totalChars: 0, indexedChunks: 0, totalChunks: 0 };

  // An explicit [] means no sources; the query builder would treat it as falsy and match all.
  if (sourceIds && sourceIds.length === 0) return empty;

  const sources = await _deps.listEligibleSources(projectId, sourceIds, organizationId);
  if (!sources.length) return empty;

  const sourceById = new Map(sources.map((s, i) => [s.id, { ...s, sourceNumber: i + 1 }]));
  const allMeta = await _deps.listChunkMeta(sources.map((s) => s.id));
  if (!allMeta.length) return empty;

  const totalChars = allMeta.reduce((sum, m) => sum + (m.charLen || 0), 0);
  const indexedChunks = allMeta.filter((m) => m.qdrantPointId).length;

  let selected;
  let mode;
  if (totalChars <= STUFF_BUDGET_CHARS) {
    mode = 'stuff';
    selected = allMeta;
  } else {
    // Over budget, retrieval is the only path — callers read indexedChunks to tell
    // "nothing relevant" from "nothing indexed".
    mode = 'retrieve';
    const hits = await _deps.searchChunks(query, organizationId, sources.map((s) => s.id), TOP_K);
    const hitIds = new Set(hits.map((h) => h.payload?.chunkId).filter(Boolean));
    selected = allMeta.filter((m) => hitIds.has(m.id));
  }

  // Stable reading order: by source, then by position within the source — not by relevance.
  selected = [...selected].sort((a, b) => {
    const sa = sourceById.get(a.sourceId)?.sourceNumber ?? 0;
    const sb = sourceById.get(b.sourceId)?.sourceNumber ?? 0;
    return sa - sb || a.chunkIndex - b.chunkIndex;
  });

  const rows = await _deps.loadChunkRows(selected.map((m) => m.id));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // Unwrap once per source, not once per chunk.
  const keyBySource = new Map();
  const skipped = [];
  for (const src of sourceById.values()) {
    try {
      keyBySource.set(src.id, await _deps.resolveSourceKey(src));
    } catch (err) {
      if (err instanceof SourceKeyUnavailableError || err?.code === 'SOURCE_KEY_UNAVAILABLE') {
        skipped.push({ sourceId: src.id, title: src.title, reason: err.message });
        continue;
      }
      throw err;
    }
  }

  const snippets = [];
  for (const m of selected) {
    const key = keyBySource.get(m.sourceId);
    if (!key) continue; // source was skipped above
    const row = rowById.get(m.id);
    if (!row) continue;

    const src = sourceById.get(m.sourceId);
    let text;
    try {
      text = _deps.decryptChunkText(row, key);
    } catch (err) {
      skipped.push({ sourceId: m.sourceId, title: src?.title, reason: `decrypt: ${err.message}` });
      continue;
    }

    snippets.push({
      chunkId: m.id,
      sourceId: m.sourceId,
      sourceNumber: src.sourceNumber,
      sourceType: src.sourceType,
      title: src.title,
      sourceUrl: src.sourceUrl,
      page: m.page ?? null,
      text: sanitizeChunkText(text),
    });
  }

  return { snippets, mode, skipped, totalChars, indexedChunks, totalChunks: allMeta.length };
}
