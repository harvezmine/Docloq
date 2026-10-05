import crypto from 'crypto';
import { sendOTPEmail } from './email.service.js';
import { db } from '../db/index.js';
import { securityEvents } from '../db/schema.js';
import { appendAuditEntry, ADMIN_ACTOR } from './audit.service.js';

export const cfg = () => ({
  enabled: process.env.SSH_CONSOLE_ENABLED === 'true',
  host: process.env.SSH_CONSOLE_HOST || '',
  port: parseInt(process.env.SSH_CONSOLE_PORT || '22', 10),
  user: process.env.SSH_CONSOLE_USER || '',
  fingerprint: (process.env.SSH_CONSOLE_HOST_FINGERPRINT || '').toLowerCase().replace(/[^a-f0-9]/g, ''),
  otpEmail: process.env.SSH_CONSOLE_OTP_EMAIL || '',
  idleMs: 5 * 60 * 1000,
  maxMs: 30 * 60 * 1000,
  readyTimeoutMs: 15000,
});

export const isEnabled = () => cfg().enabled && !!cfg().host && !!cfg().user;
export const otpRequired = () => !!cfg().otpEmail;

const OTP_TTL = 5 * 60 * 1000;
const OTP_MAX_TRIES = 5;
const OTP_COOLDOWN = 30 * 1000;
const OTP_MAX_PER_HOUR = 6;
let otpState = null;
let otpSends = [];

export async function sendOtp() {
  const c = cfg();
  if (!c.otpEmail) return { sent: false, reason: 'not-configured' };
  const now = Date.now();
  otpSends = otpSends.filter((t) => now - t < 3600_000);
  if (otpSends.length && now - otpSends[otpSends.length - 1] < OTP_COOLDOWN) return { sent: false, reason: 'cooldown' };
  if (otpSends.length >= OTP_MAX_PER_HOUR) return { sent: false, reason: 'rate' };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  otpState = { hash: crypto.createHash('sha256').update(code).digest('hex'), exp: now + OTP_TTL, tries: 0 };
  otpSends.push(now);
  await sendOTPEmail(c.otpEmail, code, 'Super Admin — SSH Console');
  return { sent: true };
}

export function verifyOtp(code) {
  if (!cfg().otpEmail) return true;
  const s = otpState;
  if (!s || s.exp < Date.now()) return false;
  if (s.tries >= OTP_MAX_TRIES) { otpState = null; return false; }
  s.tries += 1;
  const h = crypto.createHash('sha256').update(String(code || '')).digest('hex');
  const ok = h.length === s.hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(s.hash));
  if (ok) otpState = null;
  return ok;
}

const TICKET_TTL = 30 * 1000;
const tickets = new Map();
export function issueTicket(ip) {
  pruneTickets();
  const token = crypto.randomBytes(24).toString('hex');
  tickets.set(token, { ip, exp: Date.now() + TICKET_TTL });
  return token;
}
export function consumeTicket(token, ip) {
  if (!token) return false;
  const r = tickets.get(token);
  if (!r) return false;
  tickets.delete(token);
  return r.exp > Date.now() && r.ip === ip;
}
function pruneTickets() {
  const now = Date.now();
  for (const [t, r] of tickets) if (r.exp <= now) tickets.delete(t);
}

const OPEN_WINDOW = 5 * 60 * 1000, OPEN_MAX = 5;
const opens = new Map();
export function allowOpen(ip) {
  const now = Date.now();
  const a = (opens.get(ip) || []).filter((t) => now - t < OPEN_WINDOW);
  if (a.length >= OPEN_MAX) { opens.set(ip, a); return false; }
  a.push(now); opens.set(ip, a);
  return true;
}

const LOCK_FAILS = 3, LOCK_MS = 15 * 60 * 1000;
const fails = new Map();
export function isLocked(ip) {
  const f = fails.get(ip);
  return !!(f && f.until && f.until > Date.now());
}
export function recordFail(ip) {
  const f = fails.get(ip) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= LOCK_FAILS) { f.until = Date.now() + LOCK_MS; f.count = 0; }
  fails.set(ip, f);
}
export function clearFails(ip) { fails.delete(ip); }

let active = false;
export function acquire() { if (active) return false; active = true; return true; }
export function release() { active = false; }
export function isActive() { return active; }

export function hostKeyOk(keyBuf) {
  const hash = crypto.createHash('sha256').update(keyBuf).digest('hex');
  const fp = cfg().fingerprint;
  if (!fp) return { ok: true, tofu: true, hash };
  return { ok: hash === fp, tofu: false, hash };
}

export const SSH_EVENT_SEVERITY = {
  ssh_otp_sent: 'medium',
  ssh_otp_failed: 'medium',
  ssh_ticket_issued: 'high',
  ssh_ticket_denied: 'high',
  ssh_console_open: 'high',
  ssh_console_close: 'medium',
  ssh_console_denied: 'high',
  ssh_access_locked: 'critical',
};

export function buildSshAuditPayload(eventType, description, details = {}) {
  const { userAgent = null, ...evDetails } = details;
  const severity = SSH_EVENT_SEVERITY[eventType] || 'high';
  return {
    securityEvent: {
      organizationId: null,
      userId: null,
      eventType,
      severity,
      description,
      details: evDetails,
      ipAddress: evDetails.ip || null,
    },
    auditEntry: {
      organizationId: null,
      userId: null,
      action: 'update',
      resourceType: 'system',
      resourceId: null,
      details: { ...evDetails, actor: ADMIN_ACTOR, adminAction: eventType, severity },
      ipAddress: evDetails.ip || null,
      userAgent,
    },
  };
}

export async function auditSsh(eventType, description, details = {}) {
  let payload;
  try {
    payload = buildSshAuditPayload(eventType, description, details);
  } catch (e) {
    console.warn('[SSH] audit payload build failed:', e.message);
    return;
  }
  try {
    await db.insert(securityEvents).values(payload.securityEvent);
  } catch (e) {
    console.warn('[SSH] audit insert failed:', e.message);
  }
  try {
    await appendAuditEntry(payload.auditEntry);
  } catch (e) {
    console.warn('[SSH] admin audit-log insert failed:', e.message);
  }
}
