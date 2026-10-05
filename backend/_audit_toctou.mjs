// ADVERSARIAL: prove the generate-vs-erase TOCTOU.
// Prints ONLY booleans/status — never document content.
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { organizations, users, aiProjectSources, aiProjectOutputs } from './src/db/schema.js';
import * as proj from './src/services/ai-project.service.js';
import * as out from './src/services/ai-project-output.service.js';
import { decryptChunkText } from './src/services/source-chunk.service.js';

const CANARY = 'ZQ7X-TOCTOU-CANARY-9931';
const BODY = [
  `PERJANJIAN RAHASIA. Nomor 77/AA/2026. ${CANARY}`,
  'Pasal 1 - Nilai kontrak Rp 950.000.000 (sembilan ratus lima puluh juta rupiah).',
  'Pasal 2 - Termin I dibayar 10 Februari 2026 sebesar 40%.',
  'Pasal 3 - Termin II dibayar 20 Agustus 2026 sebesar 60%.',
].join('\n');

const created = { orgId: null };
const log = [];

const waitForSource = async (id, ms = 60_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const [s] = await db.select().from(aiProjectSources).where(eq(aiProjectSources.id, id));
    if (s && s.status !== 'processing') return s;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('timeout source');
};
const waitForOutput = async (id, ms = 180_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const [r] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, id));
    if (r && r.status !== 'generating') return r;
    await new Promise((r2) => setTimeout(r2, 500));
  }
  throw new Error('timeout output');
};

try {
  const stamp = Date.now();
  const [org] = await db.insert(organizations).values({
    name: `AUDIT TOCTOU ${stamp}`, slug: `audit-toctou-${stamp}`, companyCode: `A${String(stamp).slice(-7)}`,
  }).returning();
  created.orgId = org.id;
  const [user] = await db.insert(users).values({
    organizationId: org.id, email: `audit_toctou_${stamp}@docloq.test`,
    passwordHash: 'x', firstName: 'A', lastName: 'T', role: 'owner', isActive: true,
  }).returning();
  const project = await proj.createProject({ name: 'TOCTOU', userId: user.id, orgId: org.id });

  // ───────── VARIANT A: sourceIds omitted → row.source_ids = [] during generation ─────────
  const srcA = await proj.addTextSource(project.id, { title: 'Kontrak A', content: BODY }, user.id, org.id);
  await waitForSource(srcA.id);

  const pendA = await out.requestOutput({
    projectId: project.id, organizationId: org.id, userId: user.id, kind: 'summary',
    // sourceIds omitted — the DEFAULT UI path ("generate from all sources")
  });
  const [rowMid] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendA.id));
  log.push(`A: in-flight row status=${rowMid.status} source_ids=${JSON.stringify(rowMid.sourceIds)}`);

  // Let buildContext finish (snippets now in memory, LLM call in flight), then remove the source.
  await new Promise((r) => setTimeout(r, 2500));
  const erasedCountA = await out.eraseOutputsForSource(srcA.id, 'AUDIT probe');
  log.push(`A: eraseOutputsForSource matched ${erasedCountA} row(s) while generation in flight`);
  await proj.removeSource(project.id, srcA.id);
  log.push(`A: removeSource done (chunks deleted, source row deleted)`);

  const finalA = await waitForOutput(pendA.id);
  log.push(`A: FINAL status=${finalA.status} cipherText=${finalA.cipherText ? 'PRESENT' : 'null'} source_ids=${JSON.stringify(finalA.sourceIds)}`);

  let canaryA = null;
  if (finalA.cipherText) {
    const key = await proj.resolveProjectKey(project.id);
    const plain = decryptChunkText(finalA, key);
    canaryA = plain.includes(CANARY) || /950\.000\.000|950000000|sembilan ratus/i.test(plain);
    log.push(`A: >>> decrypted OK; content of the REMOVED source recoverable = ${canaryA}`);
  }
  const [srcGoneA] = await db.select().from(aiProjectSources).where(eq(aiProjectSources.id, srcA.id));
  log.push(`A: source row still exists = ${!!srcGoneA}`);
  const reEraseA = await out.eraseOutputsForSource(srcA.id, 'AUDIT second sweep');
  log.push(`A: a LATER eraseOutputsForSource(same id) matches ${reEraseA} row(s)`);

  // ───────── VARIANT B: explicit sourceIds → erase MATCHES, then generate overwrites ─────────
  const srcB = await proj.addTextSource(project.id, { title: 'Kontrak B', content: BODY }, user.id, org.id);
  await waitForSource(srcB.id);

  const pendB = await out.requestOutput({
    projectId: project.id, organizationId: org.id, userId: user.id, kind: 'summary',
    sourceIds: [srcB.id],
  });
  const [rowMidB] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: in-flight row status=${rowMidB.status} source_ids=${JSON.stringify(rowMidB.sourceIds)}`);

  await new Promise((r) => setTimeout(r, 2500));
  const erasedCountB = await out.eraseOutputsForSource(srcB.id, 'AUDIT probe B');
  const [afterEraseB] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: erase matched ${erasedCountB} row(s); immediately after erase status=${afterEraseB.status} cipherText=${afterEraseB.cipherText ? 'PRESENT' : 'null'}`);

  const finalB = await waitForOutput(pendB.id);
  log.push(`B: FINAL status=${finalB.status} cipherText=${finalB.cipherText ? 'PRESENT' : 'null'}`);
  if (finalB.cipherText) {
    const key = await proj.resolveProjectKey(project.id);
    const plain = decryptChunkText(finalB, key);
    log.push(`B: >>> tombstone RESURRECTED; canary recoverable = ${plain.includes(CANARY) || /950\.000\.000/.test(plain)}`);
  }
} catch (err) {
  log.push(`HARNESS ERROR :: ${err.stack}`);
} finally {
  if (created.orgId) {
    for (const [t, c] of [
      ['crypto_shredding', 'organization_id'],
      ['pqc_keypairs', 'organization_id'],
      ['audit_chain_head', 'organization_id'],
      ['audit_logs', 'organization_id'],
      ['ai_projects', 'organization_id'],
      ['documents', 'organization_id'],
      ['users', 'organization_id'],
      ['organizations', 'id'],
    ]) {
      try { await db.execute(sql.raw(`delete from ${t} where ${c} = '${created.orgId}'`)); }
      catch (e) { log.push(`cleanup warn (${t}): ${e.message.slice(0, 80)}`); }
    }
    log.push('cleanup: fixtures removed');
  }
}
console.log(log.join('\n'));
process.exit(0);
