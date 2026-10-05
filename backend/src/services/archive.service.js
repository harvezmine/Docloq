// Archive/restore document versions + GDPR Art 17 crypto shredding (destroy keys → ciphertext unrecoverable).

import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents, documentVersions, cryptoShredding } from '../db/schema.js';
import { appendAuditEntry } from './audit.service.js';
import uploadConfig from '../config/upload.config.js';
import { s3MoveToArchive, s3RestoreFromArchive, s3Delete } from './s3.service.js';
import { deleteFile } from './storage.service.js';
import { deleteDocumentVector } from './qdrant.service.js';
import { deleteChunksForDocument } from './source-chunk.service.js';

const isS3Provider = uploadConfig.storageProvider === 'minio' || uploadConfig.storageProvider === 'r2';

export const archiveVersion = async (versionId, userId) => {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!version) throw new Error(`Version not found: ${versionId}`);
  if (version.archiveStatus === 'archived') throw new Error('Version is already archived');

  const storageKey = version.s3Key;

  if (isS3Provider) {
    await s3MoveToArchive(storageKey);
  }
  // Local storage: status-only, no physical move.

  await db
    .update(documentVersions)
    .set({
      archiveStatus: 'archived',
      s3Bucket: isS3Provider
        ? uploadConfig.s3.archiveBucket
        : 'local-archive',
    })
    .where(eq(documentVersions.id, versionId));

  await appendAuditEntry({
    organizationId: (await getDocOrgId(version.documentId)),
    userId,
    action: 'archive',
    resourceType: 'document_version',
    resourceId: versionId,
    details: { storageKey, documentId: version.documentId },
  });

  console.log(`[Archive] Version ${versionId} archived`);
  return { success: true, archivedKey: storageKey };
};

export const restoreVersion = async (versionId, userId) => {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!version) throw new Error(`Version not found: ${versionId}`);
  if (version.archiveStatus !== 'archived') throw new Error('Version is not archived');

  if (isS3Provider) {
    await s3RestoreFromArchive(version.s3Key);
  }

  await db
    .update(documentVersions)
    .set({
      archiveStatus: 'active',
      s3Bucket: isS3Provider
        ? uploadConfig.s3.documentsBucket
        : 'local',
    })
    .where(eq(documentVersions.id, versionId));

  await appendAuditEntry({
    organizationId: (await getDocOrgId(version.documentId)),
    userId,
    action: 'restore',
    resourceType: 'document_version',
    resourceId: versionId,
    details: { documentId: version.documentId },
  });

  console.log(`[Archive] Version ${versionId} restored`);
  return { success: true };
};

// GDPR Art 17: destroy all encryption keys for a document so the ciphertext is permanently unreadable.
export const cryptoShred = async (documentId, userId, { deleteCiphertext = true, reason = 'gdpr_request' } = {}) => {
  const versions = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));

  if (versions.length === 0) throw new Error(`No versions found for document: ${documentId}`);

  const orgId = await getDocOrgId(documentId);

  // The wrapped per-version DEKs are the shred primitive: nulling them makes the
  // ciphertext unrecoverable even if the master/Vault KEK still exists.
  //
  // Where the DEK actually lives depends on keyWrapVersion:
  //   v1_vault      → encryptionKeyId holds the wrapped DEK.
  //   v2_hybrid_pqc → encryptionKeyId holds the SENTINEL 'pqc_v2_hybrid' (pqc.service.js:55);
  //                   the wrapped DEK is pqcEnvelope. Nulling encryptionKeyId alone would
  //                   destroy a literal string and leave the document fully decryptable.
  // Both must be nulled or the shred is a no-op for PQC documents.
  const destroyedKeyIds = versions
    .map((v) => (v.keyWrapVersion === 'v2_hybrid_pqc' ? `pqc_envelope:${v.pqcKeypairId}` : v.encryptionKeyId))
    .filter(Boolean);

  // Record as 'pending' up-front so auditors have a durable record.
  const [shredRow] = await db.insert(cryptoShredding).values({
    organizationId: orgId,
    targetType: 'document',
    targetId: documentId,
    kmsKeyIds: destroyedKeyIds,
    status: 'pending',
    reason,
    requestedBy: userId,
    affectedDocuments: 1,
    affectedVersions: versions.length,
  }).returning();

  const residual = []; // non-fatal cleanup failures — data is already shredded once DEKs are gone

  try {
    // Fail-closed: if DEK destruction fails, the whole shred fails.
    // pqcEnvelope is nulled alongside encryptionKeyId — it IS the wrapped DEK for v2 rows,
    // and unwrapHybridDocumentKey refuses without it. pqcKeypairId is deliberately kept:
    // it is org-shared (other documents still need that keypair) and is useful forensics.
    await db
      .update(documentVersions)
      .set({ encryptionKeyId: null, encryptionIv: null, pqcEnvelope: null, archiveStatus: 'deleted' })
      .where(eq(documentVersions.documentId, documentId));

    // Best-effort: embeddings can leak content via inversion.
    try {
      await deleteDocumentVector(documentId);
    } catch (err) {
      residual.push(`qdrant: ${err.message}`);
    }

    // AI-derived chunk ciphertext is already unreadable — its DEK was destroyed above —
    // but the rows and their vectors must still go, by the same inversion argument.
    try {
      await deleteChunksForDocument(documentId);
    } catch (err) {
      residual.push(`chunks: ${err.message}`);
    }

    // Generated Studio outputs restate this document's content but are encrypted under the
    // PROJECT key — which this shred does NOT destroy. Without this they would survive an
    // Art. 17 erasure in fully readable form.
    try {
      const { eraseOutputsForDocument } = await import('./ai-project-output.service.js');
      await eraseOutputsForDocument(documentId, 'Dokumen sumber di-crypto-shred (GDPR Art. 17)');
    } catch (err) {
      residual.push(`outputs: ${err.message}`);
    }

    if (deleteCiphertext) {
      for (const version of versions) {
        try {
          if (isS3Provider) {
            const bucket = version.archiveStatus === 'archived'
              ? uploadConfig.s3.archiveBucket
              : uploadConfig.s3.documentsBucket;
            await s3Delete(bucket, version.s3Key);
          } else {
            await deleteFile(version.s3Key);
          }
        } catch (err) {
          residual.push(`ciphertext ${version.s3Key}: ${err.message}`);
        }
      }
    }

    await db.update(documents).set({ status: 'deleted' }).where(eq(documents.id, documentId));

    // Residual cleanup failures do not undo erasure — the DEKs are already gone.
    await db.update(cryptoShredding)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(cryptoShredding.id, shredRow.id));

    await appendAuditEntry({
      organizationId: orgId,
      userId,
      action: 'delete',
      resourceType: 'document',
      resourceId: documentId,
      details: {
        method: 'crypto_shredding',
        shredId: shredRow.id,
        versionsShredded: versions.length,
        keysDestroyed: destroyedKeyIds.length,
        ciphertextDeleted: deleteCiphertext,
        derivedChunksErased: !residual.some((r) => r.startsWith('chunks:')),
        derivedOutputsErased: !residual.some((r) => r.startsWith('outputs:')),
        residualCleanupIssues: residual,
        gdprArticle: 'Art. 17 Right to Erasure',
      },
    });

    if (residual.length) {
      console.warn(`[CryptoShred] ${documentId}: keys destroyed; residual cleanup issues:`, residual);
    }
    console.log(`[CryptoShred] Document ${documentId}: ${versions.length} version key(s) permanently destroyed`);
    return { success: true, versionsShredded: versions.length, residual };
  } catch (err) {
    // Key destruction failed → record failure, never claim success.
    await db.update(cryptoShredding)
      .set({ status: 'failed' })
      .where(eq(cryptoShredding.id, shredRow.id)).catch(() => {});
    console.error(`[CryptoShred] FAILED for ${documentId}:`, err.message);
    throw new Error(`Crypto-shred failed (keys NOT confirmed destroyed): ${err.message}`);
  }
};

// Intended for a periodic job (e.g. daily cron).
export const archiveOldVersions = async (olderThanDays = 365, systemUserId = 'system') => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const oldVersions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.archiveStatus, 'active'),
        lt(documentVersions.createdAt, cutoffDate),
      ),
    );

  let archivedCount = 0;
  for (const version of oldVersions) {
    try {
      await archiveVersion(version.id, systemUserId);
      archivedCount++;
    } catch (err) {
      console.error(`[Archive] Failed to archive version ${version.id}:`, err.message);
    }
  }

  if (archivedCount > 0) {
    console.log(`[Archive] Archived ${archivedCount} versions older than ${olderThanDays} days`);
  }

  return { archivedCount };
};

const getDocOrgId = async (documentId) => {
  const [doc] = await db
    .select({ organizationId: documents.organizationId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  return doc?.organizationId || null;
};
