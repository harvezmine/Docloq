// Semantic retrieval over the DoKi knowledge base. Indexes kbEntries() into Qdrant once, then
// retrieves the top-K entries for a query. Point IDs are a stable hash of the entry id so
// re-indexing is idempotent (no duplicates when the KB changes).

import crypto from 'crypto';
import { kbEntries } from './chatbot-knowledge.service.js';
import { generateEmbedding, upsertKbPoints, searchKb } from './qdrant.service.js';

const pointId = (id) => {
  // Qdrant needs an unsigned int or UUID point id; derive a UUID from the entry id.
  const h = crypto.createHash('sha256').update(id).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

let indexed = false;

/** Index (or re-index) the whole KB. Cheap: ~30 small embeddings. Safe to call repeatedly. */
export const indexKnowledge = async () => {
  const entries = kbEntries();
  const points = [];
  for (const e of entries) {
    const vector = await generateEmbedding(e.text);
    if (!vector) return false; // embeddings unavailable → skip, caller falls back
    points.push({ id: pointId(e.id), vector, payload: { id: e.id, kind: e.kind, title: e.title, body: e.body } });
  }
  await upsertKbPoints(points);
  indexed = true;
  return true;
};

/** Retrieve the top-K KB entries for a query. Lazily indexes on first call. */
export const retrieveKnowledge = async (query, topK = 4) => {
  try {
    if (!indexed) await indexKnowledge();
    const vector = await generateEmbedding(query);
    if (!vector) return [];
    const hits = await searchKb(vector, topK);
    // Drop weak matches — a cosine below ~0.25 is usually noise for this small KB.
    return hits
      .filter((h) => h.score >= 0.25)
      .map((h) => ({ title: h.payload.title, body: h.payload.body, kind: h.payload.kind, score: h.score }));
  } catch (e) {
    console.warn('[doki] retrieveKnowledge gagal:', e.message);
    return [];
  }
};
