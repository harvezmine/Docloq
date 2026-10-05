// DB/Vault layer over pqc-crypto.js. Opt-in via PQC_WRAP_ENABLED; each documentVersions row
// records its keyWrapVersion so v1/v2 coexist. Private keys exist briefly in app memory during use.

import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pqcKeypairs } from '../db/schema.js';
import uploadConfig from '../config/upload.config.js';
import { wrapSecret, unwrapSecret } from './encryption.service.js';
import { generateHybridKeypair, hybridWrapDek, hybridUnwrapDek } from './pqc-crypto.js';

const { keyLength, ivLength, saltLength } = uploadConfig.encryption;

export const isPqcEnabled = () => process.env.PQC_WRAP_ENABLED === 'true';

// Get (or lazily create) the org's active keypair. Private keys are wrapped before storage and never returned.
export const ensureActiveKeypair = async (organizationId) => {
  const [existing] = await db
    .select()
    .from(pqcKeypairs)
    .where(and(eq(pqcKeypairs.organizationId, organizationId), eq(pqcKeypairs.isActive, true)))
    .limit(1);
  if (existing) {
    return { id: existing.id, kemPublicKey: existing.kemPublicKey, x25519Public: existing.x25519Public };
  }

  const kp = generateHybridKeypair();
  const kemPrivateKeyWrapped = await wrapSecret(Buffer.from(kp.kemSecretKey, 'base64'));
  const x25519PrivateWrapped = await wrapSecret(Buffer.from(kp.x25519Secret, 'base64'));

  const [row] = await db.insert(pqcKeypairs).values({
    organizationId,
    kemPublicKey: kp.kemPublicKey,
    kemPrivateKeyWrapped,
    x25519Public: kp.x25519Public,
    x25519PrivateWrapped,
    isActive: true,
  }).returning();

  return { id: row.id, kemPublicKey: row.kemPublicKey, x25519Public: row.x25519Public };
};

// New DEK wrapped via the hybrid KEM; shape mirrors encryption.generateDocumentKey()
// so the upload pipeline stores it uniformly.
export const createHybridDocumentKey = async (organizationId) => {
  const keypair = await ensureActiveKeypair(organizationId);

  const plaintextKey = crypto.randomBytes(keyLength); // DEK (encrypts the file)
  const iv = crypto.randomBytes(ivLength);            // file IV
  const salt = crypto.randomBytes(saltLength);

  const pqcEnvelope = hybridWrapDek(plaintextKey, keypair.kemPublicKey, keypair.x25519Public);

  return {
    encryptedKey: 'pqc_v2_hybrid',   // sentinel — DEK lives in pqcEnvelope, not here
    plaintextKey,
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    keyWrapVersion: 'v2_hybrid_pqc',
    pqcKeypairId: keypair.id,
    pqcEnvelope,
  };
};

// Unwrap the DEK for a v2 version; private keys are unwrapped in memory only. Throws on tamper/wrong key.
export const unwrapHybridDocumentKey = async (version) => {
  if (!version?.pqcKeypairId || !version?.pqcEnvelope) {
    throw new Error('Missing PQC keypair reference or envelope for v2 document');
  }
  const [kp] = await db.select().from(pqcKeypairs).where(eq(pqcKeypairs.id, version.pqcKeypairId)).limit(1);
  if (!kp) throw new Error('PQC keypair not found for document');

  const kemSecret = await unwrapSecret(kp.kemPrivateKeyWrapped);
  const x25519Secret = await unwrapSecret(kp.x25519PrivateWrapped);

  try {
    return hybridUnwrapDek(
      version.pqcEnvelope,
      Buffer.from(kemSecret).toString('base64'),
      Buffer.from(x25519Secret).toString('base64'),
    );
  } finally {
    Buffer.from(kemSecret).fill(0);
    Buffer.from(x25519Secret).fill(0);
  }
};
