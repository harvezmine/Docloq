import { renderShell, label, heading, para, insetBox, kv, footnote, send, C } from "./mail-template.mjs";
const to = process.env.ALERT_TO;
if (!to) { console.error("ALERT_TO missing"); process.exit(2); }
const file = process.env.BK_FILE || "-";
const size = process.env.BK_SIZE || "-";
const retention = process.env.BK_RETENTION || "-";
const host = process.env.BK_HOST || "-";
const when = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
const content = [
  label("BACKUP", C.successSoft),
  heading("Daily backup completed"),
  para("The DocLoq production database was backed up successfully. The tamper-evident audit chain snapshot is included in this dump."),
  insetBox([ kv("File", file, true), kv("Size", size), kv("Database", "docloq_db"), kv("Retention", retention + " days"), kv("Host", host), kv("Completed", when) ].join("")),
  footnote("Automated daily backup at 00:00. If you did not expect this, review the DocLoq server cron.")
].join("");
const html = renderShell({ title: "Backup Report", preheader: "Daily database backup completed - " + size, accent: C.success, contentHtml: content });
const text = `DocLoq - Daily backup completed\n\nFile: ${file}\nSize: ${size}\nDatabase: docloq_db\nRetention: ${retention} days\nHost: ${host}\nCompleted: ${when}`;
try { const id = await send({ to, subject: `DocLoq - Daily backup OK (${size})`, html, text, fromName: "DocLoq Backups" }); console.log("MAIL_OK", id); process.exit(0); }
catch (e) { console.error("MAIL_FAIL", e.message); process.exit(1); }