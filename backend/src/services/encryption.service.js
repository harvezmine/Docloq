// Envelope encryption (AES-256-GCM). Key provider is "local" (env var, dev)
// or "vault" (HashiCorp Transit, prod), switched via KEY_PROVIDER.

import crypto from 'crypto';
import uploadConfig from '../config/upload.config.js';

const { algorithm, keyLength, ivLength, authTagLength } = uploadConfig.encryption;
const keyProvider = uploadConfig.keyProvider; // 'local' | 'vault'

// Lazy-load vault service only when needed to avoid connection errors in local mode
let vaultService = null;
const getVaultService = async () => {
  if (!vaultService) {
    vaultService = await import('./vault.service.js');
  }
  return vaultService;
};

// Ephemeral master key when env var is missing — data undecryptable after restart
// unless ENCRYPTION_MASTER_KEY is set.
let _ephemeralMasterKey = null;

const getMasterKey = () => {
  const hex = uploadConfig.encryption.masterKey;
  if (!hex) {
    // Refuse to run on an ephemeral key in production — fail loudly instead of
    // silently losing data on restart.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_MASTER_KEY must be set in production (refusing ephemeral key)');
    }
    if (!_ephemeralMasterKey) {
      _ephemeralMasterKey = crypto.randomBytes(32);
      console.warn('[Encryption] ENCRYPTION_MASTER_KEY not set — using random ephemeral key (DEV ONLY, data lost on restart)');
    }
    return _ephemeralMasterKey;
  }
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
};

const localGenerateDocumentKey = () => {
  const plaintextKey = crypto.randomBytes(keyLength);
  const iv = crypto.randomBytes(ivLength);
  const salt = crypto.randomBytes(uploadConfig.encryption.saltLength);
  const keyId = crypto.randomUUID();

  const masterKey = getMasterKey();
  const masterIv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, masterKey, masterIv, {
    authTagLength,
  });
  const encPart1 = cipher.update(plaintextKey);
  const encPart2 = cipher.final();
  const tag = cipher.getAuthTag();

  const encryptedKey = Buffer.concat([masterIv, tag, encPart1, encPart2]).toString('base64');

  return {
    encryptedKey,
    plaintextKey,
    keyId,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  };
};

const localDecryptDocumentKey = (encryptedKeyBase64) => {
  const masterKey = getMasterKey();
  const raw = Buffer.from(encryptedKeyBase64, 'base64');

  const masterIv = raw.subarray(0, ivLength);
  const tag = raw.subarray(ivLength, ivLength + authTagLength);
  const ciphertext = raw.subarray(ivLength + authTagLength);

  const decipher = crypto.createDecipheriv(algorithm, masterKey, masterIv, {
    authTagLength,
  });
  decipher.setAuthTag(tag);

  const part1 = decipher.update(ciphertext);
  const part2 = decipher.final();

  return Buffer.concat([part1, part2]);
};

const vaultGenerateDocumentKey = async () => {
  const vault = await getVaultService();
  const { plaintextKey, encryptedKey } = await vault.generateDataKey();

  const iv = crypto.randomBytes(ivLength);
  const salt = crypto.randomBytes(uploadConfig.encryption.saltLength);
  const keyId = crypto.randomUUID();

  return {
    encryptedKey,      // Vault ciphertext (e.g. "vault:v1:abc...")
    plaintextKey,      // 32-byte Buffer — use in memory only
    keyId,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  };
};

const vaultDecryptDocumentKey = async (encryptedKey) => {
  const vault = await getVaultService();
  return vault.decryptDataKey(encryptedKey);
};

// Local fallback during a Vault outage is a security DOWNGRADE (local master key
// instead of the HSM-grade Vault KEK) — must be opted in; default is to fail closed.
const allowLocalFallback = process.env.ALLOW_LOCAL_KEY_FALLBACK === 'true';

export const generateDocumentKey = async () => {
  if (keyProvider === 'vault') {
    try {
      return await vaultGenerateDocumentKey();
    } catch (err) {
      if (!allowLocalFallback) {
        // No silent downgrade — surface the failure so the upload is retried/queued.
        throw new Error(`Vault unavailable and local-key fallback disabled (set ALLOW_LOCAL_KEY_FALLBACK=true to allow): ${err.message}`);
      }
      console.warn('[Encryption] Vault unavailable, using local fallback (ALLOW_LOCAL_KEY_FALLBACK=true):', err.message);
      const local = localGenerateDocumentKey();
      return { ...local, fallback: 'local', vaultUnavailable: true };
    }
  }
  return localGenerateDocumentKey();
};

export const decryptDocumentKey = async (encryptedKey) => {
  // Dispatch on the ciphertext's actual format (vault: prefix vs raw base64), not the
  // env var — so a key wrapped via local fallback still decrypts after Vault is restored.
  if (isVaultWrappedKey(encryptedKey)) {
    return vaultDecryptDocumentKey(encryptedKey);
  }
  return localDecryptDocumentKey(encryptedKey);
};

/** A Vault Transit ciphertext looks like "vault:v1:base64..." */
export const isVaultWrappedKey = (encryptedKey) =>
  typeof encryptedKey === 'string' && encryptedKey.startsWith('vault:');

// Wraps secrets (e.g. PQC private keys) under the same trust model as the DEK:
// Vault Transit when configured, else local master key; unwrap dispatches on the "vault:" prefix.

const localWrapSecret = (plaintext) => {
  const masterKey = getMasterKey();
  const masterIv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, masterKey, masterIv, { authTagLength });
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([masterIv, tag, ct]).toString('base64');
};

const localUnwrapSecret = (wrappedBase64) => {
  const masterKey = getMasterKey();
  const raw = Buffer.from(wrappedBase64, 'base64');
  const masterIv = raw.subarray(0, ivLength);
  const tag = raw.subarray(ivLength, ivLength + authTagLength);
  const ct = raw.subarray(ivLength + authTagLength);
  const decipher = crypto.createDecipheriv(algorithm, masterKey, masterIv, { authTagLength });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
};

/** Wrap arbitrary secret bytes (e.g. a PQC private key) for storage. */
export const wrapSecret = async (plaintext) => {
  if (keyProvider === 'vault') {
    try {
      const vault = await getVaultService();
      return await vault.encryptWithTransit(plaintext);
    } catch (err) {
      if (!allowLocalFallback) {
        throw new Error(`Vault unavailable for secret wrap (set ALLOW_LOCAL_KEY_FALLBACK=true to allow): ${err.message}`);
      }
      console.warn('[Encryption] Vault unavailable, wrapping secret with local key:', err.message);
    }
  }
  return localWrapSecret(Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext));
};

/** Unwrap a secret wrapped by wrapSecret. Dispatches on ciphertext format. */
export const unwrapSecret = async (wrapped) => {
  if (isVaultWrappedKey(wrapped)) {
    const vault = await getVaultService();
    return vault.decryptDataKey(wrapped);
  }
  return localUnwrapSecret(wrapped);
};

export const encryptFile = (fileBuffer, plaintextKey, ivBase64) => {
  const iv = Buffer.from(ivBase64, 'base64');
  const cipher = crypto.createCipheriv(algorithm, plaintextKey, iv, {
    authTagLength,
  });

  const encPart1 = cipher.update(fileBuffer);
  const encPart2 = cipher.final();
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    encryptedBuffer: Buffer.concat([encPart1, encPart2]),
    authTag,
  };
};

/** Resolve a version's plaintext DEK. Throws once crypto-shred has nulled encryptionKeyId —
    that throw is what makes chunk erasure automatic. */
export const unwrapVersionKey = async (version) => {
  if (version?.keyWrapVersion === 'v2_hybrid_pqc') {
    const { unwrapHybridDocumentKey } = await import('./pqc.service.js');
    return unwrapHybridDocumentKey(version);
  }
  if (!version?.encryptionKeyId) {
    throw new Error('Document key unavailable (destroyed by crypto-shred or never set)');
  }
  return decryptDocumentKey(version.encryptionKeyId);
};

/** Decrypt with an ALREADY-unwrapped DEK. Use when unwrapping once and decrypting many
    payloads under that key (per-chunk decryption); decryptFile unwraps on every call. */
export const decryptWithKey = (encryptedBuffer, plaintextKey, ivBase64, authTagBase64) => {
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(algorithm, plaintextKey, iv, {
    authTagLength,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};

export const decryptFile = async (encryptedBuffer, encryptedKey, ivBase64, authTagBase64, version = null) => {
  // v2_hybrid_pqc → unwrap DEK via hybrid KEM (lazy import avoids circular dependency); v1 → envelope path.
  // The v1 branch takes encryptedKey positionally rather than reading it off version, because
  // existing callers pass version = null.
  const plaintextKey = (version && version.keyWrapVersion === 'v2_hybrid_pqc')
    ? await unwrapVersionKey(version)
    : await decryptDocumentKey(encryptedKey);
  return decryptWithKey(encryptedBuffer, plaintextKey, ivBase64, authTagBase64);
};
