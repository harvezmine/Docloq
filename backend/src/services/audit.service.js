
import crypto from 'crypto';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, auditChainHead } from '../db/schema.js';

export const GENESIS_HASH = '0'.repeat(64);

export const ADMIN_ACTOR = 'superadmin_gate';

export const stableStringify = (value) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
};

export const sha256Hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

// match postgres round-trip
const jsonbNorm = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
const uuidNorm = (v) => (typeof v === 'string' ? v.toLowerCase() : v ?? null);

export const canonicalAuditFields = (e) => ({
  seq: e.sequenceNumber ?? null,
  organizationId: uuidNorm(e.organizationId),
  userId: uuidNorm(e.userId),
  action: e.action ?? null,
  resourceType: e.resourceType ?? null,
  resourceId: uuidNorm(e.resourceId),
  details: jsonbNorm(e.details),
  previousState: jsonbNorm(e.previousState),
  newState: jsonbNorm(e.newState),
  ipAddress: e.ipAddress ?? null,
  userAgent: e.userAgent ?? null,
  createdAt: e.createdAt != null ? new Date(e.createdAt).toISOString() : null,
});

export const canonicalAuditEntry = (e) => stableStringify(canonicalAuditFields(e));

export const computeEntryHash = (entry, prevHash) =>
  sha256Hex(canonicalAuditEntry(entry) + prevHash);

export const PROOF_PUBLIC_FIELDS = new Set(['seq', 'organizationId', 'action', 'resourceType', 'createdAt']);

export const buildEntryProof = (entry, expectedPrevHash) => {
  const values = canonicalAuditFields(entry);
  const canonical = canonicalAuditEntry(entry);
  const storedPrevHash = entry.prevHash ?? null;
  const recomputedHash = computeEntryHash(entry, storedPrevHash ?? GENESIS_HASH);
  const prevLinkOk = expectedPrevHash === null || expectedPrevHash === undefined
    ? storedPrevHash === GENESIS_HASH
    : storedPrevHash === expectedPrevHash;

  return {
    seq: entry.sequenceNumber ?? null,
    isGenesis: storedPrevHash === GENESIS_HASH,
    prevHash: storedPrevHash,
    expectedPrevHash: expectedPrevHash ?? GENESIS_HASH,
    prevLinkOk,
    entryHash: entry.entryHash ?? null,
    recomputedHash,
    hashOk: recomputedHash === entry.entryHash,
    canonicalSha256: sha256Hex(canonical),
    canonicalLength: canonical.length,
    fields: Object.entries(values).map(([key, value]) => ({
      key,
      present: value !== null,
      digest: sha256Hex(stableStringify(value)),
      value: PROOF_PUBLIC_FIELDS.has(key) ? value : null,
      redacted: !PROOF_PUBLIC_FIELDS.has(key),
    })),
  };
};

export const appendAuditEntry = async (entry, { tx } = {}) => {
  const run = async (trx) => {
    const orgId = entry.organizationId;

    if (!orgId) {
      const [row] = await trx
        .insert(auditLogs)
        .values({ ...entry, createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date() })
        .returning();
      return row;
    }

    await trx.insert(auditChainHead).values({ organizationId: orgId }).onConflictDoNothing();
    const [head] = await trx
      .select()
      .from(auditChainHead)
      .where(eq(auditChainHead.organizationId, orgId))
      .for('update');

    if (!head) throw new Error(`audit_chain_head row missing for organization ${orgId}`);

    const seq = (head.lastSeq || 0) + 1;
    const prevHash = head.lastHash || GENESIS_HASH;
    const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();

    const entryHash = computeEntryHash({ ...entry, sequenceNumber: seq, createdAt }, prevHash);

    const [row] = await trx
      .insert(auditLogs)
      .values({ ...entry, createdAt, sequenceNumber: seq, prevHash, entryHash })
      .returning();

    await trx
      .update(auditChainHead)
      .set({ lastSeq: seq, lastHash: entryHash, updatedAt: new Date() })
      .where(eq(auditChainHead.organizationId, orgId));

    return row;
  };

  return tx ? run(tx) : db.transaction(run);
};

// pg bigint may stringify
const toSeq = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// detects tail truncation
export const checkChainHead = (entries, head) => {
  const tail = entries?.length ? entries[entries.length - 1] : null;
  const actualSeq = tail ? toSeq(tail.sequenceNumber) : 0;
  const actualHash = tail ? (tail.entryHash || GENESIS_HASH) : GENESIS_HASH;

  // chained rows imply head
  if (!head) {
    if (!tail) return { checked: false, ok: true };
    return {
      checked: true,
      ok: false,
      headMissing: true,
      expectedSeq: null,
      expectedHash: null,
      actualSeq,
      actualHash,
      missingTail: 0,
    };
  }

  const expectedSeq = toSeq(head.lastSeq);
  const expectedHash = head.lastHash || GENESIS_HASH;

  return {
    checked: true,
    ok: actualSeq === expectedSeq && actualHash === expectedHash,
    headMissing: false,
    expectedSeq,
    actualSeq,
    expectedHash,
    actualHash,
    missingTail: Math.max(0, expectedSeq - actualSeq),
  };
};

const headMismatchReason = (h, count) => {
  if (h.headMissing) {
    return `audit_chain_head row is missing while ${count} chained ${count === 1 ? 'row exists' : 'rows exist'} — the head was deleted`;
  }
  if (h.actualSeq < h.expectedSeq) {
    const n = h.missingTail;
    return `chain tail truncated: head records seq ${h.expectedSeq} but the newest surviving row is seq ${h.actualSeq} (${n} newest ${n === 1 ? 'entry' : 'entries'} deleted)`;
  }
  if (h.actualSeq > h.expectedSeq) {
    return `chain head is behind the log: head records seq ${h.expectedSeq} but rows exist up to seq ${h.actualSeq} (head rolled back, or rows inserted outside appendAuditEntry)`;
  }
  return `chain head hash mismatch at seq ${h.actualSeq}: the newest row's entryHash does not match audit_chain_head (last row rewritten)`;
};

// null means head deleted
export const verifyChain = (entries, head) => {
  const headMatch = head === undefined ? { checked: false, ok: true } : checkChainHead(entries, head);
  let prevHash = GENESIS_HASH;
  let expectedSeq = null;

  for (const e of entries) {
    if (expectedSeq === null) expectedSeq = toSeq(e.sequenceNumber);
    else expectedSeq += 1;

    if (toSeq(e.sequenceNumber) !== expectedSeq) {
      return { intact: false, count: entries.length, brokenAtSeq: e.sequenceNumber,
        reason: `sequence gap/reorder: expected ${expectedSeq}, got ${e.sequenceNumber}`, headMatch };
    }
    if (e.prevHash !== prevHash) {
      return { intact: false, count: entries.length, brokenAtSeq: e.sequenceNumber,
        reason: 'prevHash linkage mismatch (a prior row was deleted or altered)', headMatch };
    }
    if (computeEntryHash(e, e.prevHash) !== e.entryHash) {
      return { intact: false, count: entries.length, brokenAtSeq: e.sequenceNumber,
        reason: 'entryHash mismatch (this row was tampered)', headMatch };
    }
    prevHash = e.entryHash;
  }

  if (!headMatch.ok) {
    // no row to blame
    return {
      intact: false,
      count: entries.length,
      brokenAtSeq: null,
      reason: headMismatchReason(headMatch, entries.length),
      headMatch,
    };
  }

  return { intact: true, count: entries.length, headMatch };
};

// every break, not first
export const collectChainBreaks = (entries, head) => {
  const rows = entries || [];
  const breaks = [];
  let prevHash = GENESIS_HASH;
  let expectedSeq = null;

  let prevSeq = null;

  for (const e of rows) {
    const seq = Number(e.sequenceNumber);
    if (expectedSeq === null) expectedSeq = seq;

    let gapHere = false;
    if (seq !== expectedSeq) {
      gapHere = true;
      breaks.push({
        seq,
        culprit: null,
        kind: seq > expectedSeq ? 'missing' : 'reordered',
        expectedSeq,
        reason: seq > expectedSeq
          ? `seq ${expectedSeq}..${seq - 1} deleted before this row`
          : `seq ${seq} appears out of order`,
      });
      expectedSeq = seq;
    }

    // gap explains the link
    if (!gapHere && e.prevHash !== prevHash) {
      // blames the previous row
      breaks.push({
        seq,
        culprit: prevSeq,
        kind: 'linkage',
        reason: prevSeq == null
          ? 'prevHash does not match the genesis hash'
          : `prevHash does not match seq ${prevSeq} — that row was rewritten`,
      });
    }
    // row self-check
    if (computeEntryHash(e, e.prevHash) !== e.entryHash) {
      breaks.push({ seq, culprit: seq, kind: 'altered', reason: 'row content no longer hashes to its stored entryHash' });
    }

    prevHash = e.entryHash;
    prevSeq = seq;
    expectedSeq += 1;
  }

  const headMatch = head === undefined ? { checked: false, ok: true } : checkChainHead(rows, head);
  if (!headMatch.ok) {
    // tail hash names tail
    const culprit = !headMatch.headMissing && headMatch.actualSeq === headMatch.expectedSeq
      ? headMatch.actualSeq
      : null;
    breaks.push({ seq: null, culprit, kind: 'head', reason: headMismatchReason(headMatch, rows.length) });
  }

  return { intact: breaks.length === 0, count: rows.length, breaks, headMatch };
};

export const verifyChainForOrg = async (organizationId) => {
  // one snapshot
  const { rows, head } = await db.transaction(
    async (trx) => {
      const logRows = await trx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, organizationId))
        .orderBy(asc(auditLogs.sequenceNumber));
      const [headRow] = await trx
        .select()
        .from(auditChainHead)
        .where(eq(auditChainHead.organizationId, organizationId))
        .limit(1);
      return { rows: logRows, head: headRow || null };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );

  const chained = rows.filter((r) => r.sequenceNumber !== null && r.sequenceNumber !== undefined);
  return verifyChain(chained, head);
};
