// (B) missing status-guard on generateOutput's final UPDATE, forced open with a slow 'slides' gen.
// (C) resolveProjectKey concurrency race.
// Prints ONLY booleans/status — never document content.
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { organizations, users, aiProjectSources, aiProjectOutputs, aiProjects } from './src/db/schema.js';
import * as proj from './src/services/ai-project.service.js';
import * as out from './src/services/ai-project-output.service.js';
import { decryptChunkText } from './src/services/source-chunk.service.js';

const CANARY = 'ZQ7X-RESURRECT-CANARY-4417';
const BODY = Array.from({ length: 40 }, (_, i) =>
  `Pasal ${i + 1} - Ketentuan nomor ${i + 1}: nilai termin Rp ${(i + 1) * 11}.000.000, jatuh tempo hari ke-${(i + 1) * 7}. ${i === 0 ? CANARY : ''}`
).join('\n');

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
const waitForOutput = async (id, ms = 240_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const [r] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, id));
    if (r && r.status !== 'generating') return { row: r, ms: Date.now() - t0 };
    await new Promise((r2) => setTimeout(r2, 400));
  }
  throw new Error('timeout output');
};

try {
  const stamp = Date.now();
  const [org] = await db.insert(organizations).values({
    name: `AUDIT B ${stamp}`, slug: `audit-b-${stamp}`, companyCode: `B${String(stamp).slice(-7)}`,
  }).returning();
  created.orgId = org.id;
  const [user] = await db.insert(users).values({
    organizationId: org.id, email: `audit_b_${stamp}@docloq.test`,
    passwordHash: 'x', firstName: 'A', lastName: 'B', role: 'owner', isActive: true,
  }).returning();
  const project = await proj.createProject({ name: 'B+Race', userId: user.id, orgId: org.id });

  // ───────── (C) resolveProjectKey race — BEFORE any generation mints the key ─────────
  const [preRow] = await db.select().from(aiProjects).where(eq(aiProjects.id, project.id));
  log.push(`C: content_key before race = ${preRow.contentKey ? 'SET' : 'null'}`);
  const N = 8;
  const keys = await Promise.all(Array.from({ length: N }, () => proj.resolveProjectKey(project.id)));
  const hexes = keys.map((k) => Buffer.from(k).toString('hex'));
  const distinct = new Set(hexes);
  log.push(`C: ${N} concurrent resolveProjectKey → ${distinct.size} distinct key(s) (want 1)`);
  const [postRow] = await db.select().from(aiProjects).where(eq(aiProjects.id, project.id));
  const { decryptDocumentKey } = await import('./src/services/encryption.service.js');
  const stored = Buffer.from(await decryptDocumentKey(postRow.contentKey)).toString('hex');
  log.push(`C: every returned key === stored content_key = ${hexes.every((h) => h === stored)}`);

  // ───────── (B) explicit sourceIds + SLOW generation → erase then overwrite ─────────
  const srcB = await proj.addTextSource(project.id, { title: 'Kontrak Panjang', content: BODY }, user.id, org.id);
  await waitForSource(srcB.id);

  const pendB = await out.requestOutput({
    projectId: project.id, organizationId: org.id, userId: user.id, kind: 'slides',
    sourceIds: [srcB.id],
  });
  const [mid] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: in-flight status=${mid.status} source_ids=${JSON.stringify(mid.sourceIds)}`);

  await new Promise((r) => setTimeout(r, 3000));
  const [stillGen] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: at +3s status=${stillGen.status} (window ${stillGen.status === 'generating' ? 'OPEN' : 'already closed'})`);

  const n = await out.eraseOutputsForSource(srcB.id, 'AUDIT erase during slides gen');
  const [afterErase] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: erase matched ${n}; post-erase status=${afterErase.status} cipherText=${afterErase.cipherText ? 'PRESENT' : 'null'}`);

  const { row: finalB, ms } = await waitForOutput(pendB.id);
  log.push(`B: settled after ~${ms}ms → status=${finalB.status} cipherText=${finalB.cipherText ? 'PRESENT' : 'null'} err=${JSON.stringify(finalB.errorMessage)}`);
  if (finalB.cipherText) {
    const key = await proj.resolveProjectKey(project.id);
    const plain = decryptChunkText(finalB, key);
    log.push(`B: >>> RESURRECTED tombstone; canary recoverable = ${plain.includes(CANARY)}`);
  } else {
    log.push('B: tombstone held (no resurrection observed on this run)');
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
