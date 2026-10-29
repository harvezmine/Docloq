// gpt-image-1 → encrypt under the project DEK → R2. The blob is content: it is erased by the
// same paths that erase a text output, and it is NEVER served from a public URL.

import crypto from 'crypto';
import uploadConfig from '../config/upload.config.js';
import { uploadFile, downloadFile, deleteFile } from './storage.service.js';
import { encryptFile, decryptWithKey } from './encryption.service.js';
import { llm as openai, modelId, AI_NOT_CONFIGURED } from './llm-client.js';

const { ivLength } = uploadConfig.encryption;
export const IMAGE_MODEL = modelId(process.env.AI_IMAGE_MODEL || 'gpt-image-2');

/** Storage key — per project and per output, so erasure and tenancy are unambiguous. */
export const blobKeyFor = (projectId, outputId) => `ai-outputs/${projectId}/${outputId}.png.enc`;

export async function generateImage(prompt, { size = '1536x1024', quality = 'high' } = {}) {
  if (!openai) throw new Error(AI_NOT_CONFIGURED);
  const res = await openai.images.generate({ model: IMAGE_MODEL, prompt, size, quality });
  const b64 = res?.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image model tidak mengembalikan gambar');
  return Buffer.from(b64, 'base64');
}

/** Fresh IV per image. GCM IV reuse under one key is catastrophic. */
export function encryptImageBuffer(pngBuffer, plaintextKey) {
  const iv = crypto.randomBytes(ivLength).toString('base64');
  const { encryptedBuffer, authTag } = encryptFile(pngBuffer, plaintextKey, iv);
  return { cipher: encryptedBuffer, iv, authTag };
}

export function decryptImageRow(row, plaintextKey, cipherBuffer) {
  return decryptWithKey(cipherBuffer, plaintextKey, row.blobIv, row.blobAuthTag);
}

/** Encrypt + upload; returns the columns to persist on the output row. */
export async function storeImage(projectId, outputId, pngBuffer, plaintextKey) {
  const { cipher, iv, authTag } = encryptImageBuffer(pngBuffer, plaintextKey);
  const key = blobKeyFor(projectId, outputId);
  await uploadFile(cipher, key);
  return { blobKey: key, blobIv: iv, blobAuthTag: authTag, blobMime: 'image/png' };
}

/** Fetch + decrypt for the authed stream route. */
export async function readImage(row, plaintextKey) {
  const cipher = await downloadFile(row.blobKey);
  return decryptImageRow(row, plaintextKey, cipher);
}

/** Best-effort blob delete for erasure. Never throws into the caller's audit path. */
export async function deleteImageBlob(blobKey) {
  if (!blobKey) return;
  await deleteFile(blobKey).catch((e) => console.warn('[ai-image] blob delete gagal:', e.message));
}
