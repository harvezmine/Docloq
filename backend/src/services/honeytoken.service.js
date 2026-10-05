// Honeytoken injection/extraction: Zero-Width Characters, Homoglyph Substitution, Whitespace Encoding.

import crypto from 'crypto';
import uploadConfig from '../config/upload.config.js';

const { zwcChars, zwcPositionCount, homoglyphMap, homoglyphPositionCount, whitespaceLineCount } =
  uploadConfig.honeytoken;

// Reverse homoglyph map (Cyrillic → Latin)
const reverseHomoglyphMap = Object.fromEntries(
  Object.entries(homoglyphMap).map(([latin, cyrillic]) => [cyrillic, latin]),
);

const payloadToBits = (payload) => {
  const json = JSON.stringify(payload);
  let bits = '';
  for (let i = 0; i < json.length; i++) {
    bits += json.charCodeAt(i).toString(2).padStart(8, '0');
  }
  return bits;
};

const bitsToPayload = (bits) => {
  const chars = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    chars.push(String.fromCharCode(parseInt(bits.substring(i, i + 8), 2)));
  }
  try {
    return JSON.parse(chars.join(''));
  } catch {
    return null;
  }
};

// Method 1 — Zero-Width Characters (ZWC): 4 ZWC chars encode 2 bits at a time.
const bitsToZwc = (bits) => {
  let zwc = '';
  for (let i = 0; i < bits.length; i += 2) {
    const pair = bits.substring(i, i + 2).padEnd(2, '0');
    const idx = parseInt(pair, 2); // 0-3
    zwc += zwcChars[idx];
  }
  return zwc;
};

const zwcToBits = (zwc) => {
  let bits = '';
  for (const ch of zwc) {
    const idx = zwcChars.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(2, '0');
  }
  return bits;
};

const injectZwc = (text, payloadBits) => {
  const zwcString = bitsToZwc(payloadBits);
  const positions = [];

  const chunkSize = Math.ceil(zwcString.length / zwcPositionCount);
  const chunks = [];
  for (let i = 0; i < zwcString.length; i += chunkSize) {
    chunks.push(zwcString.substring(i, i + chunkSize));
  }

  const textLen = text.length;
  if (textLen === 0) return { modifiedText: text, zwcToken: zwcString, zwcPositions: [] };

  const step = Math.max(1, Math.floor(textLen / (chunks.length + 1)));
  let modifiedText = text;
  let offset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const pos = Math.min(step * (i + 1) + offset, modifiedText.length);
    modifiedText = modifiedText.slice(0, pos) + chunks[i] + modifiedText.slice(pos);
    positions.push(pos);
    offset += chunks[i].length;
  }

  return {
    modifiedText,
    zwcToken: zwcString,
    zwcPositions: positions,
  };
};

const extractZwc = (text) => {
  const zwcRegex = new RegExp(`[${zwcChars.join('')}]+`, 'g');
  let allZwc = '';
  let match;
  while ((match = zwcRegex.exec(text)) !== null) {
    allZwc += match[0];
  }
  if (!allZwc) return null;

  const bits = zwcToBits(allZwc);
  return bitsToPayload(bits);
};

// Method 2 — Homoglyph Substitution: replaces up to N chars with Cyrillic look-alikes.
const injectHomoglyphs = (text, _payload) => {
  const eligible = []; // indices of characters we can substitute
  for (let i = 0; i < text.length; i++) {
    if (homoglyphMap[text[i]]) {
      eligible.push(i);
    }
  }

  // Positions picked deterministically, seeded by payload hash (reproducible per payload).
  const seed = crypto.createHash('md5').update(JSON.stringify(_payload)).digest();
  const pickCount = Math.min(homoglyphPositionCount, eligible.length);
  const picked = [];

  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = seed[i % seed.length] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < pickCount; i++) {
    picked.push(shuffled[i]);
  }
  picked.sort((a, b) => a - b);

  const chars = text.split('');
  const positions = [];
  for (const idx of picked) {
    const original = chars[idx];
    const replacement = homoglyphMap[original];
    if (replacement) {
      positions.push({ index: idx, original, replacement });
      chars[idx] = replacement;
    }
  }

  const homoglyphToken = crypto
    .createHash('sha256')
    .update(JSON.stringify(positions))
    .digest('hex')
    .substring(0, 32);

  return {
    modifiedText: chars.join(''),
    homoglyphToken,
    homoglyphPositions: positions,
  };
};

const extractHomoglyphs = (text) => {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (reverseHomoglyphMap[text[i]]) {
      found.push({ index: i, char: text[i], originalLatin: reverseHomoglyphMap[text[i]] });
    }
  }
  return found.length > 0 ? found : null;
};

// Method 3 — Whitespace Encoding: trailing space = 0, trailing tab = 1.
const injectWhitespace = (text, payloadBits) => {
  const lines = text.split('\n');
  const positions = [];

  const bitsToEncode = payloadBits.substring(0, Math.min(payloadBits.length, whitespaceLineCount));

  for (let i = 0; i < bitsToEncode.length && i < lines.length; i++) {
    lines[i] = lines[i].replace(/\s+$/, '');
    const bit = bitsToEncode[i];
    lines[i] += bit === '1' ? '\t' : ' ';
    positions.push(i);
  }

  const whitespaceToken = crypto
    .createHash('sha256')
    .update(bitsToEncode)
    .digest('hex')
    .substring(0, 32);

  return {
    modifiedText: lines.join('\n'),
    whitespaceToken,
    whitespacePositions: positions,
  };
};

const extractWhitespace = (text) => {
  const lines = text.split('\n');
  let bits = '';
  let found = false;

  for (let i = 0; i < Math.min(lines.length, whitespaceLineCount); i++) {
    const trailing = lines[i].match(/[\t ]+$/);
    if (trailing) {
      found = true;
      const lastChar = trailing[0][trailing[0].length - 1];
      bits += lastChar === '\t' ? '1' : '0';
    } else {
      bits += '0';
    }
  }

  if (!found) return null;
  return bitsToPayload(bits);
};

export const injectHoneytokens = (textContent, payload) => {
  const fullPayload = {
    d: payload.documentId,
    u: payload.userId,
    o: payload.organizationId,
    t: payload.timestamp || new Date().toISOString(),
  };

  const payloadBits = payloadToBits(fullPayload);

  // Each method layers on top of the previous one's output.
  const zwcResult = injectZwc(textContent, payloadBits);
  const homoglyphResult = injectHomoglyphs(zwcResult.modifiedText, fullPayload);
  const whitespaceResult = injectWhitespace(homoglyphResult.modifiedText, payloadBits);

  const combinedPayloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(fullPayload))
    .digest('hex');

  return {
    modifiedText: whitespaceResult.modifiedText,
    tokens: {
      zwcToken: zwcResult.zwcToken,
      zwcPositions: zwcResult.zwcPositions,
      homoglyphToken: homoglyphResult.homoglyphToken,
      homoglyphPositions: homoglyphResult.homoglyphPositions,
      whitespaceToken: whitespaceResult.whitespaceToken,
      whitespacePositions: whitespaceResult.whitespacePositions,
      combinedPayloadHash,
    },
  };
};

export const extractHoneytokens = (textContent) => {
  const results = [];

  const zwcPayload = extractZwc(textContent);
  if (zwcPayload) {
    results.push({ payload: zwcPayload, method: 'zwc', confidence: 0.9 });
  }

  const wsPayload = extractWhitespace(textContent);
  if (wsPayload) {
    results.push({ payload: wsPayload, method: 'whitespace', confidence: 0.7 });
  }

  // Homoglyph detection (cannot reconstruct full payload, but detects presence)
  const homoglyphs = extractHomoglyphs(textContent);
  if (homoglyphs && homoglyphs.length >= 5) {
    results.push({ payload: null, method: 'homoglyph', confidence: 0.5, positions: homoglyphs });
  }

  if (results.length === 0) {
    return { payload: null, method: 'none', confidence: 0 };
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results[0];
};

export const validateHoneytoken = (extractedPayload, documentId) => {
  if (!extractedPayload) {
    return { isValid: false, originalUser: null };
  }

  const isValid = extractedPayload.d === documentId;
  return {
    isValid,
    originalUser: extractedPayload.u || null,
    organizationId: extractedPayload.o || null,
    timestamp: extractedPayload.t || null,
  };
};
