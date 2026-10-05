// OCR demo — generate sample docs, run real pipeline, print results.
// Run: OCR_TESSDATA_PATH=./vendor/tessdata node scripts/ocr-demo.mjs
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { processImageForAI, extractTextFromPages, detectContentType, getPageCount, terminateOCRWorker } from '../src/services/ocr.service.js';

process.env.OCR_TESSDATA_PATH = process.env.OCR_TESSDATA_PATH || './vendor/tessdata';
const OUT = 'scripts/ocr-demo-out';
mkdirSync(OUT, { recursive: true });

const LINES = [
  'SURAT KETERANGAN DOMISILI',
  'Nomor: 470/123/DS/2026',
  'Yang bertanda tangan di bawah ini Kepala Desa',
  'menerangkan dengan sebenarnya bahwa warga',
  'bernama Budi Santoso, lahir di Jakarta tahun 1990,',
  'beralamat di Jalan Merdeka Nomor 17 RT 04 RW 02.',
  'Demikian surat keterangan ini dibuat untuk',
  'dipergunakan sebagaimana mestinya.',
];

function makeDoc(opts = {}) {
  const { faint = false } = opts;
  const c = createCanvas(1100, 760);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1100, 760);
  x.fillStyle = faint ? '#9a9a9a' : '#000'; // faint = low contrast → trigger retry
  x.font = '30px sans-serif';
  LINES.forEach((l, i) => x.fillText(l, 50, 70 + i * 80));
  return c.toBuffer('image/png');
}

const sep = (t) => console.log(`\n${'═'.repeat(58)}\n${t}\n${'═'.repeat(58)}`);
const show = (r) => {
  console.log(`confidence: ${r.confidence}% | rotated: ${r.wasRotated} | retried: ${r.retried}`);
  console.log('--- teks ---');
  console.log(r.text);
};

sep('1) GAMBAR LURUS (image upright)');
const upright = makeDoc();
writeFileSync(`${OUT}/1-upright.png`, upright);
show(await processImageForAI(upright));

sep('2) GAMBAR TERBALIK 180° (OSD auto-correct)');
const rot = await sharp(makeDoc()).rotate(180).png().toBuffer();
writeFileSync(`${OUT}/2-rotated180.png`, rot);
show(await processImageForAI(rot));

sep('3) GAMBAR MIRING 90° (OSD auto-correct)');
const rot90 = await sharp(makeDoc()).rotate(90).png().toBuffer();
writeFileSync(`${OUT}/3-rotated90.png`, rot90);
show(await processImageForAI(rot90));

sep('4) GAMBAR PUDAR / LOW-CONTRAST (adaptive retry)');
const faint = makeDoc({ faint: true });
writeFileSync(`${OUT}/4-faint.png`, faint);
show(await processImageForAI(faint));

sep('5) PDF HASIL SCAN (image-only PDF → OCR per halaman)');
const pdf = await PDFDocument.create();
const page = pdf.addPage([1100, 760]);
page.drawImage(await pdf.embedPng(makeDoc()), { x: 0, y: 0, width: 1100, height: 760 });
const pdfBuf = Buffer.from(await pdf.save());
writeFileSync(`${OUT}/5-scanned.pdf`, pdfBuf);
console.log('pageCount:', await getPageCount(pdfBuf, 'application/pdf'));
const { contentType, pageDetails } = await detectContentType(pdfBuf, 'application/pdf');
console.log('contentType:', contentType);
const ex = await extractTextFromPages(pdfBuf, [1], pageDetails);
console.log(`ocrPages: [${ex.ocrPages}] | avgConfidence: ${ex.avgOCRConfidence}%`);
console.log('--- teks ---');
console.log(ex.pages.map((p) => p.text).join('\n'));

await terminateOCRWorker();
console.log(`\nFile contoh tersimpan di: ${OUT}/  (buka PNG/PDF untuk lihat input)`);
