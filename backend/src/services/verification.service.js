// SimHash-based fuzzy search + QR image decoding for the verification page.

import jsQR from 'jsqr';
import sharp from 'sharp';
import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents, documentVersions, users, blockchainAnchors } from '../db/schema.js';
import { generateSimHash, normalizeText, hammingDistance, generateSHA256, generateSSDeep, ssdeepCompare } from './hash.service.js';
import { extractText } from './upload-pipeline.service.js';
import { verifyDocument as verifyOnChain, verifyDocumentInBatch, isReady as blockchainReady } from './blockchain.service.js';

export const explorerTxUrl = (network, txHash) => {
  if (!txHash) return null;
  const base = network === 'polygon'
    ? 'https://polygonscan.com'
    : 'https://amoy.polygonscan.com'; // default to Amoy testnet
  return `${base}/tx/${txHash}`;
};

/**
 * Reads the chain (not the DB) for the authoritative verdict — on-chain hash is the
 * source of truth. States: chain_verified, mismatch, db_only (chain unreadable), not_anchored.
 */
export const resolveBlockchainVerdict = async (doc, anchor) => {
  if (!doc) return { state: 'not_anchored', onChainHash: null, anchoredAt: null };
  if (!anchor) return { state: 'not_anchored', onChainHash: null, anchoredAt: null };

  // Cannot read chain (disabled / RPC down) → fall back to "recorded, unconfirmed".
  if (!blockchainReady()) {
    return { state: 'db_only', onChainHash: null, anchoredAt: anchor.anchoredAt || null };
  }

  try {
    // Batch-anchored docs aren't in the single-anchor mapping — verify via Merkle
    // proof against the batch root instead (previously fell through to db_only).
    if (anchor.merkleRoot && anchor.merkleProof) {
      const batch = await verifyDocumentInBatch(doc.contentHash, anchor.merkleProof, anchor.merkleRoot);
      if (batch.verified) {
        return { state: 'chain_verified', onChainHash: doc.contentHash, anchoredAt: batch.anchoredAt || anchor.anchoredAt || null };
      }
      // Proof failed (hash changed) OR root not on-chain yet.
      if (batch.exists === false && !batch.message?.includes('Merkle proof')) {
        return { state: 'db_only', onChainHash: null, anchoredAt: anchor.anchoredAt || null };
      }
      return { state: 'mismatch', onChainHash: null, anchoredAt: anchor.anchoredAt || null };
    }

    const onchain = await verifyOnChain(doc.id, doc.contentHash);
    if (!onchain || onchain.exists === false) {
      // DB has an anchor row but chain has none → treat as unconfirmed, not verified.
      return { state: 'db_only', onChainHash: null, anchoredAt: anchor.anchoredAt || null };
    }
    return {
      state: onchain.hashMatch ? 'chain_verified' : 'mismatch',
      onChainHash: onchain.onChainHash || null,
      anchoredAt: onchain.anchoredAt || anchor.anchoredAt || null,
    };
  } catch (err) {
    console.warn('[Verify] on-chain read failed, falling back to db_only:', err.message);
    return { state: 'db_only', onChainHash: null, anchoredAt: anchor.anchoredAt || null };
  }
};

// SimHash Hamming-distance thresholds: <=6 (~91% similar) = verified, <=14 (~78%) = partial.
const SIMHASH_VERIFIED_MAX_DIST = 6;
const SIMHASH_PARTIAL_MAX_DIST = 14;

export const findByContentHash = async (sha256, orgId = null) => {
  const conds = [eq(documents.contentHash, sha256)];
  if (orgId) conds.push(eq(documents.organizationId, orgId));

  const [doc] = await db
    .select()
    .from(documents)
    .where(conds.length > 1 ? and(...conds) : conds[0])
    .limit(1);

  return doc || null;
};

export const findBySimHash = async (simhashHex, orgId = null, limit = 5, ssdeepHash = '') => {
  if (!simhashHex || simhashHex === '0000000000000000') return [];

  const conds = [sql`${documents.simHash} IS NOT NULL`];
  if (orgId) conds.push(eq(documents.organizationId, orgId));

  const candidates = await db
    .select()
    .from(documents)
    .where(and(...conds));

  const scored = [];
  for (const doc of candidates) {
    if (!doc.simHash) continue;
    const distance = hammingDistance(simhashHex, doc.simHash);
    const similarity = Math.round(((64 - distance) / 64) * 100);
    // Secondary signal: ssdeep fuzzy similarity (0-100), when both hashes available
    const ssdeepSimilarity = (ssdeepHash && doc.ssdeepHash)
      ? ssdeepCompare(ssdeepHash, doc.ssdeepHash)
      : null;
    let status;
    if (distance <= SIMHASH_VERIFIED_MAX_DIST) status = 'verified';
    else if (distance <= SIMHASH_PARTIAL_MAX_DIST) status = 'partial';
    else continue;
    scored.push({ doc, distance, similarity, ssdeepSimilarity, status });
  }

  // Rank by SimHash distance first, break ties with ssdeep similarity
  scored.sort((a, b) => a.distance - b.distance || (b.ssdeepSimilarity ?? 0) - (a.ssdeepSimilarity ?? 0));
  return scored.slice(0, limit);
};

// jsQR often fails dense DocLoq QRs at native size; upscaling (lanczos) fixes it — do NOT
// grayscale/normalize (shifts jsQR's threshold). attemptBoth handles dark-theme renders.
const tryDecodeVariant = async (imageBuffer, targetWidth) => {
  let pipeline = sharp(imageBuffer);
  if (targetWidth) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: false });
  }
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: 'attemptBoth' });
};

export const decodeQrFromBuffer = async (imageBuffer) => {
  let srcWidth = 0;
  try {
    srcWidth = (await sharp(imageBuffer).metadata()).width || 0;
  } catch (err) {
    throw new Error(`Image decode failed: ${err.message}`);
  }

  // Ladder of upscales only (never shrink) — dense QRs need ~6+ px/module.
  const candidates = [null, 600, 900, 1200, 1600].filter((w) => w === null || w > srcWidth);
  let result = null;
  for (const w of candidates) {
    try {
      result = await tryDecodeVariant(imageBuffer, w);
      if (result && result.data) break;
    } catch { /* try next variant */ }
  }
  if (!result || !result.data) {
    return { shortCode: null, payload: null, signature: null, raw: null };
  }

  // Handles both new (URL-only) and legacy (JSON {url,sig,payload}) QR formats, plus bare shortcodes.
  let parsed;
  try {
    parsed = JSON.parse(result.data);
  } catch {
    // Plain string QR — try to read it as the verification URL (?code=…).
    try {
      const u = new URL(result.data);
      const sc = u.searchParams.get('code');
      if (sc) return { shortCode: sc, payload: null, signature: null, raw: result.data };
    } catch { /* not a URL */ }
    return { shortCode: null, payload: null, signature: null, raw: result.data };
  }

  let shortCode = parsed?.payload?.sc || null;
  if (!shortCode && parsed?.url) {
    try {
      const u = new URL(parsed.url);
      shortCode = u.searchParams.get('code');
    } catch { /* ignore */ }
  }

  return {
    shortCode,
    payload: parsed?.payload || null,
    signature: parsed?.sig || null,
    raw: result.data,
  };
};

export const computeUploadDNA = async (fileBuffer, mimeType) => {
  const sha256 = generateSHA256(fileBuffer); // raw-bytes hash — audit record of what was uploaded
  let text = '';
  try {
    text = (await extractText(fileBuffer, mimeType)) || '';
  } catch {
    text = '';
  }
  const normalized = normalizeText(text);
  const simhash = normalized ? generateSimHash(normalized) : '0000000000000000';
  const ssdeep = normalized ? generateSSDeep(normalized) : '';
  // Exact-match hash MUST mirror upload's generateDocumentDNA basis (normalized text, or
  // base64 of the raw bytes when no text is extractable) — NOT the raw-bytes sha256, which
  // never equals the stored contentHash and left the exact-match path permanently dead.
  const contentDnaHash = generateSHA256(normalized || fileBuffer.toString('base64'));
  return { sha256, contentDnaHash, simhash, ssdeep, hasText: !!normalized };
};

export const enrichDocument = async (doc) => {
  if (!doc) return null;

  let uploader = null;
  if (doc.ownerId) {
    const [u] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, doc.ownerId))
      .limit(1);
    if (u) {
      uploader = {
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
      };
    }
  }

  let anchor = null;
  const [a] = await db
    .select()
    .from(blockchainAnchors)
    .where(eq(blockchainAnchors.documentId, doc.id))
    .orderBy(desc(blockchainAnchors.createdAt))
    .limit(1);
  if (a) {
    anchor = {
      id: a.id,
      network: a.blockchainNetwork,
      txHash: a.transactionHash,
      explorerUrl: explorerTxUrl(a.blockchainNetwork, a.transactionHash),
      blockNumber: a.blockNumber,
      anchoredHash: a.anchoredHash,
      status: a.status,
      confirmations: a.confirmations,
      anchoredAt: a.blockTimestamp || a.confirmedAt || a.createdAt,
      // Needed to verify batch-anchored docs by Merkle proof (resolveBlockchainVerdict).
      merkleRoot: a.merkleRoot || null,
      merkleProof: a.merkleProof || null,
    };
  }

  return {
    id: doc.id,
    filename: doc.originalFilename || doc.filename,
    mimeType: doc.mimeType,
    status: doc.status,
    contentHash: doc.contentHash,
    simHash: doc.simHash,
    createdAt: doc.createdAt,
    uploader,
    blockchainAnchor: anchor,
  };
};

// Thresholds aligned with findBySimHash's Hamming bands (single source of truth):
//   dist <= 6  → similarity >= 91  → verified_fuzzy
//   dist <= 14 → similarity >= 78  → partial
// (Previously verified_fuzzy required >=95, contradicting the <=6 "verified" band and
//  demoting genuine 91-94% matches to "partial".)
export function decideFileVerdict({ exactMatch, similarity }) {
  if (exactMatch) return { status: 'verified_exact', label: 'Verified (exact original)' };
  if (similarity >= 91) return { status: 'verified_fuzzy', label: 'Verified (registered document)' };
  if (similarity >= 78) return { status: 'partial', label: 'Partial match (possibly modified)' };
  return { status: 'not_found', label: 'No matching document' };
}
