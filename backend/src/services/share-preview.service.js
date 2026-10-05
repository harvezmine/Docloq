// Renders a shared document as watermarked page images (PNG); the decrypted file
// never leaves memory as raw bytes. Most stored documents decrypt to honeytoken-
// modified TEXT rather than their original binary (see upload-pipeline.service.js),
// so content kind is detected post-decryption and rendered accordingly.

import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentVersions, documents } from '../db/schema.js';
import { downloadFile } from './storage.service.js';
import { decryptFile } from './encryption.service.js';
import { getPageCount, extractPageAsImage, parsePdf } from './ocr.service.js';
import { resolveShare, recordAccess } from './share.service.js';
import { convertDocument, downloadFromUrl } from './conversion.service.js';
import { generateOOToken } from '../controllers/document.controller.js';
import path from 'path';
import uploadConfig from '../config/upload.config.js';

// Reverses the honeytoken homoglyph map so previews show clean text, not missing-glyph boxes.
const HOMOGLYPH_BACK = Object.fromEntries(
  Object.entries(uploadConfig.honeytoken.homoglyphMap).map(([latin, cyr]) => [cyr, latin]),
);
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH_BACK).join('')}]`, 'g');

const PREVIEW_WIDTH = 1240;
const PAGE_W = 1240, PAGE_H = 1754, MARGIN = 90, FONT_SIZE = 21, LINE_H = 31;
const CACHE_MAX = 200;
const pageCache = new Map();   // `${docId}:p${n}` -> PNG Buffer
const ctxCache = new Map();    // docId -> { kind, pageCount, lines?, plain? }

const lru = (cache, k) => { const v = cache.get(k); if (v !== undefined) { cache.delete(k); cache.set(k, v); } return v; };
const lruSet = (cache, k, v) => { cache.set(k, v); while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); };

// Detects content kind from the decrypted buffer, not the mime type.
export const detectKind = (buf) => {
  if (!buf || buf.length < 4) return 'text';
  const h = buf.slice(0, 8);
  if (h.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  const hex = h.toString('hex');
  if (hex.startsWith('89504e47')) return 'image';     // PNG
  if (hex.startsWith('ffd8ff')) return 'image';        // JPEG
  if (hex.startsWith('47494638')) return 'image';      // GIF
  if (hex.startsWith('424d')) return 'image';          // BMP
  if (h.slice(0, 4).toString('latin1') === 'RIFF') return 'image'; // WEBP (RIFF)
  if (hex.startsWith('49492a00') || hex.startsWith('4d4d002a')) return 'image'; // TIFF
  // Office/binary docs (docx/xlsx/pptx/odt, legacy OLE2, RTF) must convert to PDF first —
  // rendering raw bytes as text produces a blank/garbled page.
  if (hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708')) return 'office';
  if (hex.startsWith('d0cf11e0a1b11ae1')) return 'office';
  if (hex.startsWith('7b5c7274')) return 'office'; // {\rt  (RTF)
  return 'text';
};

// Strips honeytoken ZWCs (U+200B-200D, FEFF) + watermark chars (U+2060-2063) and
// reverses homoglyphs so no markers leak into the preview.
export const stripInvisible = (text) =>
  (text || '')
    .replace(/[​-‍﻿⁠-⁣]/g, '')
    .replace(HOMOGLYPH_RE, (c) => HOMOGLYPH_BACK[c] || c);

const decryptCurrentVersion = async (doc) => {
  const [version] = await db.select().from(documentVersions).where(eq(documentVersions.id, doc.currentVersionId));
  if (!version || !version.encryptionKeyId || !version.encryptionIv || !version.s3Key) {
    throw new Error('Versi dokumen tidak lengkap untuk preview');
  }
  const encrypted = await downloadFile(version.s3Key);
  let authTag = null;
  try { authTag = JSON.parse((await downloadFile(`${version.s3Key}.meta.json`)).toString()).authTag; } catch { /* none */ }
  if (!authTag) throw new Error('Metadata enkripsi tidak ditemukan');
  return decryptFile(encrypted, version.encryptionKeyId, version.encryptionIv, authTag, version);
};

const wrapText = (ctx, text, maxWidth) => {
  const out = [];
  for (const para of text.split(/\r?\n/)) {
    if (para.trim() === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) { out.push(line); line = word; }
      else line = trial;
    }
    if (line) out.push(line);
  }
  return out;
};

// officeToPdf converts via OnlyOffice, fetched through the signed oo_token file route
// (not /uploads, removed in SEC-B-011). MIME_TO_EXT maps MIME → filetype for odd filenames.
const MIME_TO_EXT = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.oasis.opendocument.presentation': 'odp',
};
const OFFICE_EXTS = new Set(['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp']);

const officeToPdf = async (doc) => {
  const fromName = (path.extname(doc.originalFilename || '').slice(1) || '').toLowerCase();
  const ext = OFFICE_EXTS.has(fromName) ? fromName : (MIME_TO_EXT[doc.mimeType] || 'docx');
  const backendUrlDocker = process.env.BACKEND_URL_DOCKER || 'http://host.docker.internal:3000';
  const fileUrl = `${backendUrlDocker}/api/documents/${doc.id}/file?oo_token=${encodeURIComponent(generateOOToken(doc.id))}`;
  const { url } = await convertDocument(fileUrl, ext, 'pdf', `share-${doc.id}`);
  return await downloadFromUrl(url);
};

const buildContext = async (doc) => {
  const cached = lru(ctxCache, doc.id);
  if (cached) return cached;

  const plain = await decryptCurrentVersion(doc);
  let kind = detectKind(plain);
  let pdfBuf = null;

  // Office/binary → convert to PDF up front, then treat exactly like a PDF.
  if (kind === 'office') {
    try {
      pdfBuf = await officeToPdf(doc);
      kind = 'pdf';
    } catch (e) {
      console.warn('[Share] office→pdf conversion failed:', e.message);
      const ctx = { kind: 'unsupported', pageCount: 1 };
      lruSet(ctxCache, doc.id, ctx);
      return ctx;
    }
  }

  let ctx;
  if (kind === 'pdf') {
    const buf = pdfBuf || plain;
    let pageCount = 1;
    try { pageCount = await getPageCount(buf, 'application/pdf'); } catch { pageCount = 1; }
    ctx = { kind, pageCount, plain: buf };
  } else if (kind === 'image') {
    ctx = { kind, pageCount: 1, plain };
  } else {
    const measure = createCanvas(PAGE_W, PAGE_H).getContext('2d');
    measure.font = `${FONT_SIZE}px sans-serif`;
    const lines = wrapText(measure, stripInvisible(plain.toString('utf-8')), PAGE_W - 2 * MARGIN);
    const linesPerPage = Math.floor((PAGE_H - 2 * MARGIN) / LINE_H);
    const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
    ctx = { kind, pageCount, lines, linesPerPage };
  }
  lruSet(ctxCache, doc.id, ctx);
  return ctx;
};

const watermarkSvg = (w, h, label) => {
  const tiles = [];
  for (let y = -240; y < h + 240; y += 240) {
    for (let x = -360; x < w + 360; x += 360) {
      tiles.push(`<text x="${x}" y="${y}" transform="rotate(-30 ${x} ${y})" font-family="sans-serif" font-size="22" fill="rgba(99,102,241,0.10)" font-weight="600">${label}</text>`);
    }
  }
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${tiles.join('')}</svg>`);
};

const applyWatermark = async (pngBuffer, label) => {
  const base = sharp(pngBuffer).resize({ width: PREVIEW_WIDTH, withoutEnlargement: true });
  const meta = await base.clone().metadata();
  const w = Math.min(meta.width || PREVIEW_WIDTH, PREVIEW_WIDTH);
  const h = Math.round((meta.height || w) * (w / (meta.width || w)));
  return base.composite([{ input: watermarkSvg(w, h, label), top: 0, left: 0 }]).png({ quality: 80 }).toBuffer();
};

const renderTextPage = (ctx, pageNumber) => {
  const canvas = createCanvas(PAGE_W, PAGE_H);
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.fillStyle = '#1e293b'; g.font = `${FONT_SIZE}px sans-serif`; g.textBaseline = 'top';
  const start = (pageNumber - 1) * ctx.linesPerPage;
  const slice = ctx.lines.slice(start, start + ctx.linesPerPage);
  let y = MARGIN;
  for (const line of slice) { g.fillText(line, MARGIN, y); y += LINE_H; }
  return canvas.toBuffer('image/png');
};

// Fallback for pdfjs+native-canvas glyph-render crashes on musl/Alpine (@napi-rs/canvas
// throws on font glyphs) — draws extracted PDF text instead, page-aligned with the PDF.
const renderPdfPageAsText = async (pdfBuffer, pageNumber) => {
  const parsed = await parsePdf(pdfBuffer);
  const text = stripInvisible(parsed.pageTexts?.[pageNumber - 1] ?? parsed.text ?? '');
  const measure = createCanvas(PAGE_W, PAGE_H).getContext('2d');
  measure.font = `${FONT_SIZE}px sans-serif`;
  const lines = wrapText(measure, text, PAGE_W - 2 * MARGIN);
  const linesPerPage = Math.floor((PAGE_H - 2 * MARGIN) / LINE_H);
  return renderTextPage({ lines, linesPerPage }, 1);
};

const wmLabel = (share) =>
  `DocLoq Preview · ${share.shareToken.slice(0, 8)} · ${new Date(share.createdAt || Date.now()).toISOString().slice(0, 10)}`;

export const getManifest = async (token) => {
  const { share, doc } = await resolveShare(token);
  const ctx = await buildContext(doc);
  return {
    docName: doc.originalFilename || doc.filename,
    mimeType: doc.mimeType,
    pageCount: ctx.pageCount,
    previewable: ctx.kind !== 'unsupported', // text/pdf/image + converted office render
    expiresAt: share.expiresAt,
  };
};

export const renderPage = async (token, pageNumber, { ip, userAgent } = {}) => {
  const { share, doc } = await resolveShare(token);
  const n = Math.max(1, parseInt(pageNumber, 10) || 1);

  if (n === 1) recordAccess(share.id, ip, userAgent).catch((e) => console.warn('[Share] access log failed:', e.message));

  const key = `${doc.id}:p${n}`;
  const cached = lru(pageCache, key);
  if (cached) return cached;

  const ctx = await buildContext(doc);
  if (ctx.kind === 'unsupported') {
    const err = new Error('Format dokumen ini belum bisa dipratinjau');
    err.code = 'NOT_PREVIEWABLE';
    throw err;
  }
  const page = Math.min(n, ctx.pageCount);

  let png;
  if (ctx.kind === 'image') png = await sharp(ctx.plain).png().toBuffer();
  else if (ctx.kind === 'pdf') {
    try {
      png = await extractPageAsImage(ctx.plain, page - 1, 150); // 150 DPI ≈ PREVIEW_WIDTH, downscaled below
    } catch (e) {
      // pdfjs+native-canvas glyph render crashes on musl for text PDFs → text fallback.
      console.warn('[Share] PDF page image render failed, falling back to text:', e.message);
      png = await renderPdfPageAsText(ctx.plain, page);
    }
  }
  else png = renderTextPage(ctx, page);

  const out = await applyWatermark(png, wmLabel(share));
  lruSet(pageCache, key, out);
  return out;
};

// Same pipeline as the share viewer but no watermark (caller already authorized access);
// uses a separate `:preview:` cache namespace so it never collides with the share cache.
export const previewManifest = async (doc) => {
  const ctx = await buildContext(doc);
  return {
    docName: doc.originalFilename || doc.filename,
    mimeType: doc.mimeType,
    pageCount: ctx.pageCount,
    previewable: ctx.kind !== 'unsupported',
  };
};

// Renders the matched doc's first page as a no-download PNG for the verification page.
// Returns null (not raw bytes) when the type can't be safely previewed, for a 415 response.
export const renderVerificationPreview = async (documentId, page = 1, orgId = null) => {
  // Org-scoped: a preview must never cross tenants. orgId is required in practice (the
  // route is owner-authenticated); a null orgId can only match rows with a null org.
  const where = and(eq(documents.id, documentId), eq(documents.organizationId, orgId));
  const [doc] = await db.select().from(documents).where(where).limit(1);
  if (!doc || doc.deletedAt || !doc.currentVersionId) return null;

  let ctx;
  try {
    ctx = await buildContext(doc);
  } catch (e) {
    console.warn('[Verify] preview buildContext failed:', e.message);
    return null;
  }
  if (ctx.kind === 'unsupported') return null;

  // Clamp the requested page into the valid range for this document.
  const p = Math.min(Math.max(1, parseInt(page, 10) || 1), ctx.pageCount);

  let png;
  let totalPages = ctx.pageCount;
  if (ctx.kind === 'image') {
    // Images are always single-page; ignore the requested page.
    png = await sharp(ctx.plain).png().toBuffer();
    totalPages = 1;
  } else if (ctx.kind === 'pdf') {
    try {
      png = await extractPageAsImage(ctx.plain, p - 1, 150);
    } catch (e) {
      console.warn('[Verify] PDF page image render failed, falling back to text:', e.message);
      png = await renderPdfPageAsText(ctx.plain, p);
    }
  } else png = renderTextPage(ctx, p);

  const out = await sharp(png).resize({ width: PREVIEW_WIDTH, withoutEnlargement: true }).png({ quality: 82 }).toBuffer();
  return { buffer: out, mimeType: 'image/png', totalPages };
};

export const previewPage = async (doc, pageNumber) => {
  const ctx = await buildContext(doc);
  if (ctx.kind === 'unsupported') {
    const err = new Error('Format dokumen ini belum bisa dipratinjau');
    err.code = 'NOT_PREVIEWABLE';
    throw err;
  }
  const page = Math.min(Math.max(1, parseInt(pageNumber, 10) || 1), ctx.pageCount);

  const key = `${doc.id}:preview:p${page}`;
  const cached = lru(pageCache, key);
  if (cached) return cached;

  let png;
  if (ctx.kind === 'image') png = await sharp(ctx.plain).png().toBuffer();
  else if (ctx.kind === 'pdf') {
    try {
      png = await extractPageAsImage(ctx.plain, page - 1, 150); // 150 DPI ≈ PREVIEW_WIDTH, downscaled below
    } catch (e) {
      console.warn('[Preview] PDF page image render failed, falling back to text:', e.message);
      png = await renderPdfPageAsText(ctx.plain, page);
    }
  } else png = renderTextPage(ctx, page);

  // Normalize width for consistent display (no watermark composite).
  const out = await sharp(png).resize({ width: PREVIEW_WIDTH, withoutEnlargement: true }).png({ quality: 82 }).toBuffer();
  lruSet(pageCache, key, out);
  return out;
};
