// Per-download invisible watermarking encoding the downloader's identity.
// Uses U+2060-U+2063, non-overlapping with honeytoken ZWC chars (U+200B-FEFF).

import crypto from 'crypto';
import uploadConfig from '../config/upload.config.js';

const { chars: wmChars, positionCount } = uploadConfig.downloadWatermark;

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

// 4 invisible chars encode 2 bits at a time (same approach as honeytoken ZWC).
const bitsToInvisible = (bits) => {
  let result = '';
  for (let i = 0; i < bits.length; i += 2) {
    const pair = bits.substring(i, i + 2).padEnd(2, '0');
    const idx = parseInt(pair, 2); // 0-3
    result += wmChars[idx];
  }
  return result;
};

const invisibleToBits = (invisible) => {
  let bits = '';
  for (const ch of invisible) {
    const idx = wmChars.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(2, '0');
  }
  return bits;
};

export const injectDownloadWatermark = (textContent, payload) => {
  const payloadBits = payloadToBits(payload);
  const invisibleString = bitsToInvisible(payloadBits);

  const chunkSize = Math.ceil(invisibleString.length / positionCount);
  const chunks = [];
  for (let i = 0; i < invisibleString.length; i += chunkSize) {
    chunks.push(invisibleString.substring(i, i + chunkSize));
  }

  const textLen = textContent.length;
  if (textLen === 0) {
    return {
      modifiedText: invisibleString + textContent,
      watermarkToken: crypto.createHash('sha256').update(invisibleString).digest('hex'),
      positions: [0],
    };
  }

  // Random per-chunk positions (crypto.randomInt) make every download unique, even for
  // the same document+user. Sorted ascending so inserts run start-to-end with an offset.
  const rawPositions = [];
  for (let i = 0; i < chunks.length; i++) {
    rawPositions.push(crypto.randomInt(0, textLen));
  }
  rawPositions.sort((a, b) => a - b);

  let modifiedText = textContent;
  let offset = 0;
  const finalPositions = [];

  for (let i = 0; i < chunks.length; i++) {
    const pos = rawPositions[i] + offset;
    modifiedText = modifiedText.slice(0, pos) + chunks[i] + modifiedText.slice(pos);
    finalPositions.push(rawPositions[i]); // pre-offset position
    offset += chunks[i].length;
  }

  const watermarkToken = crypto
    .createHash('sha256')
    .update(JSON.stringify({ invisible: invisibleString, positions: finalPositions }))
    .digest('hex');

  return {
    modifiedText,
    watermarkToken,
    positions: finalPositions,
  };
};

export const extractDownloadWatermark = (textContent) => {
  const wmRegex = /[\u2060-\u2063]+/g;
  let allInvisible = '';
  const positions = [];
  let match;

  while ((match = wmRegex.exec(textContent)) !== null) {
    allInvisible += match[0];
    positions.push(match.index);
  }

  if (!allInvisible || allInvisible.length < 4) {
    return { payload: null, confidence: 0, positions: [] };
  }

  const bits = invisibleToBits(allInvisible);
  const payload = bitsToPayload(bits);

  if (!payload) {
    return { payload: null, confidence: 0.2, positions };
  }

  const hasWatermarkId = !!payload.w;
  const hasDocId = !!payload.d;
  const hasUserId = !!payload.u;
  const hasTimestamp = !!payload.t;

  let confidence = 0.5;
  if (hasWatermarkId) confidence += 0.15;
  if (hasDocId) confidence += 0.1;
  if (hasUserId) confidence += 0.15;
  if (hasTimestamp) confidence += 0.1;

  return {
    payload,
    confidence: Math.min(confidence, 1),
    positions,
  };
};

export const hashPayload = (payload) => {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};
