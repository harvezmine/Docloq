// Provenance receipt for one AI answer. Rides the existing per-org audit hash chain, so
// tamper-evidence is already solved — this only builds the payload and indexes the entry.
//
// Proves: this answer came from these exact source contents, at this time, with this model,
// and the record has not been altered since. Does NOT prove the answer is correct.
//
// Stores hashes only. Source content must never reach this module's output.

import crypto from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  aiProvenance, aiProjectSources, documentVersions, documents,
} from '../db/schema.js';
import { appendAuditEntry, verifyChainForOrg } from './audit.service.js';

const sha256 = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest('hex');

/**
 * Fingerprint sources by content hash — never content.
 * document → document_versions.sha256_hash (hashed before encryption) of the pinned version.
 * url/text/note → ai_project_sources.content_hash.
 */
export async function buildFingerprints(sourceIds) {
  if (!sourceIds?.length) return { fingerprints: [], redactionModes: {} };

  const rows = await db.select({
    id: aiProjectSources.id,
    sourceType: aiProjectSources.sourceType,
    title: aiProjectSources.title,
    contentHash: aiProjectSources.contentHash,
    documentId: aiProjectSources.documentId,
    versionHash: documentVersions.sha256Hash,
    redactionMode: documents.aiRedactionMode,
  })
    .from(aiProjectSources)
    .leftJoin(documentVersions, eq(aiProjectSources.contentVersionId, documentVersions.id))
    .leftJoin(documents, eq(aiProjectSources.documentId, documents.id))
    .where(inArray(aiProjectSources.id, sourceIds));

  const fingerprints = rows.map((r) => ({
    sourceId: r.id,
    title: r.title,
    kind: r.sourceType,
    fingerprint: r.sourceType === 'document' ? (r.versionHash || null) : (r.contentHash || null),
  }));

  const redactionModes = {};
  for (const r of rows) {
    if (r.documentId && r.redactionMode) redactionModes[r.documentId] = r.redactionMode;
  }

  return { fingerprints, redactionModes };
}

/** Build + persist a receipt. entryHash is the user-facing receipt id. */
export async function recordProvenance({
  organizationId, projectId, userId, subjectType, subjectId,
  answerText, promptText, snippets, model,
}) {
  const sourceIds = [...new Set((snippets || []).map((s) => s.sourceId))];
  const { fingerprints, redactionModes } = await buildFingerprints(sourceIds);

  const answerHash = sha256(answerText);
  const promptHash = sha256(promptText);

  const entry = await appendAuditEntry({
    organizationId,
    userId,
    action: 'create',
    resourceType: 'ai_answer',
    resourceId: subjectId,
    details: {
      kind: 'ai_provenance',
      subjectType,
      projectId,
      answerHash,
      promptHash,
      model,
      sourceFingerprints: fingerprints,
      redactionModes,
    },
  });

  const [row] = await db.insert(aiProvenance).values({
    organizationId,
    projectId,
    subjectType,
    subjectId,
    answerHash,
    promptHash,
    sourceFingerprints: fingerprints,
    model,
    redactionModes,
    auditLogId: entry.id,
    entryHash: entry.entryHash,
  }).returning();

  return row;
}

/**
 * Re-verify a receipt: does the stored answer still hash to what was signed, are the sources
 * unchanged, and is the org's chain intact?
 */
export async function verifyProvenance(organizationId, subjectType, subjectId, currentAnswerText) {
  const [rec] = await db.select().from(aiProvenance).where(and(
    eq(aiProvenance.subjectType, subjectType),
    eq(aiProvenance.subjectId, subjectId),
    eq(aiProvenance.organizationId, organizationId),
  ));
  if (!rec) return { found: false };

  const answerMatches = sha256(currentAnswerText) === rec.answerHash;

  // Re-fingerprint as the sources are NOW — a changed hash means the answer no longer
  // reflects the material it cited.
  const stored = rec.sourceFingerprints || [];
  const { fingerprints: now } = await buildFingerprints(stored.map((f) => f.sourceId));
  const byId = Object.fromEntries(now.map((f) => [f.sourceId, f.fingerprint]));

  const sources = stored.map((f) => ({
    sourceId: f.sourceId,
    title: f.title,
    kind: f.kind,
    missing: !(f.sourceId in byId),
    unchanged: f.sourceId in byId && byId[f.sourceId] === f.fingerprint,
  }));

  const chain = await verifyChainForOrg(organizationId);

  return {
    found: true,
    receiptId: rec.entryHash,
    answerMatches,
    chainIntact: chain.intact,
    sourcesUnchanged: sources.every((s) => s.unchanged),
    sources,
    model: rec.model,
    redactionModes: rec.redactionModes,
    generatedAt: rec.createdAt,
  };
}

