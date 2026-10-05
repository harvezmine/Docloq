// extractText() (pdf-parse/mammoth) strips invisible Unicode watermark chars, so this reads
// raw PDF metadata / DOCX XML / TXT instead, returning all candidate strings for the caller to scan.

import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

const PDF_MIMES = new Set(['application/pdf']);
const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);
const OFFICE_ZIP_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);
const TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml',
]);

// Extract PDF metadata string fields that might carry watermark chars; pdf-lib doesn't strip invisible Unicode (unlike pdf-parse).
export async function extractFromPdf(buffer) {
  const out = [];
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    // Keywords field is where document-rewriter stores `dwm:<invisibleChars>`
    const keywords = pdfDoc.getKeywords();
    if (keywords) out.push(keywords);
    const title = pdfDoc.getTitle();
    if (title) out.push(title);
    const subject = pdfDoc.getSubject();
    if (subject) out.push(subject);
    const author = pdfDoc.getAuthor();
    if (author) out.push(author);
    const creator = pdfDoc.getCreator();
    if (creator) out.push(creator);
    const producer = pdfDoc.getProducer();
    if (producer) out.push(producer);
  } catch (err) {
    console.warn('[WatermarkExtract] PDF metadata parse failed:', err.message);
  }
  return out;
}

// Extract candidate text from Office ZIP (DOCX/XLSX/PPTX) via raw XML — preserves invisible chars, unlike mammoth.
export async function extractFromOfficeZip(buffer) {
  const out = [];
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Custom XML part where watermarkOfficeMetadata fallback stores payload
    const customXml = zip.file('customXml/watermark.xml');
    if (customXml) {
      const raw = await customXml.async('string');
      out.push(raw);
    }

    // Main document XML — for DOCX. Invisible chars survive in xml:space="preserve" <w:t> nodes
    const candidates = [
      'word/document.xml',
      'xl/sharedStrings.xml',
      'ppt/slides/slide1.xml',
    ];
    for (const path of candidates) {
      const f = zip.file(path);
      if (f) {
        const raw = await f.async('string');
        out.push(raw);
      }
    }

    // Office core properties may carry metadata too
    const coreProps = zip.file('docProps/core.xml');
    if (coreProps) out.push(await coreProps.async('string'));
    const appProps = zip.file('docProps/app.xml');
    if (appProps) out.push(await appProps.async('string'));
  } catch (err) {
    console.warn('[WatermarkExtract] Office ZIP parse failed:', err.message);
  }
  return out;
}

/** Plain text — direct UTF-8 buffer string. */
export function extractFromTxt(buffer) {
  try {
    return [buffer.toString('utf-8')];
  } catch {
    return [];
  }
}

// Aggregate all watermark-bearing sources for a file; caller joins the array and runs detectors.
export async function extractAllWatermarkSources(buffer, mimeType) {
  const sources = [];

  // Always try plain UTF-8 as a last resort (can surface invisible-char sequences even in binary); capped at 256KB.
  try {
    const slice = buffer.length > 262144 ? buffer.subarray(0, 262144) : buffer;
    const utf8 = slice.toString('utf-8');
    if (utf8 && utf8.length > 0) sources.push(utf8);
  } catch {
    // ignore
  }

  if (PDF_MIMES.has(mimeType)) {
    sources.push(...(await extractFromPdf(buffer)));
  }

  if (OFFICE_ZIP_MIMES.has(mimeType)) {
    sources.push(...(await extractFromOfficeZip(buffer)));
  }

  if (TEXT_MIMES.has(mimeType)) {
    sources.push(...extractFromTxt(buffer));
  }

  return sources.filter((s) => typeof s === 'string' && s.length >= 1);
}
