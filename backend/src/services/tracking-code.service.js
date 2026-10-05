// Visible OSINT canary code format: DLQ-{docCode}-{dlCode}.
// docCode = stable per tracked document (searchable), dlCode = unique per download (attribution).
import crypto from 'crypto';

const PREFIX = 'DLQ';
// Crockford-style base32 (excludes I, L, O, U)
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function toBase32(buf) {
  let out = '';
  for (const b of buf) out += B32[b % 32];
  return out;
}

/** Stable per-document discovery code (8 hex). Generated once at toggle-on. */
export function generateDocCode() {
  return crypto.randomBytes(4).toString('hex');
}

/** Unique per-download code (6 base32 chars). */
export function generateDownloadCode() {
  return toBase32(crypto.randomBytes(6)).slice(0, 6);
}

/** Full visible code stamped into the served file. */
export function formatVisibleCode(docCode, dlCode) {
  return `${PREFIX}-${docCode}-${dlCode}`;
}

/** Searchable prefix — one Google query covers every download of a doc. */
export function searchPrefix(docCode) {
  return `${PREFIX}-${docCode}`;
}

const FULL_RE = /DLQ-([0-9a-f]{8})-([0-9A-HJKMNP-TV-Z]{6})/g;

/** Extract every full code present in arbitrary text. */
export function parseCodes(text) {
  if (!text) return [];
  const found = [];
  FULL_RE.lastIndex = 0;
  let m;
  while ((m = FULL_RE.exec(text)) !== null) {
    found.push({ docCode: m[1], dlCode: m[2], full: m[0] });
  }
  return found;
}
