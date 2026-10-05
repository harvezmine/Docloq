// Storage abstraction: local filesystem, MinIO, or Cloudflare R2 — switch via STORAGE_PROVIDER.

import fs from 'fs/promises';
import path from 'path';
import uploadConfig from '../config/upload.config.js';
import {
  s3Upload,
  s3Download,
  s3Delete,
  s3Exists,
  s3GetPresignedUrl,
} from './s3.service.js';

const provider = uploadConfig.storageProvider; // 'local' | 'minio' | 'r2'
const isS3Provider = provider === 'minio' || provider === 'r2';

const ensureDir = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

const localUpload = async (fileBuffer, key, metadata = {}) => {
  const destDir = uploadConfig.documentsDir;
  await ensureDir(destDir);

  const filePath = path.join(destDir, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, fileBuffer);

  if (Object.keys(metadata).length > 0) {
    const metaPath = `${filePath}.meta.json`;
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  return { key, bucket: 'local', size: fileBuffer.length };
};

const localDownload = async (key) => {
  const filePath = path.join(uploadConfig.documentsDir, key);
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`File not found: ${key}`);
    throw err;
  }
};

const localDelete = async (key) => {
  const filePath = path.join(uploadConfig.documentsDir, key);
  try {
    await fs.unlink(filePath);
    try { await fs.unlink(`${filePath}.meta.json`); } catch { /* ignore */ }
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
};

const localGetFileUrl = (key) => {
  return path.join(uploadConfig.documentsDir, key);
};

const localExists = async (key) => {
  const filePath = path.join(uploadConfig.documentsDir, key);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const minioUpload = async (fileBuffer, key, metadata = {}) => {
  const result = await s3Upload(uploadConfig.s3.documentsBucket, key, fileBuffer, metadata);

  // Also upload sidecar .meta.json (needed for authTag retrieval during download)
  if (Object.keys(metadata).length > 0) {
    const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    await s3Upload(uploadConfig.s3.documentsBucket, `${key}.meta.json`, metaBuffer, {
      contentType: 'application/json',
    });
  }

  return result;
};

const minioDownload = async (key) => {
  return s3Download(uploadConfig.s3.documentsBucket, key);
};

const minioDelete = async (key) => {
  return s3Delete(uploadConfig.s3.documentsBucket, key);
};

const minioGetFileUrl = async (key, expiresIn = 3600) => {
  return s3GetPresignedUrl(uploadConfig.s3.documentsBucket, key, expiresIn);
};

const minioExists = async (key) => {
  return s3Exists(uploadConfig.s3.documentsBucket, key);
};

export const uploadFile = async (fileBuffer, key, metadata = {}) => {
  if (isS3Provider) return minioUpload(fileBuffer, key, metadata);
  return localUpload(fileBuffer, key, metadata);
};

export const downloadFile = async (key) => {
  if (isS3Provider) return minioDownload(key);
  return localDownload(key);
};

export const deleteFile = async (key) => {
  if (isS3Provider) return minioDelete(key);
  return localDelete(key);
};

// S3 providers return a presigned URL (Promise); local returns an absolute file path.
export const getFileUrl = (key, expiresIn = 3600) => {
  if (isS3Provider) return minioGetFileUrl(key, expiresIn);
  return localGetFileUrl(key);
};

export const fileExists = async (key) => {
  if (isS3Provider) return minioExists(key);
  return localExists(key);
};

// Temp storage is always local disk regardless of provider.
export const saveToTemp = async (fileBuffer, sessionId, ext) => {
  const tempDir = uploadConfig.tempDir;
  await ensureDir(tempDir);

  const tempFilename = `${sessionId}${ext}`;
  const tempPath = path.join(tempDir, tempFilename);
  await fs.writeFile(tempPath, fileBuffer);

  return { tempPath, sessionId };
};

export const saveQrCode = async (qrBuffer, filename) => {
  if (isS3Provider) {
    await s3Upload(uploadConfig.s3.qrBucket, filename, qrBuffer, {
      contentType: 'image/png',
    });
    return filename;
  }

  const qrDir = uploadConfig.qrCodesDir;
  await ensureDir(qrDir);
  const filePath = path.join(qrDir, filename);
  await fs.writeFile(filePath, qrBuffer);
  return filename;
};

export const initStorageDirs = async () => {
  // Always create local dirs (needed for temp at minimum)
  await ensureDir(uploadConfig.storagePath);
  await ensureDir(uploadConfig.tempDir);

  if (provider === 'local') {
    await ensureDir(uploadConfig.documentsDir);
    await ensureDir(uploadConfig.qrCodesDir);
    await ensureDir(uploadConfig.thumbnailsDir);
    console.log('[Storage] Provider: local (filesystem)');
  } else {
    console.log(`[Storage] Provider: ${provider} (S3-compatible → ${uploadConfig.s3.endpoint})`);
  }
};

// Runs on import.
initStorageDirs().catch((err) =>
  console.error('[Storage] Failed to initialise storage directories:', err.message),
);
