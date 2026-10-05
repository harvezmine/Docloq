import QRCode from 'qrcode';
import crypto from 'crypto';
import { eq, and, ne } from 'drizzle-orm';
import uploadConfig from '../config/upload.config.js';
import { db } from '../db/index.js';
import { documentQrCodes } from '../db/schema.js';
import { saveQrCode } from './storage.service.js';

const { signingSecret, verificationBaseUrl, shortCodeLength, width, errorCorrectionLevel } =
  uploadConfig.qrCode;

// Boot-time validation: a weak/default QR signing secret means anyone can forge a
// valid QR signature. Refuse to run on the public default in production.
const DEFAULT_QR_SECRET = 'default-qr-secret-change-me';
if (!signingSecret || signingSecret === DEFAULT_QR_SECRET || signingSecret.length < 32) {
  const msg = 'QR_SIGNING_SECRET is weak/default/missing (need a random secret ≥32 chars)';
  if (process.env.NODE_ENV === 'production') throw new Error(`[QR] ${msg}`);
  console.warn(`[QR] ${msg} — acceptable in development only`);
}

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const generateShortCode = (length = shortCodeLength) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
};

const signPayload = (data) => {
  return crypto.createHmac('sha256', signingSecret).update(data).digest('hex');
};

export const generateVerificationQR = async (documentId, sha256Hash, organizationId) => {
  let shortCode = generateShortCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select({ id: documentQrCodes.id })
      .from(documentQrCodes)
      .where(eq(documentQrCodes.shortCode, shortCode))
      .limit(1);
    if (existing.length === 0) break;
    shortCode = generateShortCode();
    attempts++;
  }
  const timestamp = new Date().toISOString();

  const payload = {
    docId: documentId,
    hash: sha256Hash,
    org: organizationId,
    ts: timestamp,
    sc: shortCode,
  };

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString);

  const verificationUrl = `${verificationBaseUrl}?code=${shortCode}`;

  // QR carries ONLY the short URL: embedding the full signed payload made the code too
  // dense to scan from photos. Signature/payload are verified server-side via shortcode.
  const qrData = verificationUrl;

  const qrBuffer = await QRCode.toBuffer(qrData, {
    errorCorrectionLevel,
    width,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');

  return {
    qrBuffer,
    shortCode,
    payload,
    signature,
    verificationUrl,
    payloadHash,
  };
};

export const verifyQRPayload = (payload, signature) => {
  try {
    const payloadString = JSON.stringify(payload);
    const expected = signPayload(payloadString);

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );

    return {
      isValid,
      documentId: isValid ? payload.docId : null,
      hash: isValid ? payload.hash : null,
      shortCode: isValid ? payload.sc : null,
    };
  } catch (err) {
    console.error('[QR] Verification error:', err.message);
    return { isValid: false, documentId: null, hash: null };
  }
};

// Supersede a doc's active QR codes and issue a fresh one for the new version.
// Old rows are kept (status='superseded') as audit trail, pointing to the replacement.
export const supersedeAndRegenerateQR = async (doc, newVersion, newContentHash) => {
  try {
    const qrResult = await generateVerificationQR(doc.id, newContentHash, doc.organizationId);
    const qrFilename = `${doc.id}-qr-v${newVersion.versionNumber}.png`;
    await saveQrCode(qrResult.qrBuffer, qrFilename);

    const [newQr] = await db.insert(documentQrCodes).values({
      documentId: doc.id,
      versionId: newVersion.id,
      payloadHash: qrResult.payloadHash,
      signatureHash: qrResult.signature,
      verificationUrl: qrResult.verificationUrl,
      shortCode: qrResult.shortCode,
      qrImageS3Key: qrFilename,
      status: 'active',
      documentVersionNumber: newVersion.versionNumber,
      contentHashSnapshot: newContentHash,
      docNameSnapshot: doc.originalFilename,
      isActive: true,
    }).returning();

    await db.update(documentQrCodes)
      .set({
        status: 'superseded',
        isActive: false,
        supersededAt: new Date(),
        supersededByQrId: newQr.id,
      })
      .where(and(
        eq(documentQrCodes.documentId, doc.id),
        eq(documentQrCodes.status, 'active'),
        ne(documentQrCodes.id, newQr.id),
      ));

    return newQr;
  } catch (err) {
    console.error('[QR] supersedeAndRegenerateQR failed:', err.message);
    return null;
  }
};
