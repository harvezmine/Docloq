// Anchors a Merkle root of each org's new audit entries to Polygon so a full-table
// rewrite stays detectable. Every N entries or every interval tick; default OFF (gas cost).

import pg from 'pg';
import { eq, and, gt, gte, lte, asc, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, auditChainAnchors, auditChainHead, organizations } from '../db/schema.js';
import { computeAuditRoot, computeAuditProof, anchorAuditRoot, verifyAuditRoot, isReady } from './blockchain.service.js';
import { collectChainBreaks } from './audit.service.js';

const EVERY_N = Math.max(1, parseInt(process.env.AUDIT_ANCHOR_EVERY_N || '256', 10));

// global lock, own connection
const ANCHOR_LOCK = [0x41554449, 0x4c4f434b];

// never touches the pool
export const withAnchorLock = async (fn, busy) => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1, $2) AS ok', ANCHOR_LOCK);
    if (rows[0]?.ok !== true) return busy;
    return await fn();
  } finally {
    // end releases the lock
    await client.end().catch(() => {});
  }
};

/** Highest audit sequence already anchored for an org (0 if none). */
const lastAnchoredSeq = async (orgId) => {
  const [row] = await db
    .select({ toSeq: auditChainAnchors.toSeq })
    .from(auditChainAnchors)
    .where(eq(auditChainAnchors.organizationId, orgId))
    .orderBy(desc(auditChainAnchors.toSeq))
    .limit(1);
  return row?.toSeq || 0;
};

// force=true anchors any pending entries; otherwise only when count >= EVERY_N.
export const anchorOrgPending = async (orgId, { force = false } = {}) =>
  withAnchorLock(async () => {
    const fromSeqExclusive = await lastAnchoredSeq(orgId);
    const entries = await db
      .select({ sequenceNumber: auditLogs.sequenceNumber, entryHash: auditLogs.entryHash })
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), gt(auditLogs.sequenceNumber, fromSeqExclusive)))
      .orderBy(asc(auditLogs.sequenceNumber));

    if (entries.length === 0) return { anchored: false, benign: true, reason: 'no pending entries' };
    if (!force && entries.length < EVERY_N) {
      return { anchored: false, benign: true, reason: `pending ${entries.length} < ${EVERY_N}` };
    }

    const fromSeq = Number(entries[0].sequenceNumber);
    const toSeq = Number(entries[entries.length - 1].sequenceNumber);

    // gaps bake unfixable roots
    const span = toSeq - fromSeq + 1;
    if (entries.length !== span) {
      return {
        anchored: false,
        benign: false,
        reason: `seq ${fromSeq}..${toSeq} has gaps (${entries.length} of ${span} rows present) — refusing to anchor a broken chain`,
      };
    }

    let root;
    try {
      root = computeAuditRoot(entries.map((e) => e.entryHash), { seqs: entries.map((e) => e.sequenceNumber) });
    } catch (err) {
      return { anchored: false, benign: false, reason: err.message };
    }

    const res = await anchorAuditRoot(root, entries.length);
    if (!res.success) return { anchored: false, benign: false, reason: res.message || 'anchor failed' };

    try {
      await db.insert(auditChainAnchors).values({
        organizationId: orgId,
        fromSeq,
        toSeq,
        entryCount: entries.length,
        rootHash: root,
        blockchainTxHash: res.txHash,
        blockNumber: res.blockNumber,
        status: 'confirmed',
      });
    } catch (err) {
      // on-chain but unrecorded
      console.error(`[AuditAnchor] org ${orgId}: anchored on-chain (tx ${res.txHash}, root ${root}) but recording it failed:`, err.message);
      return { anchored: false, benign: false, reason: `anchored on-chain but failed to record locally: ${err.message}`, txHash: res.txHash, rootHash: root, fromSeq, toSeq };
    }

    return { anchored: true, fromSeq, toSeq, count: entries.length, txHash: res.txHash, rootHash: root };
  }, { anchored: false, benign: true, reason: 'anchoring already in progress' });

const sameHash = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

// rebuilds the anchored tree
export const buildProofFromEntries = (entries, anchor, seq, expectedEntryHash = null) => {
  if (!anchor) return { anchored: false, reason: 'entry is not covered by any on-chain anchor yet' };

  const rows = entries || [];
  const fromSeq = Number(anchor.fromSeq);
  const toSeq = Number(anchor.toSeq);
  const entryCount = Number(anchor.entryCount);
  const refuse = (reason) => ({
    anchored: true,
    usable: false,
    anchorId: anchor.id,
    fromSeq: anchor.fromSeq,
    toSeq: anchor.toSeq,
    entryCount: anchor.entryCount,
    foundCount: rows.length,
    reason,
  });

  // legacy anchors may gap
  const span = toSeq - fromSeq + 1;
  if (entryCount !== span) {
    return refuse(`anchor claims ${entryCount} entries over seq ${fromSeq}..${toSeq} (${span} slots) — a sparse anchor cannot be proven against`);
  }
  if (rows.length !== entryCount) {
    return refuse(`anchor covers ${entryCount} entries but ${rows.length} remain in seq ${fromSeq}..${toSeq} — the anchored tree cannot be rebuilt`);
  }
  // must be contiguous
  for (let i = 0; i < rows.length; i++) {
    if (Number(rows[i].sequenceNumber) !== fromSeq + i) {
      return refuse(`seq ${fromSeq + i} was replaced by ${rows[i].sequenceNumber} — the anchored range is no longer contiguous`);
    }
  }

  const leafIndex = Number(seq) - fromSeq;
  if (leafIndex < 0 || leafIndex >= rows.length || Number(rows[leafIndex].sequenceNumber) !== Number(seq)) {
    return refuse(`seq ${seq} is missing from the anchored range ${fromSeq}..${toSeq}`);
  }
  if (expectedEntryHash != null && !sameHash(rows[leafIndex].entryHash, expectedEntryHash)) {
    return refuse(`seq ${seq} changed between reads — refusing to pair a proof with a different row`);
  }

  let built;
  try {
    built = computeAuditProof(
      rows.map((e) => e.entryHash),
      leafIndex,
      { seqs: rows.map((e) => e.sequenceNumber) },
    );
  } catch (err) {
    return refuse(err.message);
  }

  return {
    anchored: true,
    usable: true,
    anchorId: anchor.id,
    fromSeq: anchor.fromSeq,
    toSeq: anchor.toSeq,
    entryCount: anchor.entryCount,
    foundCount: rows.length,
    leafIndex,
    leaf: built.leaf,
    leafHash: built.leafHash,
    proof: built.proof,
    steps: built.steps,
    root: built.root,
    anchoredRoot: anchor.rootHash,
    rootMatch: sameHash(built.root, anchor.rootHash),
    selfVerified: built.verified,
    txHash: anchor.blockchainTxHash,
    blockNumber: anchor.blockNumber,
  };
};

// bucketed once, not quadratic
export const culpritsBySeq = (chainBreaks = []) => {
  const set = new Set();
  for (const b of chainBreaks) if (b.culprit != null) set.add(Number(b.culprit));
  return set;
};

// why this anchor broke
export const diagnoseAnchor = (anchor, rows, chainBreaks = []) => {
  const fromSeq = Number(anchor.fromSeq);
  const toSeq = Number(anchor.toSeq);
  const entryCount = Number(anchor.entryCount);
  const found = rows || [];

  let recomputed = null;
  let error = null;
  try {
    recomputed = computeAuditRoot(found.map((e) => e.entryHash), { seqs: found.map((e) => e.sequenceNumber) });
  } catch (err) {
    error = err.message;
  }

  const rootMatch = error === null && sameHash(recomputed, anchor.rootHash);
  const sparse = entryCount !== toSeq - fromSeq + 1;

  const base = {
    anchorId: anchor.id,
    fromSeq,
    toSeq,
    entryCount,
    foundCount: found.length,
    recomputedRoot: recomputed,
    anchoredRoot: anchor.rootHash,
    rootMatch,
    sparseAnchor: sparse,
    error,
  };

  // slot map unknowable
  if (sparse) {
    return { ...base, rowsMissing: [], rowsAltered: [], noRowToBlame: false, localisable: false };
  }

  const present = new Set(found.map((r) => Number(r.sequenceNumber)));
  const rowsMissing = [];
  for (let s = fromSeq; s <= toSeq; s++) if (!present.has(s)) rowsMissing.push(s);

  const culprits = chainBreaks instanceof Set ? chainBreaks : culpritsBySeq(chainBreaks);
  const rowsAltered = [];
  for (let s = fromSeq; s <= toSeq; s++) if (culprits.has(s) && present.has(s)) rowsAltered.push(s);

  const localisable = rowsMissing.length > 0 || rowsAltered.length > 0;

  return {
    ...base,
    rowsMissing,
    rowsAltered,
    // root moved, nothing localisable
    noRowToBlame: rootMatch === false && error === null && !localisable,
    localisable,
  };
};

export const getAuditEntryMerkleProof = async (orgId, seq, expectedEntryHash = null) => {
  const [anchor] = await db
    .select()
    .from(auditChainAnchors)
    .where(and(
      eq(auditChainAnchors.organizationId, orgId),
      lte(auditChainAnchors.fromSeq, seq),
      gte(auditChainAnchors.toSeq, seq),
    ))
    .orderBy(desc(auditChainAnchors.toSeq))
    .limit(1);

  if (!anchor) return { anchored: false, reason: 'entry is not covered by any on-chain anchor yet' };

  const entries = await db
    .select({ sequenceNumber: auditLogs.sequenceNumber, entryHash: auditLogs.entryHash })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.organizationId, orgId),
      gte(auditLogs.sequenceNumber, anchor.fromSeq),
      lte(auditLogs.sequenceNumber, anchor.toSeq),
    ))
    .orderBy(asc(auditLogs.sequenceNumber));

  const proof = buildProofFromEntries(entries, anchor, seq, expectedEntryHash);
  if (!proof.usable) return proof;

  // DB column is writable
  if (!isReady()) return { ...proof, onChain: null, onChainReason: 'blockchain not enabled' };

  const chain = await verifyAuditRoot(proof.root);
  return { ...proof, onChain: chain.onChain === true, onChainAt: chain.anchoredAt || null, onChainReason: chain.message || null };
};

export const buildBreakReport = async (orgId) => {
  // one snapshot
  const { rows, head, anchors } = await db.transaction(
    async (trx) => {
      const logRows = await trx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId))
        .orderBy(asc(auditLogs.sequenceNumber));
      const [headRow] = await trx
        .select()
        .from(auditChainHead)
        .where(eq(auditChainHead.organizationId, orgId))
        .limit(1);
      const anchorRows = await trx
        .select()
        .from(auditChainAnchors)
        .where(eq(auditChainAnchors.organizationId, orgId))
        .orderBy(asc(auditChainAnchors.fromSeq));
      return { rows: logRows, head: headRow || null, anchors: anchorRows };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );

  const chained = rows.filter((r) => r.sequenceNumber !== null && r.sequenceNumber !== undefined);
  const chain = collectChainBreaks(chained, head);

  const bySeq = new Map(chained.map((r) => [Number(r.sequenceNumber), r]));
  const culprits = culpritsBySeq(chain.breaks);
  const anchorDiagnostics = anchors.map((a) => {
    const inRange = [];
    for (let s = Number(a.fromSeq); s <= Number(a.toSeq); s++) {
      const r = bySeq.get(s);
      if (r) inRange.push({ sequenceNumber: r.sequenceNumber, entryHash: r.entryHash });
    }
    return diagnoseAnchor(a, inRange, culprits);
  });

  const broken = anchorDiagnostics.filter((d) => !d.rootMatch);

  return {
    intact: chain.intact && broken.length === 0,
    count: chain.count,
    breaks: chain.breaks,
    headMatch: chain.headMatch,
    anchorCount: anchors.length,
    anchors: anchorDiagnostics,
    brokenAnchors: broken.length,
    unlocalisable: broken.filter((d) => d.noRowToBlame).map((d) => d.anchorId),
  };
};

/** Cron tick: anchor pending entries across all orgs. */
export const runAuditAnchoring = async ({ force = false, onLog } = {}) => {
  if (!isReady()) {
    onLog?.('blockchain not ready — skipping audit anchoring');
    return { skipped: true };
  }
  const orgs = await db.select({ id: organizations.id }).from(organizations);
  const results = [];
  for (const o of orgs) {
    try {
      const r = await anchorOrgPending(o.id, { force });
      if (r.anchored) {
        onLog?.(`org ${o.id}: anchored seq ${r.fromSeq}..${r.toSeq} (${r.count}) tx ${r.txHash}`);
        results.push({ orgId: o.id, ...r });
      } else if (r.benign === false) {
        onLog?.(`org ${o.id}: ${r.reason}`);
      }
    } catch (err) {
      onLog?.(`org ${o.id} anchor failed: ${err.message}`);
    }
  }
  return { results };
};

// Recompute each anchor's root from the CURRENT rows and check it against the
// on-chain value — any rewrite changes the root, so tampering fails the check.
export const verifyAnchorsForOrg = async (orgId) => {
  const anchors = await db
    .select()
    .from(auditChainAnchors)
    .where(eq(auditChainAnchors.organizationId, orgId))
    .orderBy(asc(auditChainAnchors.fromSeq));

  const checks = [];
  let allIntact = true;

  for (const a of anchors) {
    const entries = await db
      .select({ sequenceNumber: auditLogs.sequenceNumber, entryHash: auditLogs.entryHash })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.organizationId, orgId),
        gte(auditLogs.sequenceNumber, a.fromSeq),
        lte(auditLogs.sequenceNumber, a.toSeq),
      ))
      .orderBy(asc(auditLogs.sequenceNumber));

    // flag and continue
    let recomputed = null;
    let error = null;
    try {
      recomputed = computeAuditRoot(entries.map((e) => e.entryHash), { seqs: entries.map((e) => e.sequenceNumber) });
    } catch (err) {
      error = err.message;
    }

    const localMatch = error === null && recomputed === a.rootHash && entries.length === a.entryCount;
    const chain = error === null ? await verifyAuditRoot(recomputed) : { onChain: false };
    const intact = localMatch && chain.onChain;
    if (!intact) allIntact = false;

    checks.push({
      anchorId: a.id,
      fromSeq: a.fromSeq,
      toSeq: a.toSeq,
      entryCount: a.entryCount,
      foundCount: entries.length,
      localMatch,
      onChain: chain.onChain,
      intact,
      error,
      txHash: a.blockchainTxHash,
      anchoredAt: chain.anchoredAt || null,
    });
  }

  return { intact: allIntact, anchorCount: anchors.length, checks };
};
