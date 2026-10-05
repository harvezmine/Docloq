// S3-compatible storage (Cloudflare R2 / MinIO / AWS S3) — swap providers via endpoint config.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import uploadConfig from '../config/upload.config.js';

let s3Client = null;

const getClient = () => {
  if (s3Client) return s3Client;

  const { endpoint, region, accessKey, secretKey, forcePathStyle } = uploadConfig.s3;

  s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle, // Required for MinIO and R2
  });

  console.log(`[S3] Client initialized → ${endpoint}`);
  return s3Client;
};

export const s3Upload = async (bucket, key, buffer, metadata = {}) => {
  const client = getClient();

  // S3 metadata values must be strings
  const s3Metadata = {};
  for (const [k, v] of Object.entries(metadata)) {
    s3Metadata[k] = String(v);
  }

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    Metadata: s3Metadata,
  }));

  return { key, bucket, size: buffer.length };
};

export const s3Download = async (bucket, key) => {
  const client = getClient();

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const s3Delete = async (bucket, key) => {
  const client = getClient();

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NoSuchKey') return false;
    throw err;
  }
};

export const s3Exists = async (bucket, key) => {
  const client = getClient();

  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};

export const s3GetPresignedUrl = async (bucket, key, expiresIn = 3600) => {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  // R2 max presigned URL expiry is 7 days (604800s)
  const clampedExpiry = Math.min(expiresIn, 604800);
  return getSignedUrl(client, command, { expiresIn: clampedExpiry });
};

// Move documents bucket → archive bucket (GDPR-compliant archival of old versions).
export const s3MoveToArchive = async (key) => {
  const client = getClient();
  const { documentsBucket, archiveBucket } = uploadConfig.s3;

  await client.send(new CopyObjectCommand({
    Bucket: archiveBucket,
    Key: key,
    CopySource: `/${documentsBucket}/${key}`,
  }));

  await client.send(new DeleteObjectCommand({
    Bucket: documentsBucket,
    Key: key,
  }));

  console.log(`[S3] Archived: ${documentsBucket}/${key} → ${archiveBucket}/${key}`);
  return { archivedKey: key };
};

export const s3RestoreFromArchive = async (key) => {
  const client = getClient();
  const { documentsBucket, archiveBucket } = uploadConfig.s3;

  await client.send(new CopyObjectCommand({
    Bucket: documentsBucket,
    Key: key,
    CopySource: `/${archiveBucket}/${key}`,
  }));

  await client.send(new DeleteObjectCommand({
    Bucket: archiveBucket,
    Key: key,
  }));

  console.log(`[S3] Restored: ${archiveBucket}/${key} → ${documentsBucket}/${key}`);
  return { restoredKey: key };
};
