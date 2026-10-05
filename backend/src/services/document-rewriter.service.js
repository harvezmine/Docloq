// Format-specific watermark injection into document buffers (TXT, DOCX, PDF).

import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import uploadConfig from '../config/upload.config.js';

const { supportedCategories } = uploadConfig.downloadWatermark;
const { mimeToCategory } = uploadConfig;

// watermarkFn: (text) => { modifiedText, watermarkToken, positions }
export const watermarkBuffer = async (buffer, mimeType, watermarkFn) => {
  const category = mimeToCategory[mimeType];

  if (!category || !supportedCategories.includes(category)) {
    return { buffer, method: 'unsupported', success: false };
  }

  try {
    switch (category) {
      case 'text':
        return await watermarkText(buffer, watermarkFn);
      case 'office':
        return await watermarkDocx(buffer, mimeType, watermarkFn);
      case 'pdf':
        return await watermarkPdf(buffer, watermarkFn);
      default:
        return { buffer, method: 'unsupported', success: false };
    }
  } catch (error) {
    console.warn(`[DocumentRewriter] Watermark injection failed for ${mimeType}:`, error.message);
    return { buffer, method: 'error', success: false };
  }
};

async function watermarkText(buffer, watermarkFn) {
  const text = buffer.toString('utf-8');
  const { modifiedText, watermarkToken, positions } = watermarkFn(text);
  return {
    buffer: Buffer.from(modifiedText, 'utf-8'),
    method: 'text_direct',
    success: true,
    watermarkToken,
    positions,
  };
}

async function watermarkDocx(buffer, mimeType, watermarkFn) {
  const docxMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  if (!docxMimes.includes(mimeType)) {
    // Spreadsheets/presentations: metadata approach instead.
    return await watermarkOfficeMetadata(buffer, watermarkFn);
  }

  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    console.warn('[DocumentRewriter] DOCX missing word/document.xml — falling back to metadata');
    return await watermarkOfficeMetadata(buffer, watermarkFn);
  }

  const docXml = await docXmlFile.async('string');

  const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const textSegments = [];
  let xmlMatch;
  while ((xmlMatch = textRegex.exec(docXml)) !== null) {
    textSegments.push(xmlMatch[1]);
  }

  const fullText = textSegments.join('');

  if (!fullText || fullText.length < 10) {
    return await watermarkOfficeMetadata(buffer, watermarkFn);
  }

  const { modifiedText, watermarkToken, positions } = watermarkFn(fullText);

  // Prepend invisible chars to the first <w:t> — preserves document structure.
  const invisibleChars = extractInvisibleChars(fullText, modifiedText);

  let modifiedXml = docXml;
  let injected = false;

  modifiedXml = docXml.replace(
    /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/,
    (match, openTag, content, closeTag) => {
      injected = true;
      // Ensure xml:space="preserve" so invisible chars are kept
      const preserveTag = openTag.includes('xml:space')
        ? openTag
        : openTag.replace('<w:t', '<w:t xml:space="preserve"');
      return `${preserveTag}${invisibleChars}${content}${closeTag}`;
    }
  );

  if (!injected) {
    return await watermarkOfficeMetadata(buffer, watermarkFn);
  }

  zip.file('word/document.xml', modifiedXml);
  const modifiedBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    buffer: modifiedBuffer,
    method: 'docx_xml',
    success: true,
    watermarkToken,
    positions,
  };
}

// Fallback: hide the watermark in a custom XML part of the Office zip.
async function watermarkOfficeMetadata(buffer, watermarkFn) {
  try {
    const zip = await JSZip.loadAsync(buffer);

    const dummyText = 'docloq-watermark-carrier-text-for-invisible-encoding';
    const { modifiedText, watermarkToken, positions } = watermarkFn(dummyText);

    zip.file('customXml/watermark.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<watermark>${modifiedText}</watermark>`);

    const modifiedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return {
      buffer: modifiedBuffer,
      method: 'office_metadata',
      success: true,
      watermarkToken,
      positions,
    };
  } catch (error) {
    console.warn('[DocumentRewriter] Office metadata watermark failed:', error.message);
    return { buffer, method: 'error', success: false };
  }
}

async function watermarkPdf(buffer, watermarkFn) {
  const dummyText = 'docloq-watermark-carrier-text-for-invisible-encoding';
  const { modifiedText, watermarkToken, positions } = watermarkFn(dummyText);
  const invisibleChars = extractInvisibleChars(dummyText, modifiedText);

  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      return { buffer, method: 'pdf_empty', success: false };
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const firstPage = pages[0];
    firstPage.drawText(invisibleChars, {
      x: 0,
      y: 0,
      size: 1,
      font,
      opacity: 0,
    });

    pdfDoc.setKeywords([`dwm:${invisibleChars}`]);

    const modifiedBuffer = Buffer.from(await pdfDoc.save());

    return {
      buffer: modifiedBuffer,
      method: 'pdf_annotation',
      success: true,
      watermarkToken,
      positions,
    };
  } catch (error) {
    console.warn('[DocumentRewriter] PDF watermark via annotation failed:', error.message);

    // Fallback: try metadata-only approach
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pdfDoc.setKeywords([`dwm:${invisibleChars}`]);
      const modifiedBuffer = Buffer.from(await pdfDoc.save());

      return {
        buffer: modifiedBuffer,
        method: 'pdf_metadata',
        success: true,
        watermarkToken,
        positions,
      };
    } catch (metaError) {
      console.warn('[DocumentRewriter] PDF metadata watermark also failed:', metaError.message);
      return { buffer, method: 'error', success: false };
    }
  }
}

// Diff original vs watermarked text to isolate the injected invisible chars.
function extractInvisibleChars(originalText, modifiedText) {
  const wmCharSet = new Set(uploadConfig.downloadWatermark.chars);
  let invisible = '';
  for (const ch of modifiedText) {
    if (wmCharSet.has(ch)) {
      invisible += ch;
    }
  }
  return invisible;
}

// Stamp a small visible, search-indexable canary code (OSINT tracking) onto a served copy.
export const stampVisibleCode = async (buffer, mimeType, code) => {
  const category = mimeToCategory[mimeType];
  try {
    if (category === 'text') return stampTextVisible(buffer, code);
    if (category === 'pdf') return await stampPdfVisible(buffer, code);
    if (category === 'office') return await stampDocxVisible(buffer, mimeType, code);
    return { buffer, method: 'unsupported', success: false };
  } catch (error) {
    console.warn('[DocumentRewriter] visible stamp failed:', error.message);
    return { buffer, method: 'error', success: false };
  }
};

function stampTextVisible(buffer, code) {
  const text = buffer.toString('utf-8');
  const stamped = `${text.replace(/\s+$/, '')}\n\nref:${code}\n`;
  return { buffer: Buffer.from(stamped, 'utf-8'), method: 'text_visible', success: true };
}

async function stampPdfVisible(buffer, code) {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return { buffer, method: 'pdf_empty', success: false };
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const label = `ref:${code}`;
  for (const page of pages) {
    page.drawText(label, {
      x: 6,
      y: 4,
      size: uploadConfig.tracking.stampSizePt,
      font,
      color: rgb(0.55, 0.55, 0.55),
      opacity: uploadConfig.tracking.stampOpacity,
    });
  }
  const out = Buffer.from(await pdfDoc.save());
  return { buffer: out, method: 'pdf_visible', success: true };
}

// Only OOXML .docx is a zip we can edit. Legacy .doc/.rtf are binary/flat, .odt uses a
// different part layout — those keep returning success:false so the caller serves un-stamped.
const OOXML_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function stampDocxVisible(buffer, mimeType, code) {
  if (mimeType !== OOXML_DOCX_MIME) return { buffer, method: 'unsupported', success: false };

  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return { buffer, method: 'docx_no_body', success: false };

  const docXml = await docXmlFile.async('string');
  // w:sz is half-points, so stampSizePt*2 keeps the DOCX stamp the same size as the PDF one.
  const halfPt = Math.max(2, Math.round(uploadConfig.tracking.stampSizePt * 2));
  const para = '<w:p><w:r><w:rPr>'
    + `<w:sz w:val="${halfPt}"/><w:szCs w:val="${halfPt}"/><w:color w:val="8C8C8C"/>`
    + `</w:rPr><w:t xml:space="preserve">ref:${code}</w:t></w:r></w:p>`;

  // sectPr must stay the last child of w:body, so insert ahead of it when present.
  let stampedXml;
  if (docXml.includes('<w:sectPr')) {
    stampedXml = docXml.replace('<w:sectPr', `${para}<w:sectPr`);
  } else if (docXml.includes('</w:body>')) {
    stampedXml = docXml.replace('</w:body>', `${para}</w:body>`);
  } else {
    return { buffer, method: 'docx_no_body', success: false };
  }

  zip.file('word/document.xml', stampedXml);
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { buffer: out, method: 'docx_visible', success: true };
}

// Stamp the verification QR PNG onto downloaded copies. PDF works; DOCX deferred
// (returns success:false → caller serves un-stamped).
export const stampQrCode = async (buffer, mimeType, qrPngBuffer, shortCode) => {
  const category = mimeToCategory[mimeType];
  try {
    if (category === 'pdf') return await stampQrPdf(buffer, qrPngBuffer, shortCode);
    if (category === 'office') return await stampQrDocx(buffer, mimeType, qrPngBuffer, shortCode);
    return { buffer, success: false };
  } catch (e) {
    console.warn('[DocumentRewriter] QR stamp failed:', e.message);
    return { buffer, success: false };
  }
};

async function stampQrPdf(buffer, qrPng, shortCode) {
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (!pages.length) return { buffer, success: false };
  const png = await pdfDoc.embedPng(qrPng);
  const size = 64;
  const margin = 18;
  const last = pages[pages.length - 1];
  const { width } = last.getSize();
  last.drawImage(png, { x: width - size - margin, y: margin, width: size, height: size });
  if (shortCode) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    last.drawText(shortCode, { x: width - size - margin, y: margin - 10, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
  }
  return { buffer: Buffer.from(await pdfDoc.save()), success: true };
}

// DOCX best-effort: deferred — return success:false so caller serves un-stamped.
async function stampQrDocx(buffer, mimeType, qrPng, shortCode) {
  const docxMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  if (!docxMimes.includes(mimeType)) return { buffer, success: false };
  // Phase 2: real DOCX image embed via jszip.
  return { buffer, success: false };
}
