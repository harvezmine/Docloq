import { verifyChainForOrg } from "../src/services/audit.service.js";
import { db } from "../src/db/index.js";
import { organizations, auditChainHead, auditLogs } from "../src/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { renderShell, label, heading, para, insetBox, kv, footnote, divider, send, C } from "./mail-template.mjs";
import fs from "fs";
const ALERT_TO = process.env.ALERT_TO;
const STATE = "/tmp/docloq-tamper-state.json";
const heads = await db.select().from(auditChainHead);
const orgRows = await db.select().from(organizations);
const nameById = Object.fromEntries(orgRows.map(o => [o.id, o.name]));
const results = [];
for (const h of heads) {
  const chain = await verifyChainForOrg(h.organizationId);
  const [agg] = await db.select({ mx: sql`max(${auditLogs.sequenceNumber})`, cnt: sql`count(${auditLogs.sequenceNumber})` }).from(auditLogs).where(eq(auditLogs.organizationId, h.organizationId));
  const headLast = Number(h.lastSeq || 0);
  const mx = Number(agg?.mx || 0);
  const cnt = Number(agg?.cnt || 0);
  const tailOk = mx === headLast && cnt === headLast;
  const intact = chain.intact && tailOk;
  const reason = !chain.intact ? chain.reason : (!tailOk ? `missing rows: head=${headLast} maxSeq=${mx} count=${cnt} (tail/rows deleted)` : null);
  const brokenAtSeq = chain.brokenAtSeq ?? (!tailOk ? mx + 1 : null);
  results.push({ org: h.organizationId, name: nameById[h.organizationId] || h.organizationId, intact, reason, brokenAtSeq });
}
const broken = results.filter(r => !r.intact);
let prev = {};
try { prev = JSON.parse(fs.readFileSync(STATE, "utf8")); } catch {}
const newlyBroken = broken.filter(b => !prev[b.org]);
const nextState = {};
for (const b of broken) nextState[b.org] = { reason: b.reason, brokenAtSeq: b.brokenAtSeq };
try { fs.writeFileSync(STATE, JSON.stringify(nextState)); } catch {}
console.log(`checked=${results.length} broken=${broken.length} newly=${newlyBroken.length}`);
if (newlyBroken.length && ALERT_TO) {
  const boxes = newlyBroken.map(b => insetBox([ kv("Organization", b.name), kv("Org ID", b.org, true), kv("Broken at seq", String(b.brokenAtSeq)), kv("Reason", b.reason) ].join(""))).join("");
  const when = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const content = [ label("SECURITY ALERT", C.dangerSoft), heading("Audit tamper detected"), para(`${newlyBroken.length} organization audit chain(s) failed integrity verification. A row was deleted or altered directly in the database.`), boxes, divider(), footnote("Recommended: preserve current state, restore <b>audit_logs</b> from the latest backup taken <b>before</b> the tamper, fix <b>audit_chain_head</b>, then re-verify and re-anchor. Likely vector is direct DB access (adminer) - lock it down and rotate the DB password."), footnote("Detected " + when + " &middot; DocLoq audit monitor") ].join("");
  const html = renderShell({ title: "Security Alert", preheader: `Audit tamper detected - ${newlyBroken.length} org(s)`, accent: C.danger, contentHtml: content });
  const text = "DocLoq AUDIT TAMPER DETECTED\n\n" + newlyBroken.map(b => `- ${b.name} (${b.org})\n  broken at seq ${b.brokenAtSeq}: ${b.reason}`).join("\n\n") + "\n\nRestore audit_logs from the latest pre-tamper backup, fix audit_chain_head, re-verify + re-anchor. Vector = direct DB access (adminer).";
  try { const id = await send({ to: ALERT_TO, subject: `[DocLoq] AUDIT TAMPER - ${newlyBroken.length} org(s) broken`, html, text, fromName: "DocLoq Security" }); console.log("ALERT_SENT", id); }
  catch (e) { console.error("ALERT_FAIL", e.message); }
}
process.exit(0);