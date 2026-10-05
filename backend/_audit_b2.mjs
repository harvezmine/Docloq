// (B) redo: after erasing a tombstone mid-generation, WAIT for the generation to actually land
// and see whether the final UPDATE overwrites the tombstone. Booleans only, no content.
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { organizations, users, aiProjectSources, aiProjectOutputs } from './src/db/schema.js';
import * as proj from './src/services/ai-project.service.js';
import * as out from './src/services/ai-project-output.service.js';
import { decryptChunkText } from './src/services/source-chunk.service.js';

const CANARY = 'ZQ7X-RESURRECT-CANARY-4417';
const BODY = Array.from({ length: 40 }, (_, i) =>
  `Pasal ${i + 1} - Ketentuan nomor ${i + 1}: nilai termin Rp ${(i + 1) * 11}.000.000, jatuh tempo hari ke-${(i + 1) * 7}. ${i === 0 ? CANARY : ''}`
).join('\n');

const created = { orgId: null };
const log = [];
const waitForSource = async (id) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    const [s] = await db.select().from(aiProjectSources).where(eq(aiProjectSources.id, id));
    if (s && s.status !== 'processing') return s;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('timeout source');
};

try {
  const stamp = Date.now();
  const [org] = await db.insert(organizations).values({
    name: `AUDIT B2 ${stamp}`, slug: `audit-b2-${stamp}`, companyCode: `C${String(stamp).slice(-7)}`,
  }).returning();
  created.orgId = org.id;
  const [user] = await db.insert(users).values({
    organizationId: org.id, email: `audit_b2_${stamp}@docloq.test`,
    passwordHash: 'x', firstName: 'A', lastName: 'B', role: 'owner', isActive: true,
  }).returning();
  const project = await proj.createProject({ name: 'B2', userId: user.id, orgId: org.id });

  const srcB = await proj.addTextSource(project.id, { title: 'Kontrak Panjang', content: BODY }, user.id, org.id);
  await waitForSource(srcB.id);

  const pendB = await out.requestOutput({
    projectId: project.id, organizationId: org.id, userId: user.id, kind: 'slides',
    sourceIds: [srcB.id],
  });

  await new Promise((r) => setTimeout(r, 3000));
  const [mid] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: at +3s status=${mid.status} (window ${mid.status === 'generating' ? 'OPEN' : 'closed'})`);

  const n = await out.eraseOutputsForSource(srcB.id, 'AUDIT erase during slides gen');
  const [afterErase] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
  log.push(`B: erase matched ${n}; post-erase status=${afterErase.status} cipherText=${afterErase.cipherText ? 'PRESENT' : 'null'}`);

  // Wait for the IN-FLIGHT generation to land: poll until status leaves 'revoked' OR ciphertext reappears.
  const t0 = Date.now();
  let landed = null;
  while (Date.now() - t0 < 240_000) {
    const [r] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
    if (r.status !== 'revoked' || r.cipherText) { landed = r; break; }
    await new Promise((r2) => setTimeout(r2, 500));
  }
  if (!landed) {
    const [r] = await db.select().from(aiProjectOutputs).where(eq(aiProjectOutputs.id, pendB.id));
    log.push(`B: after 240s the tombstone HELD → status=${r.status} cipherText=${r.cipherText ? 'PRESENT' : 'null'}`);
  } else {
    log.push(`B: generation landed after ~${Date.now() - t0}ms → status=${landed.status} cipherText=${landed.cipherText ? 'PRESENT' : 'null'} err=${JSON.stringify(landed.errorMessage)}`);
    if (landed.cipherText) {
      const key = await proj.resolveProjectKey(project.id);
      const plain = decryptChunkText(landed, key);
      log.push(`B: >>> TOMBSTONE RESURRECTED; canary recoverable = ${plain.includes(CANARY)}`);
    }
  }
} catch (err) {
  log.push(`HARNESS ERROR :: ${err.stack}`);
} finally {
  if (created.orgId) {
    for (const [t, c] of [
      ['crypto_shredding', 'organization_id'], ['pqc_keypairs', 'organization_id'],
      ['audit_chain_head', 'organization_id'], ['audit_logs', 'organization_id'],
      ['ai_projects', 'organization_id'], ['documents', 'organization_id'],
      ['users', 'organization_id'], ['organizations', 'id'],
    ]) {
      try { await db.execute(sql.raw(`delete from ${t} where ${c} = '${created.orgId}'`)); }
      catch (e) { log.push(`cleanup warn (${t}): ${e.message.slice(0, 80)}`); }
    }
    log.push('cleanup: fixtures removed');
  }
}
console.log(log.join('\n'));
process.exit(0);
