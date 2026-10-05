// OCR and image preprocessing (tesseract.js + sharp) for document analysis.

import { createWorker, OEM, PSM } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import os from 'os';

const execFileAsync = promisify(execFile);
// One pdfjs version for both text extraction and rendering: pdf-parse bundles pdfjs 5.4,
// which clashes with our 5.7 via the shared GlobalWorkerOptions singleton ("API version mismatch").
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createRequire } from 'module';

// pdfjs needs its bundled base-14 fonts for PDFs without embedded fonts; otherwise the
// system-font lookup crashes natively in @napi-rs/canvas on headless/Alpine hosts. Must use '/' + trailing slash.
const STANDARD_FONT_DATA_URL =
  path.join(path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts').replace(/\\/g, '/') + '/';

export async function parsePdf(buffer) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;
  try {
    const pageTexts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((it) => it.str).join(' ').trim());
    }
    return {
      text: pageTexts.join('\n\n'),
      numpages: doc.numPages || pageTexts.length || 1,
      pageTexts,
    };
  } finally {
    await doc.destroy().catch(() => {});
  }
}

let ocrWorker = null;
let osdWorker = null; // separate Legacy-engine worker; detect()/OSD needs OEM 0
let workerIdleTimer = null;
const WORKER_IDLE_TIMEOUT = 5 * 60 * 1000;

// tesseract.js accepts '+'-joined codes e.g. 'eng+ind'
const OCR_LANG = process.env.OCR_LANG || 'eng+ind';
// Local tessdata dir → no CDN fetch when traineddata present (self-hosted / UU PDP).
const TESSDATA_PATH = process.env.OCR_TESSDATA_PATH
  ? path.resolve(process.env.OCR_TESSDATA_PATH)
  : path.resolve(process.cwd(), 'vendor/tessdata');
// Below this Tesseract mean-confidence (0-100), retry once with aggressive enhancement.
const OCR_MIN_CONFIDENCE = parseInt(process.env.OCR_MIN_CONFIDENCE || '55', 10);
// Orientation auto-detection (OSD). Needs osd.traineddata in TESSDATA_PATH.
const OCR_ENABLE_OSD = process.env.OCR_ENABLE_OSD !== 'false';
const OSD_AVAILABLE = existsSync(path.join(TESSDATA_PATH, 'osd.traineddata'));
// 300 DPI measured best; higher interacts badly with the enhance upscale and drops accuracy.
const OCR_RENDER_DPI = parseInt(process.env.OCR_RENDER_DPI || '300', 10);

// Reusable worker: lazy-init on first request, terminated after 5 min idle.
export const getOCRWorker = async (lang = OCR_LANG) => {
  if (ocrWorker) {
    resetIdleTimer();
    return ocrWorker;
  }

  // Use local traineddata when available, else let tesseract.js fall back to its CDN.
  const useLocal = existsSync(TESSDATA_PATH);
  const workerOpts = {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // Only log recognition progress at 25% intervals
        if (m.progress && m.progress % 0.25 < 0.02) {
          console.log(`[OCR] Recognition: ${Math.round(m.progress * 100)}%`);
        }
      }
    },
  };
  if (useLocal) {
    workerOpts.langPath = TESSDATA_PATH;
    workerOpts.cachePath = TESSDATA_PATH;
    workerOpts.gzip = false;
  }

  console.log(`[OCR] Initializing Tesseract worker (lang=${lang}, tessdata=${useLocal ? TESSDATA_PATH : 'CDN'})...`);
  ocrWorker = await createWorker(lang, 1, workerOpts);
  // PSM 6 = single uniform block; dpi is overridden per-call for PDF pages (see performOCR).
  await ocrWorker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    user_defined_dpi: '300',
  });

  console.log('[OCR] Tesseract worker ready');
  resetIdleTimer();
  return ocrWorker;
};

// worker.detect() requires the Legacy engine (OEM 0) + osd traineddata.
async function getOSDWorker() {
  if (osdWorker) {
    resetIdleTimer();
    return osdWorker;
  }
  const useLocal = existsSync(TESSDATA_PATH);
  const opts = {};
  if (useLocal) {
    opts.langPath = TESSDATA_PATH;
    opts.cachePath = TESSDATA_PATH;
    opts.gzip = false;
  }
  console.log('[OCR] Initializing OSD worker (Legacy engine)...');
  osdWorker = await createWorker('osd', OEM.TESSERACT_ONLY, opts);
  resetIdleTimer();
  return osdWorker;
}

// Frees ~100-200MB per worker.
export const terminateOCRWorker = async () => {
  if (workerIdleTimer) {
    clearTimeout(workerIdleTimer);
    workerIdleTimer = null;
  }
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
    console.log('[OCR] Worker terminated (idle timeout or manual)');
  }
  if (osdWorker) {
    await osdWorker.terminate();
    osdWorker = null;
    console.log('[OCR] OSD worker terminated');
  }
};

function resetIdleTimer() {
  if (workerIdleTimer) clearTimeout(workerIdleTimer);
  workerIdleTimer = setTimeout(() => terminateOCRWorker(), WORKER_IDLE_TIMEOUT);
}

export const getPageCount = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') {
    try {
      const data = await parsePdf(buffer);
      return data.numpages || 1;
    } catch (err) {
      console.warn('[OCR] Failed to get PDF page count:', err.message);
      return 1;
    }
  }

  if (mimeType.startsWith('image/')) {
    return 1;
  }

  // Text files, office docs = 1 logical page
  return 1;
};

// Classify a document as 'full-text' | 'mixed' | 'image-only' with per-page detail.
export const detectContentType = async (buffer, mimeType) => {
  if (mimeType.startsWith('image/')) {
    return {
      contentType: 'image-only',
      pageDetails: [{ page: 1, type: 'image', charCount: 0 }],
    };
  }

  if (mimeType.startsWith('text/')) {
    const charCount = buffer.toString('utf-8').length;
    return {
      contentType: 'full-text',
      pageDetails: [{ page: 1, type: 'text', charCount }],
    };
  }

  if (mimeType.includes('officedocument') || mimeType.includes('msword') ||
      mimeType.includes('opendocument')) {
    return {
      contentType: 'full-text',
      pageDetails: [{ page: 1, type: 'text', charCount: -1 }], // -1 = unknown
    };
  }

  if (mimeType === 'application/pdf') {
    return await detectPDFContentType(buffer);
  }

  return {
    contentType: 'full-text',
    pageDetails: [{ page: 1, type: 'text', charCount: 0 }],
  };
};

async function detectPDFContentType(buffer) {
  try {
    const data = await parsePdf(buffer);
    const totalPages = data.numpages || 1;
    // pdfjs gives reliable per-page text — a page with <20 chars is image-based.
    const pageTexts = data.pageTexts.length ? data.pageTexts : [data.text || ''];

    const pageDetails = [];
    let hasText = false;
    let hasImage = false;

    for (let i = 0; i < totalPages; i++) {
      const charCount = (pageTexts[i] || '').trim().length;
      const type = charCount < 20 ? 'image' : 'text';
      pageDetails.push({ page: i + 1, type, charCount });
      if (type === 'text') hasText = true;
      if (type === 'image') hasImage = true;
    }

    let contentType = 'full-text';
    if (hasText && hasImage) contentType = 'mixed';
    else if (!hasText) contentType = 'image-only';

    return { contentType, pageDetails };
  } catch (err) {
    console.warn('[OCR] PDF content detection failed:', err.message);
    return {
      contentType: 'full-text',
      pageDetails: [{ page: 1, type: 'text', charCount: 0 }],
    };
  }
}

// Render one PDF page to PNG via pdfjs + @napi-rs/canvas (sharp's PDF support needs poppler/pdfium, absent here).
const renderPdfPage = async (pdfBuffer, pageIndex, fontOpts) => {
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), ...fontOpts }).promise;
    const page = await doc.getPage(pageIndex + 1); // pdfjs pages are 1-based
    const viewport = page.getViewport({ scale: OCR_RENDER_DPI / 72 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    if (doc) await doc.destroy().catch(() => {});
  }
};

// Native poppler pdftoppm: pixel-accurate and stable on Alpine/musl, where pdfjs+canvas crashes on glyph painting.
const renderPdfPageWithPoppler = async (pdfBuffer, pageIndex, dpi) => {
  const pageNum = pageIndex + 1;
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docloq-pdfimg-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPrefix = path.join(dir, 'page');
  try {
    await writeFile(inPath, pdfBuffer);
    // -singlefile → output is exactly `${outPrefix}.png` (no -NN suffix).
    await execFileAsync('pdftoppm', [
      '-png', '-r', String(dpi),
      '-f', String(pageNum), '-l', String(pageNum),
      '-singlefile', inPath, outPrefix,
    ], { timeout: 30000 });
    return await readFile(`${outPrefix}.png`);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

export const extractPageAsImage = async (pdfBuffer, pageIndex = 0, dpi = OCR_RENDER_DPI) => {
  try {
    const image = await renderPdfPageWithPoppler(pdfBuffer, pageIndex, dpi);
    console.log(`[OCR] Rendered page ${pageIndex + 1} via poppler (${Math.round(image.length / 1024)}KB)`);
    return image;
  } catch (popplerErr) {
    // poppler absent (local dev) or failed → fall back to pdfjs render.
    console.warn(`[OCR] poppler render of page ${pageIndex + 1} failed (${popplerErr.message}); trying pdfjs`);
  }

  // Fallback A: pdfjs with bundled standard fonts + font-face rendering.
  try {
    const image = await renderPdfPage(pdfBuffer, pageIndex, {
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      disableFontFace: false,
    });
    console.log(`[OCR] Rendered page ${pageIndex + 1} as image (${Math.round(image.length / 1024)}KB)`);
    return image;
  } catch (err) {
    // Fallback B: path-glyph rendering with no font data — lower fidelity but never
    // touches the system/standard font loader that crashes on some hosts.
    console.warn(`[OCR] Primary render of page ${pageIndex + 1} failed (${err.message}); using path-glyph fallback`);
    try {
      const image = await renderPdfPage(pdfBuffer, pageIndex, { disableFontFace: true });
      console.log(`[OCR] Rendered page ${pageIndex + 1} via fallback (${Math.round(image.length / 1024)}KB)`);
      return image;
    } catch (err2) {
      console.error(`[OCR] Failed to render page ${pageIndex + 1}:`, err2.message);
      throw new Error(`Failed to render PDF page ${pageIndex + 1} as image: ${err2.message}`);
    }
  }
};

export const detectAndCorrectRotation = async (imageBuffer) => {
  try {
    // sharp.rotate() with no arguments auto-rotates based on EXIF
    const rotated = sharp(imageBuffer).rotate();
    const metadata = await sharp(imageBuffer).metadata();
    const rotatedBuffer = await rotated.toBuffer();
    const rotatedMeta = await sharp(rotatedBuffer).metadata();

    // dimension change = rotation occurred
    const wasRotated = metadata.width !== rotatedMeta.width || metadata.height !== rotatedMeta.height;
    const rotation = wasRotated ? (metadata.orientation || 0) : 0;

    if (wasRotated) {
      console.log(`[OCR] Image auto-rotated (EXIF orientation: ${metadata.orientation})`);
    }

    return { buffer: rotatedBuffer, wasRotated, rotation };
  } catch (err) {
    console.warn('[OCR] Rotation detection failed, using original:', err.message);
    return { buffer: imageBuffer, wasRotated: false, rotation: 0 };
  }
};

// Enhance for OCR; aggressive (retry pass) adds denoise + binarization for faint scans.
export const enhanceImage = async (imageBuffer, opts = {}) => {
  const { aggressive = false } = opts;
  const enhancements = [];

  try {
    let pipeline = sharp(imageBuffer);
    const metadata = await sharp(imageBuffer).metadata();

    pipeline = pipeline.grayscale();
    enhancements.push('grayscale');

    pipeline = pipeline.normalize();
    enhancements.push('contrast-normalize');

    // CLAHE fixes uneven lighting on real scans far better than a global normalize; tile must fit the image.
    const claheTile = aggressive ? 8 : 16;
    if ((metadata.width || 0) > claheTile * 2 && (metadata.height || 0) > claheTile * 2) {
      pipeline = pipeline.clahe({ width: claheTile, height: claheTile, maxSlope: 3 });
      enhancements.push(`clahe-${claheTile}`);
    }

    if (aggressive) {
      // Denoise speckle then binarize — helps faint photocopies / low-contrast scans.
      pipeline = pipeline.median(1);
      enhancements.push('median-denoise');
      pipeline = pipeline.linear(1.2, -10); // mild contrast lift before threshold
      pipeline = pipeline.threshold(128);
      enhancements.push('binarize');
    } else {
      pipeline = pipeline.sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 });
      enhancements.push('sharpen');
    }

    // Upscale small images for better glyph resolution.
    const minWidth = aggressive ? 1500 : 1000;
    if (metadata.width && metadata.width < minWidth) {
      const scale = Math.ceil(minWidth / metadata.width);
      pipeline = pipeline.resize({
        width: metadata.width * scale,
        height: metadata.height * scale,
        kernel: 'lanczos3',
      });
      enhancements.push(`upscale-${scale}x`);
    }

    const enhancedBuffer = await pipeline.png().toBuffer();
    console.log(`[OCR] Image enhanced${aggressive ? ' (aggressive)' : ''}: ${enhancements.join(', ')}`);
    return { buffer: enhancedBuffer, wasEnhanced: true, enhancements };
  } catch (err) {
    console.warn('[OCR] Enhancement failed, using original:', err.message);
    return { buffer: imageBuffer, wasEnhanced: false, enhancements: [] };
  }
};

// OSD orientation fix (0/90/180/270) for rotated scans without EXIF; safe no-op when OSD unavailable.
export const correctOrientationOSD = async (imageBuffer) => {
  if (!OCR_ENABLE_OSD || !OSD_AVAILABLE) return { buffer: imageBuffer, rotated: 0 };
  try {
    const worker = await getOSDWorker();
    const { data } = await worker.detect(imageBuffer);
    // null when OSD can't decide (too few chars) — leave image as-is.
    if (data?.orientation_degrees == null) return { buffer: imageBuffer, rotated: 0 };
    // orientation_degrees is the clockwise rotation to APPLY to make the page upright
    // (verified empirically) — rotate by exactly that value.
    const deg = ((data.orientation_degrees % 360) + 360) % 360;
    if (deg === 0) return { buffer: imageBuffer, rotated: 0 };
    const rotatedBuffer = await sharp(imageBuffer).rotate(deg).png().toBuffer();
    console.log(`[OCR] OSD corrected orientation: rotated ${deg}° cw (conf ${Math.round(data.orientation_confidence || 0)})`);
    return { buffer: rotatedBuffer, rotated: deg };
  } catch (err) {
    console.warn('[OCR] OSD orientation detection skipped:', err.message);
    return { buffer: imageBuffer, rotated: 0 };
  }
};

export const cleanOcrText = (text) => {
  if (!text) return '';
  let t = text.replace(/\r\n?/g, '\n');
  // join words split by hyphen at end of line: "exam-\nple" → "example"
  t = t.replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2');
  const lines = t.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd());
  const kept = lines.filter((line) => {
    const s = line.trim();
    if (!s) return true; // keep blank lines (paragraph breaks)
    const alnum = (s.match(/[\p{L}\p{N}]/gu) || []).length;
    return alnum / s.length >= 0.4; // drop lines that are mostly symbols/noise
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

export const performOCR = async (imageBuffer, lang = OCR_LANG, opts = {}) => {
  const { dpi } = opts;
  const worker = await getOCRWorker(lang);

  try {
    if (dpi) await worker.setParameters({ user_defined_dpi: String(dpi) });
    console.log(`[OCR] Starting text recognition (${Math.round(imageBuffer.length / 1024)}KB)...`);
    const { data } = await worker.recognize(imageBuffer);

    const text = (data.text || '').trim();
    const confidence = Math.round(data.confidence || 0);

    console.log(`[OCR] Recognition complete: ${text.length} chars, ${confidence}% confidence`);
    return { text, confidence };
  } catch (err) {
    console.error('[OCR] Recognition failed:', err.message);
    throw new Error(`OCR recognition failed: ${err.message}`);
  }
};

// EXIF rotate → OSD orient → enhance → OCR → clean; on low confidence, retry once
// with aggressive enhancement and keep the higher-scoring pass.
export const processImageForAI = async (imageBuffer, lang = OCR_LANG, opts = {}) => {
  const { dpi } = opts; // pass PDF render DPI so Tesseract calibrates correctly
  console.log('[OCR] Starting full image processing pipeline...');

  // Decode via sharp BEFORE any Tesseract call: a corrupt image makes the tesseract.js
  // worker re-throw on process.nextTick (uncatchable) and crash the whole backend.
  let safeBuffer;
  try {
    safeBuffer = await sharp(imageBuffer).rotate().png().toBuffer();
  } catch (err) {
    throw new Error(`Unreadable image, skipping OCR: ${err.message}`);
  }

  const { buffer: exifBuffer, wasRotated: exifRotated } = await detectAndCorrectRotation(safeBuffer);

  const { buffer: orientedBuffer, rotated: osdRotated } = await correctOrientationOSD(exifBuffer);
  const wasRotated = exifRotated || osdRotated !== 0;

  const std = await enhanceImage(orientedBuffer, { aggressive: false });
  let best = await performOCR(std.buffer, lang, { dpi });
  let enhancements = std.enhancements;
  let retried = false;

  if (best.confidence < OCR_MIN_CONFIDENCE) {
    console.log(`[OCR] Low confidence ${best.confidence}% < ${OCR_MIN_CONFIDENCE}% — retrying with aggressive enhancement`);
    retried = true;
    const agg = await enhanceImage(orientedBuffer, { aggressive: true });
    const alt = await performOCR(agg.buffer, lang, { dpi });
    if (alt.confidence >= best.confidence) {
      best = alt;
      enhancements = agg.enhancements;
    }
  }

  const text = cleanOcrText(best.text);

  console.log(`[OCR] Pipeline complete → ${text.length} chars, ${best.confidence}% confidence, rotated=${wasRotated}, retried=${retried}`);

  return {
    text,
    confidence: best.confidence,
    wasRotated,
    wasEnhanced: true,
    enhancements,
    retried,
  };
};

// Text pages: direct pdfjs extraction; image pages: render → OCR pipeline. pageNumbers are 1-based.
export const extractTextFromPages = async (pdfBuffer, pageNumbers, pageDetails) => {
  const data = await parsePdf(pdfBuffer);
  const totalPages = data.numpages || 1;
  const allPageTexts = data.pageTexts.length ? data.pageTexts : [data.text || ''];

  const pages = [];
  const ocrPages = [];
  let totalConfidence = 0;
  let ocrCount = 0;

  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > totalPages) {
      pages.push({ page: pageNum, text: '', method: 'skipped', error: 'Page out of range' });
      continue;
    }

    const detail = pageDetails.find(d => d.page === pageNum);
    const isImagePage = detail?.type === 'image';

    if (!isImagePage) {
      const text = (allPageTexts[pageNum - 1] || '').trim();
      pages.push({ page: pageNum, text, method: 'text-extract', confidence: 100 });
    } else {
      try {
        const imageBuffer = await extractPageAsImage(pdfBuffer, pageNum - 1);
        const ocrResult = await processImageForAI(imageBuffer, OCR_LANG, { dpi: OCR_RENDER_DPI });
        pages.push({
          page: pageNum,
          text: ocrResult.text,
          method: 'ocr',
          confidence: ocrResult.confidence,
          wasRotated: ocrResult.wasRotated,
          wasEnhanced: ocrResult.wasEnhanced,
        });
        ocrPages.push(pageNum);
        totalConfidence += ocrResult.confidence;
        ocrCount++;
      } catch (err) {
        console.error(`[OCR] Failed to process page ${pageNum}:`, err.message);
        pages.push({ page: pageNum, text: '', method: 'ocr-failed', error: err.message });
      }
    }
  }

  return {
    pages,
    ocrPages,
    avgOCRConfidence: ocrCount > 0 ? Math.round(totalConfidence / ocrCount) : 0,
  };
};
