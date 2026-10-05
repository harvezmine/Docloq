// Document DNA hashing: SHA-256, SimHash, and pure-JS ssdeep.

import crypto from 'crypto';
import { db } from '../db/index.js';
import { documents } from '../db/schema.js';
import { eq, or, sql } from 'drizzle-orm';
import uploadConfig from '../config/upload.config.js';

export const generateSHA256 = (input) => {
  return crypto.createHash('sha256').update(input).digest('hex');
};

// Fold DocLoq's own honeytoken homoglyphs (Latin→Cyrillic look-alikes injected into
// served plain-text copies) back to Latin BEFORE fingerprinting. Without this, a file
// DocLoq itself served no longer matches its stored SimHash — NFKD does not fold scripts,
// so the Cyrillic subs survive normalization and, on short text, drift the SimHash past
// the fuzzy threshold. No-op on clean text (no homoglyphs present).
const HOMOGLYPH_TO_LATIN = Object.fromEntries(
  Object.entries(uploadConfig.honeytoken.homoglyphMap).map(([latin, cyrillic]) => [cyrillic, latin]),
);
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH_TO_LATIN).join('')}]`, 'g');
const foldHomoglyphs = (text) => text.replace(HOMOGLYPH_RE, (ch) => HOMOGLYPH_TO_LATIN[ch] || ch);

// Normalise text so trivially-different copies hash identically.
export const normalizeText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // Strip DocLoq's invisible honeytoken/watermark chars BEFORE collapsing whitespace.
  // U+FEFF is matched by \s, so the \s+ collapse below would turn an in-word one into a
  // real space and split the word — shattering the SimHash of any copy DocLoq served.
  // Covers ZWC (U+200B–200D, U+FEFF) and the download-watermark set (U+2060–2064).
  text = text.replace(/[\u200B-\u200D\u2060-\u2064\uFEFF]/g, '');
  text = text.toLowerCase();
  text = foldHomoglyphs(text); // undo DocLoq honeytoken subs so served copies still match
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/[.,;:!?'"()\[\]{}<>«»""''—–\-/\\|@#$%^&*_+=~`]/g, '');

  // 4. Special / non-printable character removal (keep basic alphanumeric + space)
  text = text.replace(/[^\p{L}\p{N}\s]/gu, '');

  // 5. Unicode NFKD normalisation
  text = text.normalize('NFKD');

  // 6. Strip combining diacritical marks (accents)
  text = text.replace(/[\u0300-\u036f]/g, '');

  // 7. Final whitespace cleanup
  text = text.replace(/\s+/g, ' ').trim();

  return text;
};

// ============================================================
// SimHash (64-bit) — lightweight implementation using BigInt
// ============================================================

/**
 * Generate word-level shingles from text.
 */
const shingle = (text, size = 3) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < size) return [words.join(' ')];
  const shingles = [];
  for (let i = 0; i <= words.length - size; i++) {
    shingles.push(words.slice(i, i + size).join(' '));
  }
  return shingles;
};

/**
 * Hash a string into a 64-bit BigInt using FNV-1a variant.
 */
const hash64 = (str) => {
  let h = 0xcbf29ce484222325n; // FNV offset basis
  const prime = 0x100000001b3n;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & 0xFFFFFFFFFFFFFFFFn; // keep 64 bits
  }
  return h;
};

/**
 * Compute a 64-bit SimHash of the given text.
 * @param {string} text — normalised text
 * @returns {string} — 16-char hex string representing 64-bit hash
 */
export const generateSimHash = (text) => {
  if (!text) return '0000000000000000';

  const shingles = shingle(text);
  // Weighted accumulator for 64 bit positions
  const v = new Array(64).fill(0);

  for (const s of shingles) {
    const h = hash64(s);
    for (let i = 0; i < 64; i++) {
      if ((h >> BigInt(i)) & 1n) {
        v[i] += 1;
      } else {
        v[i] -= 1;
      }
    }
  }

  let fingerprint = 0n;
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) {
      fingerprint |= (1n << BigInt(i));
    }
  }
  return fingerprint.toString(16).padStart(16, '0');
};

/**
 * Compute Hamming distance between two 64-bit hex simhash strings.
 * @returns {number} 0-64
 */
export const hammingDistance = (a, b) => {
  const va = BigInt(`0x${a}`);
  const vb = BigInt(`0x${b}`);
  let xor = va ^ vb;
  let dist = 0;
  while (xor) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
};

// ============================================================
// SSDEEP — pure-JS context-triggered piecewise hashing (spamsum)
// ============================================================
// Self-contained implementation of the spamsum algorithm (the basis of ssdeep),
// so no native C dependency is required. Produces "blocksize:hash1:hash2".

const SSDEEP_SPAMSUM_LENGTH = 64;
const SSDEEP_MIN_BLOCKSIZE = 3;
const SSDEEP_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const ROLL_WINDOW = 7;
const HASH_PRIME = 0x01000193;
const HASH_INIT = 0x28021967;

// Rolling hash state machine — emits a value each byte; trigger on (value % blocksize) === blocksize-1
const rollHash = () => {
  const win = new Array(ROLL_WINDOW).fill(0);
  let h1 = 0, h2 = 0, h3 = 0, n = 0;
  return (byte) => {
    h2 = (h2 - h1 + ROLL_WINDOW * byte) >>> 0;
    h1 = (h1 + byte - win[n % ROLL_WINDOW]) >>> 0;
    win[n % ROLL_WINDOW] = byte;
    n++;
    h3 = ((h3 << 5) >>> 0) ^ byte;
    h3 = h3 >>> 0;
    return (h1 + h2 + h3) >>> 0;
  };
};

const sumHash = (byte, h) => (((h * HASH_PRIME) >>> 0) ^ byte) >>> 0;

/**
 * Generate an ssdeep-style fuzzy hash.
 * @param {Buffer|string} input
 * @returns {string} — "blocksize:hash1:hash2" or '' for empty input
 */
export const generateSSDeep = (input) => {
  const data = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''), 'utf-8');
  if (data.length === 0) return '';

  // Choose blocksize so the signature fits in SSDEEP_SPAMSUM_LENGTH
  let blockSize = SSDEEP_MIN_BLOCKSIZE;
  while (blockSize * SSDEEP_SPAMSUM_LENGTH < data.length) blockSize *= 2;

  for (;;) {
    const roll = rollHash();
    let h1 = HASH_INIT, h2 = HASH_INIT;
    let sig1 = '', sig2 = '';

    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      h1 = sumHash(b, h1);
      h2 = sumHash(b, h2);
      const r = roll(b);

      if (r % blockSize === blockSize - 1 && sig1.length < SSDEEP_SPAMSUM_LENGTH - 1) {
        sig1 += SSDEEP_B64[h1 % 64];
        h1 = HASH_INIT;
      }
      if (r % (blockSize * 2) === blockSize * 2 - 1 && sig2.length < SSDEEP_SPAMSUM_LENGTH / 2 - 1) {
        sig2 += SSDEEP_B64[h2 % 64];
        h2 = HASH_INIT;
      }
    }

    sig1 += SSDEEP_B64[h1 % 64];
    sig2 += SSDEEP_B64[h2 % 64];

    // If the first signature is too short, halve the blocksize and retry (matches spamsum behaviour)
    if (blockSize > SSDEEP_MIN_BLOCKSIZE && sig1.length < SSDEEP_SPAMSUM_LENGTH / 2) {
      blockSize = Math.floor(blockSize / 2);
      continue;
    }
    return `${blockSize}:${sig1}:${sig2}`;
  }
};

// Levenshtein edit distance between two short strings
const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

/**
 * Compare two ssdeep hashes. Returns 0-100 similarity (100 = identical).
 * @param {string} a — "blocksize:h1:h2"
 * @param {string} b — "blocksize:h1:h2"
 * @returns {number}
 */
export const ssdeepCompare = (a, b) => {
  if (!a || !b || a === '' || b === '') return 0;
  if (a === b) return 100;

  const [bsA, a1, a2] = a.split(':');
  const [bsB, b1, b2] = b.split(':');
  if (a1 === undefined || b1 === undefined) return 0;

  const blockA = parseInt(bsA, 10);
  const blockB = parseInt(bsB, 10);

  // ssdeep only compares signatures computed at the same or adjacent blocksizes
  let s1, s2;
  if (blockA === blockB) { s1 = a1; s2 = b1; }
  else if (blockA === blockB * 2) { s1 = a1; s2 = b2; }
  else if (blockB === blockA * 2) { s1 = a2; s2 = b1; }
  else return 0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  const dist = editDistance(s1, s2);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
};

// ============================================================
// Document DNA — combines all hashes
// ============================================================

/**
 * Generate the full Document DNA from normalised text.
 * @param {string} normalizedText
 * @returns {{ sha256: string, ssdeep: string, simhash: string }}
 */
export const generateDocumentDNA = (normalizedText) => {
  const sha256 = generateSHA256(normalizedText || '');
  const ssdeep = generateSSDeep(normalizedText || '');
  const simhash = generateSimHash(normalizedText || '');
  return { sha256, ssdeep, simhash };
};

// ============================================================
// Duplicate Check — query DB for exact + similar matches
// ============================================================

/**
 * Check whether a document with identical or similar hashes already exists.
 * @param {string} sha256
 * @param {string} ssdeep — currently placeholder
 * @param {string} simhash — 16-char hex
 * @returns {{ isExact: boolean, isSimilar: boolean, matches: Array }}
 */
export const checkDuplicate = async (sha256, ssdeep, simhash) => {
  const result = { isExact: false, isSimilar: false, matches: [] };

  try {
    // 1. Exact match — SHA-256
    const exactMatches = await db
      .select({
        id: documents.id,
        filename: documents.originalFilename,
        contentHash: documents.contentHash,
        simHash: documents.simHash,
      })
      .from(documents)
      .where(eq(documents.contentHash, sha256));

    if (exactMatches.length > 0) {
      result.isExact = true;
      result.matches.push(
        ...exactMatches.map((m) => ({ ...m, matchType: 'exact' })),
      );
    }

    // 2. Similar match — SimHash (Hamming distance ≤ 10 → ~84 % similar)
    // Because Drizzle does not have native bitwise XOR pop-count we fetch
    // candidates with a non-null simHash and filter in JS.
    if (simhash && simhash !== '0000000000000000') {
      const candidates = await db
        .select({
          id: documents.id,
          filename: documents.originalFilename,
          contentHash: documents.contentHash,
          simHash: documents.simHash,
        })
        .from(documents)
        .where(
          sql`${documents.simHash} IS NOT NULL AND ${documents.contentHash} != ${sha256}`,
        );

      for (const c of candidates) {
        if (!c.simHash) continue;
        const dist = hammingDistance(simhash, c.simHash);
        if (dist <= 10) {
          result.isSimilar = true;
          result.matches.push({
            ...c,
            matchType: 'similar',
            hammingDistance: dist,
            similarity: Math.round(((64 - dist) / 64) * 100),
          });
        }
      }
    }
  } catch (err) {
    console.error('[Hash] Duplicate check error:', err.message);
  }

  return result;
};
