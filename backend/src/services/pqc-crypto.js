// Hybrid PQC DEK wrapping, pure crypto (no DB/Vault): X25519 + ML-KEM-768 shared secrets are
// HKDF-combined into one AES-256-GCM wrap key, so an attacker must break BOTH. Audited @noble libs only.

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { x25519 } from '@noble/curves/ed25519.js';
import crypto from 'crypto';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const fromB64 = (s) => Buffer.from(s, 'base64');
const HKDF_INFO = Buffer.from('docloq-dek-wrap-v2');

// HKDF info binds a hash of (KEM ciphertext + ephemeral pubkey) so the key is tied to this
// exact wrap; hashed because Node caps HKDF `info` at 1024 bytes and the KEM ct alone is 1088.
const deriveWrapKey = (ssX25519, ssMlkem, salt, mlkemCt, x25519EphPub) => {
  const ikm = Buffer.concat([Buffer.from(ssX25519), Buffer.from(ssMlkem)]);
  const transcript = crypto.createHash('sha256')
    .update(Buffer.from(mlkemCt)).update(Buffer.from(x25519EphPub)).digest();
  const info = Buffer.concat([HKDF_INFO, transcript]);
  const key = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, 32));
  ikm.fill(0);
  return key;
};

// One keypair per org. Secret keys must be wrapped (Vault/master key) before storage. Base64 out.
export const generateHybridKeypair = () => {
  const kem = ml_kem768.keygen();
  const xSecret = x25519.utils.randomSecretKey();
  const xPublic = x25519.getPublicKey(xSecret);
  return {
    kemPublicKey: b64(kem.publicKey),
    kemSecretKey: b64(kem.secretKey),
    x25519Public: b64(xPublic),
    x25519Secret: b64(xSecret),
  };
};

// Wrap a 32-byte DEK against an org's PUBLIC keys; returns a base64 envelope.
export const hybridWrapDek = (dek, kemPublicKeyB64, x25519PublicB64) => {
  const { cipherText: mlkemCt, sharedSecret: ssMlkem } = ml_kem768.encapsulate(fromB64(kemPublicKeyB64));

  const ephSecret = x25519.utils.randomSecretKey();
  const ephPublic = x25519.getPublicKey(ephSecret);
  const ssX25519 = x25519.getSharedSecret(ephSecret, fromB64(x25519PublicB64));

  const salt = crypto.randomBytes(16);
  const wrapKey = deriveWrapKey(ssX25519, ssMlkem, salt, mlkemCt, ephPublic);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrapKey, iv, { authTagLength: 16 });
  const wrappedDek = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  // best-effort zeroing of secrets
  wrapKey.fill(0); Buffer.from(ssMlkem).fill(0); Buffer.from(ssX25519).fill(0); ephSecret.fill(0);

  return {
    mlkemCiphertext: b64(mlkemCt),
    x25519EphemeralPublic: b64(ephPublic),
    wrapSalt: salt.toString('base64'),
    wrappedDek: wrappedDek.toString('base64'),
    wrapIv: iv.toString('base64'),
    wrapTag: tag.toString('base64'),
  };
};

// Unwrap a DEK with the org's SECRET keys; throws on tamper (GCM tag mismatch) or wrong key.
export const hybridUnwrapDek = (envelope, kemSecretKeyB64, x25519SecretB64) => {
  const mlkemCt = fromB64(envelope.mlkemCiphertext);
  const ephPublic = fromB64(envelope.x25519EphemeralPublic);

  const ssMlkem = ml_kem768.decapsulate(mlkemCt, fromB64(kemSecretKeyB64));
  const ssX25519 = x25519.getSharedSecret(fromB64(x25519SecretB64), ephPublic);

  const wrapKey = deriveWrapKey(ssX25519, ssMlkem, fromB64(envelope.wrapSalt), mlkemCt, ephPublic);

  const decipher = crypto.createDecipheriv('aes-256-gcm', wrapKey, fromB64(envelope.wrapIv), { authTagLength: 16 });
  decipher.setAuthTag(fromB64(envelope.wrapTag));
  const dek = Buffer.concat([decipher.update(fromB64(envelope.wrappedDek)), decipher.final()]);

  wrapKey.fill(0); Buffer.from(ssMlkem).fill(0); Buffer.from(ssX25519).fill(0);
  return dek;
};
