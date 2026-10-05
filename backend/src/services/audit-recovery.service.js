import fs from 'fs';
import zlib from 'zlib';
import { pool, db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { and, eq, isNotNull } from 'drizzle-orm';
import { verifyChainForOrg } from './audit.service.js';
import { withAnchorLock } from './audit-anchor.service.js';

const BACKUPS_DIR = process.env.BACKUPS_DIR || '/backups';
const BACKUP_RE = /^pg_docloq_[0-9_]+(?:_manual)?\.sql\.gz$/;

export const listBackups = () => {
  let files = [];
  try {
    files = fs.readdirSync(BACKUPS_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => BACKUP_RE.test(f))
    .map((f) => {
      const st = fs.statSync(`${BACKUPS_DIR}/${f}`);
      return { file: f, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
};

// full COPY TEXT escape set
const COPY_ESCAPES = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' };

export const unescapeCopy = (v) => {
  if (v === '\\N') return null;
  return v.replace(/\\(x[0-9A-Fa-f]{1,2}|[0-7]{1,3}|[\s\S])/g, (_, c) => {
    if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return COPY_ESCAPES[c] ?? c;
  });
};

const resolveBackupPath = (file) => {
  if (typeof file !== 'string' || !BACKUP_RE.test(file) || file.includes('/') || file.includes('\\')) {
    throw new Error('Invalid backup filename');
  }
  const p = `${BACKUPS_DIR}/${file}`;
  if (!fs.existsSync(p)) throw new Error('Backup file not found');
  return p;
};

export const parseAuditRowsFromDump = (file, organizationId) => {
  const p = resolveBackupPath(file);
  const text = zlib.gunzipSync(fs.readFileSync(p)).toString('utf8');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('COPY public.audit_logs ('));
  if (start < 0) return { columns: [], rows: [] };
  const header = lines[start];
  const columns = header
    .slice(header.indexOf('(') + 1, header.indexOf(')'))
    .split(',')
    .map((s) => s.trim());
  const orgIdx = columns.indexOf('organization_id');
  const seqIdx = columns.indexOf('sequence_number');
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '\\.') break;
    if (lines[i] === '') continue;
    const raw = lines[i].split('\t');
    if (raw[orgIdx] !== organizationId) continue;
    const values = raw.map(unescapeCopy);
    const seqRaw = values[seqIdx];
    rows.push({ seq: seqRaw == null ? null : Number(seqRaw), values });
  }
  return { columns, rows };
};

const liveSeqSet = async (organizationId) => {
  const existing = await db
    .select({ seq: auditLogs.sequenceNumber })
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, organizationId), isNotNull(auditLogs.sequenceNumber)));
  return new Set(existing.map((r) => Number(r.seq)));
};

export const previewRecovery = async (organizationId, file) => {
  const { columns, rows } = parseAuditRowsFromDump(file, organizationId);
  const chained = rows.filter((r) => r.seq != null);
  const existingSet = await liveSeqSet(organizationId);
  const missingSeqs = chained
    .filter((r) => !existingSet.has(r.seq))
    .map((r) => r.seq)
    .sort((a, b) => a - b);
  const backupMaxSeq = chained.reduce((m, r) => Math.max(m, r.seq), 0);
  const verify = await verifyChainForOrg(organizationId);
  return {
    file,
    columns: columns.length,
    backupCount: chained.length,
    backupMaxSeq,
    liveCount: existingSet.size,
    missingSeqs,
    recoverable: missingSeqs.length,
    verify,
  };
};

// blocks half-restored anchoring
export const restoreMissing = async (organizationId, file, opts = {}) =>
  withAnchorLock(
    () => restoreMissingLocked(organizationId, file, opts),
    { restored: 0, restoredSeqs: [], blocked: true, reason: 'anchoring in progress — retry in a moment' },
  );

const restoreMissingLocked = async (organizationId, file, { actor = null } = {}) => {
  const verifyBefore = await verifyChainForOrg(organizationId);
  const { columns, rows } = parseAuditRowsFromDump(file, organizationId);
  const chained = rows.filter((r) => r.seq != null);
  const existingSet = await liveSeqSet(organizationId);
  const missing = chained.filter((r) => !existingSet.has(r.seq)).sort((a, b) => a.seq - b.seq);

  if (missing.length === 0) {
    return { restored: 0, restoredSeqs: [], verifyBefore, verifyAfter: verifyBefore, actor };
  }

  const colList = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  // exact values, hash revalidates
  const insertSql = `INSERT INTO public.audit_logs (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  const client = await pool.connect();
  const restoredSeqs = [];
  try {
    await client.query('BEGIN');
    for (const r of missing) {
      await client.query(insertSql, r.values);
      restoredSeqs.push(r.seq);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const verifyAfter = await verifyChainForOrg(organizationId);
  return { restored: restoredSeqs.length, restoredSeqs, verifyBefore, verifyAfter, actor };
};
