// HashiCorp Vault Transit engine — key material never leaves Vault process memory.

import Vault from 'node-vault';
import uploadConfig from '../config/upload.config.js';

let vaultClient = null;
let transitReady = false;

/** Safe to call multiple times — returns cached client after first init. */
export const initVault = async () => {
  if (vaultClient && transitReady) return vaultClient;

  const { addr, token } = uploadConfig.vault;

  vaultClient = Vault({
    apiVersion: 'v1',
    endpoint: addr,
    token,
  });

  try {
    const mounts = await vaultClient.mounts();
    if (!mounts['transit/']) {
      await vaultClient.mount({
        mount_point: 'transit',
        type: 'transit',
        description: 'DocLoq document encryption key management',
      });
      console.log('[Vault] Transit secrets engine enabled');
    }

    const keyName = uploadConfig.vault.transitKey;
    try {
      await vaultClient.read(`transit/keys/${keyName}`);
    } catch {
      await vaultClient.write(`transit/keys/${keyName}`, {
        type: 'aes256-gcm96',
        exportable: false,      // Key material can never be exported
        allow_plaintext_backup: false,
      });
      console.log(`[Vault] Created Transit key: ${keyName}`);
    }

    transitReady = true;
    console.log(`[Vault] Connected → ${addr} (Transit engine ready)`);
    return vaultClient;
  } catch (err) {
    console.error('[Vault] Initialization failed:', err.message);
    throw err;
  }
};

/**
 * Generates a DEK via Vault Transit — plaintext key is memory-only, never persisted;
 * ciphertext key goes to DB (envelope encryption: Vault KEK → DEK → document).
 */
export const generateDataKey = async (keyName) => {
  const client = await initVault();
  const name = keyName || uploadConfig.vault.transitKey;

  const result = await client.write(`transit/datakey/plaintext/${name}`, {
    bits: 256,
  });

  // Vault returns base64-encoded plaintext and vault-prefixed ciphertext
  const plaintextKey = Buffer.from(result.data.plaintext, 'base64');
  const encryptedKey = result.data.ciphertext; // e.g. "vault:v1:abc123..."

  return { plaintextKey, encryptedKey };
};

/** Decrypts a DEK via Vault Transit — used when reading a document. */
export const decryptDataKey = async (encryptedKey, keyName) => {
  const client = await initVault();
  const name = keyName || uploadConfig.vault.transitKey;

  const result = await client.write(`transit/decrypt/${name}`, {
    ciphertext: encryptedKey,
  });

  return Buffer.from(result.data.plaintext, 'base64');
};

/** Encrypts small payloads (e.g. keys) directly via Vault Transit. */
export const encryptWithTransit = async (plaintext, keyName) => {
  const client = await initVault();
  const name = keyName || uploadConfig.vault.transitKey;

  const b64 = Buffer.isBuffer(plaintext)
    ? plaintext.toString('base64')
    : Buffer.from(plaintext).toString('base64');

  const result = await client.write(`transit/encrypt/${name}`, {
    plaintext: b64,
  });

  return result.data.ciphertext;
};

/**
 * Crypto-shredding (GDPR Art 17): deletes a Transit key, permanently destroying
 * all data encrypted under it — the mechanism for right-to-be-forgotten.
 */
export const cryptoShredKey = async (keyName) => {
  const client = await initVault();

  // Keys are deletion-protected by default — must explicitly allow deletion first.
  await client.write(`transit/keys/${keyName}/config`, {
    deletion_allowed: true,
  });

  await client.delete(`transit/keys/${keyName}`);

  console.log(`[Vault] CRYPTO SHRED: Key "${keyName}" permanently destroyed`);
};

/** Rotates a Transit key — old versions stay valid for decryption, new encryptions use the latest. */
export const rotateKey = async (keyName) => {
  const client = await initVault();
  const name = keyName || uploadConfig.vault.transitKey;

  await client.write(`transit/keys/${name}/rotate`, {});
  console.log(`[Vault] Key rotated: ${name}`);
};

/** Per-document Transit key for fine-grained crypto shredding — deleting one document's key doesn't affect others. */
export const createDocumentKey = async (documentId) => {
  const client = await initVault();
  const keyName = `docloq-doc-${documentId}`;

  await client.write(`transit/keys/${keyName}`, {
    type: 'aes256-gcm96',
    exportable: false,
    allow_plaintext_backup: false,
  });

  const result = await client.write(`transit/datakey/plaintext/${keyName}`, {
    bits: 256,
  });

  return {
    keyName,
    plaintextKey: Buffer.from(result.data.plaintext, 'base64'),
    encryptedKey: result.data.ciphertext,
  };
};

export const healthCheck = async () => {
  try {
    const client = await initVault();
    const health = await client.health();
    return {
      available: true,
      transitReady,
      sealed: health.sealed,
      initialized: health.initialized,
    };
  } catch {
    return { available: false, transitReady: false };
  }
};
