// Upload pipeline orchestrator: validate → scan → extract → hash → encrypt → store → record.

import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { eq } from 'drizzle-orm';

import uploadConfig from '../config/upload.config.js';
import { db } from '../db/index.js';
import {
  documents,
  documentVersions,
  documentHoneytokens,
  documentQrCodes,
  temporaryUploads,
  securityEvents,
} from '../db/schema.js';

import { appendAuditEntry } from './audit.service.js';
import { saveToTemp, uploadFile } from './storage.service.js';
import { generateDocumentKey, encryptFile } from './encryption.service.js';
import { isPqcEnabled, createHybridDocumentKey } from './pqc.service.js';
import {
  generateSHA256,
  normalizeText,
  generateDocumentDNA,
  checkDuplicate,
} from './hash.service.js';
import { injectHoneytokens } from './honeytoken.service.js';
import { generateVerificationQR } from './qrcode.service.js';
import { scanFile } from './scanner.service.js';
import { secureWipe } from './secure-wipe.service.js';
import { saveQrCode } from './storage.service.js';
import { indexDocument } from './qdrant.service.js';

const log = (step, msg) => console.log(`[Upload Pipeline] Step ${step}: ${msg}`);

// Returns extracted text, or null when extraction isn't possible (caller hashes raw bytes).
export const extractText = async (buffer, mimeType) => {
  const category = uploadConfig.mimeToCategory[mimeType] || 'unknown';

  switch (category) {
    case 'pdf': {
      // Use pdfjs (shared with ocr.service) — single PDF lib avoids worker version skew.
      try {
        const { parsePdf } = await import('./ocr.service.js');
        const data = await parsePdf(buffer);
        return data.text || '';
      } catch (err) {
        console.warn('[Pipeline] PDF text extraction failed, falling back to raw hash:', err.message);
        return null; // Will hash raw buffer instead
      }
    }

    case 'text':
      // plain / csv / markdown
      return buffer.toString('utf-8');

    case 'office':
      return extractOfficeText(buffer, mimeType);

    case 'spreadsheet':
      return extractSpreadsheetText(buffer);

    case 'presentation':
      return extractPresentationText(buffer);

    case 'image': {
      try {
        const { processImageForAI } = await import('./ocr.service.js');
        const result = await processImageForAI(buffer);
        if (result.text && result.text.length > 0) {
          console.log(`[Pipeline] OCR extracted ${result.text.length} chars (${result.confidence}% confidence)`);
          return result.text;
        }
        return null;
      } catch (err) {
        console.warn('[Pipeline] OCR extraction failed:', err.message);
        return null;
      }
    }

    default:
      return null;
  }
};

async function extractOfficeText(buffer, mimeType) {
  try {
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    }
    if (mimeType.includes('opendocument.text')) {
      return extractOdfText(buffer); // ODT — text:p nodes in content.xml
    }
    if (mimeType.includes('rtf')) {
      return extractRtfText(buffer);
    }
    return null;
  } catch (err) {
    console.warn('[Pipeline] office extraction failed:', err.message);
    return null;
  }
}

async function extractSpreadsheetText(buffer) {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const parts = wb.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return csv.trim() ? `# ${name}\n${csv}` : '';
    }).filter(Boolean);
    return parts.join('\n\n') || null;
  } catch (err) {
    console.warn('[Pipeline] spreadsheet extraction failed:', err.message);
    return null;
  }
}

async function extractPresentationText(buffer) {
  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f) || /^ppt\/notesSlides\//.test(f)
        || /content\.xml$/.test(f), // ODP uses content.xml
    ).sort();
    const texts = [];
    for (const f of slideFiles) {
      const xml = await zip.files[f].async('string');
      texts.push(extractTextFromXml(xml));
    }
    const out = texts.filter(Boolean).join('\n\n').trim();
    return out || null;
  } catch (err) {
    console.warn('[Pipeline] presentation extraction failed:', err.message);
    return null;
  }
}

async function extractOdfText(buffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const content = zip.files['content.xml'];
  if (!content) return null;
  const xml = await content.async('string');
  return extractTextFromXml(xml) || null;
}

// Inserts spaces at tag boundaries so words across runs don't fuse.
function extractTextFromXml(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function extractRtfText(buffer) {
  const rtf = buffer.toString('latin1');
  if (!rtf.startsWith('{\\rtf')) return null;
  const text = rtf
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')      // hex-encoded chars → space
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')      // control words
    .replace(/[{}]/g, '')                      // group braces
    .replace(/\\\r?\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text || null;
}

export const uploadPipeline = async (file, userId, organizationId, folderId = null) => {
  const sessionId = randomUUID();
  const warnings = [];
  let tempPath = null;

  try {
    log(1, 'Validating file...');

    if (!file || !file.buffer) {
      throw new Error('No file buffer provided');
    }

    // Reject empty files explicitly (Buffer.alloc(0) is truthy, so !file.buffer misses it).
    if (file.size === 0 || file.buffer.length === 0) {
      throw new Error('File kosong tidak diizinkan');
    }

    if (file.size > uploadConfig.maxFileSize) {
      throw new Error(`File exceeds maximum size of ${uploadConfig.maxFileSize / (1024 * 1024)} MB`);
    }

    if (!uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (detectedType) {
      // Detected binary signature must be in the whitelist AND match the claimed MIME
      if (!uploadConfig.allowedMimeTypes.includes(detectedType.mime)) {
        throw new Error(`Detected file type (${detectedType.mime}) does not match allowed types`);
      }
      if (detectedType.mime !== file.mimetype) {
        throw new Error(`File content (${detectedType.mime}) does not match declared type (${file.mimetype})`);
      }
    } else {
      // No recognizable magic bytes. Only text-based formats legitimately lack a signature.
      // Anything else (e.g. a renamed .exe / script) is rejected to prevent extension spoofing.
      const signatureless = ['text/plain', 'text/csv'];
      if (!signatureless.includes(file.mimetype)) {
        throw new Error('File content could not be verified — unrecognized or spoofed file type');
      }
    }

    log(2, 'Saving to temp storage...');
    const ext = path.extname(file.originalname) || '.bin';
    const tempResult = await saveToTemp(file.buffer, sessionId, ext);
    tempPath = tempResult.tempPath;

    await db.insert(temporaryUploads).values({
      uploadSessionId: sessionId,
      userId,
      organizationId,
      originalFilename: file.originalname,
      tempFilePath: tempPath,
      fileSize: file.size,
      mimeType: file.mimetype,
      status: 'scanning',
      expiresAt: new Date(Date.now() + uploadConfig.tempUpload.expirationMinutes * 60 * 1000),
    });

    log(3, 'Scanning for malware...');
    const scanResult = await scanFile(tempPath);

    if (!scanResult.isClean) {
      await secureWipe(tempPath);
      tempPath = null;
      // Record the malware detection as a security event before aborting.
      try {
        await db.insert(securityEvents).values({
          organizationId,
          userId,
          eventType: 'malware_detected',
          severity: 'critical',
          description: `Malware detected in upload: ${scanResult.threatName}`,
          details: { filename: file.originalname, threat: scanResult.threatName },
        });
      } catch (e) { console.warn('[Pipeline] securityEvent log failed:', e.message); }
      throw new Error(`File rejected: malware detected (${scanResult.threatName})`);
    }

    if (scanResult.skipped) {
      warnings.push('Malware scan was skipped (scanner disabled or unavailable)');
    }

    log(4, 'Extracting text content...');
    await updateTempStatus(sessionId, 'processing', 'extraction');
    const textContent = await extractText(file.buffer, file.mimetype);
    const hasText = textContent !== null && textContent.length > 0;

    if (!hasText) {
      warnings.push('Text extraction not available for this file type — hashing raw bytes');
    }

    log(5, 'Normalizing text...');
    await updateTempStatus(sessionId, 'processing', 'normalization');
    const normalizedText = hasText ? normalizeText(textContent) : null;

    log(6, 'Generating Document DNA...');
    await updateTempStatus(sessionId, 'processing', 'hashing');

    const hashInput = normalizedText || file.buffer;
    const dna = generateDocumentDNA(
      typeof hashInput === 'string' ? hashInput : hashInput.toString('base64'),
    );

    // Always compute a raw-file SHA-256 for the version record
    const rawFileSha256 = generateSHA256(file.buffer);

    // ──────────────────────────────────────────────
    // STEP 7: DUPLICATE CHECK
    // ──────────────────────────────────────────────
    log(7, 'Checking for duplicates...');
    const dupResult = await checkDuplicate(dna.sha256, dna.ssdeep, dna.simhash);

    if (dupResult.isExact) {
      warnings.push(`Exact duplicate found: ${dupResult.matches.filter((m) => m.matchType === 'exact').map((m) => m.filename).join(', ')}`);
    }
    if (dupResult.isSimilar) {
      warnings.push(`Similar documents found: ${dupResult.matches.filter((m) => m.matchType === 'similar').map((m) => `${m.filename} (${m.similarity}%)`).join(', ')}`);
    }

    // ──────────────────────────────────────────────
    // STEP 8: HONEYTOKEN
    // ──────────────────────────────────────────────
    log(8, 'Injecting honeytokens...');
    await updateTempStatus(sessionId, 'processing', 'honeytoken');

    let honeytokenResult = null;
    // Only inject into text-based content that we were able to extract
    if (hasText && normalizedText) {
      const docId = randomUUID(); // Pre-generate document ID
      honeytokenResult = {
        docId,
        ...injectHoneytokens(textContent, {
          documentId: docId,
          userId,
          organizationId,
        }),
      };
    }

    // The document ID — either from honeytoken step or newly generated
    const documentId = honeytokenResult?.docId || randomUUID();

    // ──────────────────────────────────────────────
    // STEP 9: QR CODE
    // ──────────────────────────────────────────────
    log(9, 'Generating verification QR code...');
    await updateTempStatus(sessionId, 'processing', 'qr');

    const qrResult = await generateVerificationQR(documentId, dna.sha256, organizationId);
    const qrFilename = `${documentId}-qr.png`;
    await saveQrCode(qrResult.qrBuffer, qrFilename);

    // ──────────────────────────────────────────────
    // STEP 10: ENCRYPT
    // ──────────────────────────────────────────────
    log(10, 'Encrypting file...');
    await updateTempStatus(sessionId, 'processing', 'encryption');

    // Encrypt the ORIGINAL file buffer by default. Only substitute the
    // honeytoken-modified text for genuine PLAIN-TEXT files (.txt/.csv/.md) where
    // "text in == file out". For binary formats (DOCX/PDF/XLSX/PPTX/images) the
    // file MUST stay intact, otherwise the served document is no longer a valid
    // DOCX/PDF/image and OnlyOffice / image viewers cannot open it. (The honeytoken
    // RECORD is still stored below for forensics; per-download invisible
    // watermarking handles binary leak-tracing at download time.)
    const PLAIN_TEXT_MIMES = ['text/plain', 'text/csv', 'text/markdown'];
    const isPlainText = PLAIN_TEXT_MIMES.includes(file.mimetype);
    let bufferToEncrypt = file.buffer;
    if (isPlainText && honeytokenResult && honeytokenResult.modifiedText) {
      bufferToEncrypt = Buffer.from(honeytokenResult.modifiedText, 'utf-8');
      log(10, 'Encrypting honeytoken-modified text content (plain-text file)');
    }

    // Key wrapping: hybrid PQC (v2) when enabled, else standard envelope (v1).
    // PQC failure NEVER breaks an upload — fall back to v1 so behavior stays normal.
    let keyData;
    if (isPqcEnabled()) {
      try {
        keyData = await createHybridDocumentKey(organizationId);
        log(10, 'Wrapping document key with hybrid PQC (X25519 + ML-KEM-768)');
      } catch (err) {
        console.warn('[PQC] hybrid wrap failed, falling back to v1_vault:', err.message);
        warnings.push('PQC hybrid wrap failed — fell back to standard key wrapping');
        keyData = await generateDocumentKey();
      }
    } else {
      keyData = await generateDocumentKey();
    }
    if (keyData.vaultUnavailable) {
      warnings.push('Vault unavailable — document encrypted with local key provider as fallback');
    }
    const encResult = encryptFile(bufferToEncrypt, keyData.plaintextKey, keyData.iv);

    // ──────────────────────────────────────────────
    // STEP 11: STORE — persist encrypted file
    // ──────────────────────────────────────────────
    log(11, 'Storing encrypted file...');
    const storageKey = `${documentId}/${Date.now()}${ext}.enc`;
    const storageResult = await uploadFile(encResult.encryptedBuffer, storageKey, {
      documentId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      authTag: encResult.authTag,
    });

    // ──────────────────────────────────────────────
    // STEP 12: DATABASE — insert all records
    // ──────────────────────────────────────────────
    log(12, 'Writing to database...');
    await updateTempStatus(sessionId, 'processing', 'database');

    // 12a. Insert document
    const [newDoc] = await db.insert(documents).values({
      id: documentId,
      organizationId,
      folderId: folderId || null,
      filename: storageKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      ownerId: userId,
      status: 'active',
      contentHash: dna.sha256,
      ssdeepHash: dna.ssdeep,
      simHash: dna.simhash,
      versionCount: 1,
    }).returning();

    // 12b. Insert document version
    const [newVersion] = await db.insert(documentVersions).values({
      documentId,
      versionNumber: 1,
      s3Key: storageKey,            // Works for local storage too
      s3Bucket: storageResult.bucket,
      fileSize: file.size,
      encryptionKeyId: keyData.encryptedKey, // base64-encoded encrypted document key (v1) or sentinel (v2)
      encryptionIv: keyData.iv,
      encryptionSalt: keyData.salt,
      keyWrapVersion: keyData.keyWrapVersion || 'v1_vault',
      pqcKeypairId: keyData.pqcKeypairId || null,
      pqcEnvelope: keyData.pqcEnvelope || null,
      sha256Hash: rawFileSha256,
      bodyHash: dna.sha256,
      archiveStatus: 'active',
      createdBy: userId,
      changeNote: 'Initial upload',
    }).returning();

    // 12c. Update document currentVersionId
    await db.update(documents)
      .set({ currentVersionId: newVersion.id })
      .where(eq(documents.id, documentId));

    // 12d. Insert honeytoken record (if applicable)
    if (honeytokenResult) {
      await db.insert(documentHoneytokens).values({
        documentId,
        versionId: newVersion.id,
        zwcToken: honeytokenResult.tokens.zwcToken,
        zwcPositions: honeytokenResult.tokens.zwcPositions,
        homoglyphToken: honeytokenResult.tokens.homoglyphToken,
        homoglyphPositions: honeytokenResult.tokens.homoglyphPositions,
        whitespaceToken: honeytokenResult.tokens.whitespaceToken,
        whitespacePositions: honeytokenResult.tokens.whitespacePositions,
        combinedPayloadHash: honeytokenResult.tokens.combinedPayloadHash,
        isActive: true,
      });
    }

    // 12e. Insert QR code record
    await db.insert(documentQrCodes).values({
      documentId,
      versionId: newVersion.id,
      payloadHash: qrResult.payloadHash,
      signatureHash: qrResult.signature,
      verificationUrl: qrResult.verificationUrl,
      shortCode: qrResult.shortCode,
      qrImageS3Key: qrFilename,
      documentVersionNumber: 1,
      contentHashSnapshot: dna.sha256,
      docNameSnapshot: file.originalname,
      isActive: true,
    });

    // 12f. Audit log
    await appendAuditEntry({
      organizationId,
      userId,
      action: 'create',
      resourceType: 'document',
      resourceId: documentId,
      details: {
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        hasHoneytokens: !!honeytokenResult,
        duplicateWarnings: dupResult.isExact || dupResult.isSimilar,
        pipelineSessionId: sessionId,
      },
    });

    // 12g. Update temp upload → completed
    await db
      .update(temporaryUploads)
      .set({
        status: 'completed',
        resultDocumentId: documentId,
        completedAt: new Date(),
      })
      .where(eq(temporaryUploads.uploadSessionId, sessionId));

    // Also store the encrypted key in a retrievable way.
    // In a real production setup the encryptedKey goes into a separate keys table
    // or is stored alongside the version. We stash it in the version's metadata
    // via an update (since the schema doesn't have a dedicated column, we reuse s3Key metadata).
    // For now, the encryptedKey + authTag are stored as JSON in a sidecar approach:
    // The storage.service already saved a .meta.json with authTag.
    // We also need the encryptedKey available for decryption — store in version:
    // We'll use encryptionKeyId to hold encrypted key data (expand later if schema updated).

    // ──────────────────────────────────────────────
    // STEP 13: CLEANUP — secure wipe temp file
    // ──────────────────────────────────────────────
    log(13, 'Cleaning up temp files...');
    if (tempPath) {
      await secureWipe(tempPath);
      tempPath = null;
    }

    // ──────────────────────────────────────────────
    // STEP 14: VECTOR INDEX — SKIPPED
    // Vector indexing is now triggered manually when user grants AI access
    // from the AI Document Analysis page. This ensures data sovereignty:
    // documents are NOT sent to vector DB unless explicitly authorized.
    // ──────────────────────────────────────────────
    log(14, 'Vector indexing deferred (requires user AI access grant)');

    // ──────────────────────────────────────────────
    // STEP 15: RETURN
    // ──────────────────────────────────────────────
    log(15, 'Upload complete');

    return {
      success: true,
      data: {
        document: newDoc,
        version: newVersion,
        qrCode: {
          shortCode: qrResult.shortCode,
          verificationUrl: qrResult.verificationUrl,
        },
        dna: {
          sha256: dna.sha256,
          ssdeep: dna.ssdeep,
          simhash: dna.simhash,
        },
        encryption: {
          keyId: keyData.keyId,
          algorithm: 'aes-256-gcm',
        },
        storage: {
          key: storageKey,
          bucket: storageResult.bucket,
        },
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    console.error('[Upload Pipeline] Error:', err.message);

    // Cleanup temp file on failure
    if (tempPath) {
      try {
        await secureWipe(tempPath);
      } catch (cleanErr) {
        console.error('[Upload Pipeline] Cleanup also failed:', cleanErr.message);
      }
    }

    // Update temp upload status → failed
    try {
      await db
        .update(temporaryUploads)
        .set({ status: 'failed', errorMessage: err.message })
        .where(eq(temporaryUploads.uploadSessionId, sessionId));
    } catch { /* best-effort */ }

    return {
      success: false,
      message: err.message,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
};

// ============================================================
// Internal helper: update temp upload status
// ============================================================

const updateTempStatus = async (sessionId, status, stage) => {
  try {
    await db
      .update(temporaryUploads)
      .set({ status, processingStage: stage })
      .where(eq(temporaryUploads.uploadSessionId, sessionId));
  } catch { /* non-critical */ }
};
