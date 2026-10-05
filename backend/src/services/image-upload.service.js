// Hardened profile-image pipeline (avatars, org logo/cover).
//
// Security model:
// - Magic-byte sniffing via file-type — the client's declared MIME/extension is never trusted.
// - Whitelist JPEG/PNG/WebP only. SVG is rejected outright (script/XSS vector), as is GIF/TIFF/BMP.
// - sharp re-encodes every image to a fresh WebP: this destroys polyglot files, embedded
//   scripts, and appended payloads, and strips all metadata (EXIF/XMP/ICC) by default.
// - limitInputPixels caps the decoded pixel count so a tiny compressed "pixel bomb"
//   can't exhaust memory during decode.
// - Output is a data: URL with a server-fixed `data:image/webp;base64,` prefix and a
//   base64-only body — nothing user-controlled can escape the src attribute.

import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB input cap (multer enforces it too)
const MAX_INPUT_PIXELS = 30_000_000; // ~30MP decode ceiling

const PRESETS = {
  avatar: { width: 256, height: 256, quality: 82 },
  logo: { width: 512, height: 512, quality: 85 },
  cover: { width: 1600, height: 520, quality: 78 },
};

const fail = (code) => {
  const err = new Error(code);
  err.code = code;
  return err;
};

/**
 * Validate + re-encode an untrusted image buffer into a safe WebP data URL.
 * Throws Error with .code: EMPTY_FILE | FILE_TOO_LARGE | INVALID_IMAGE_TYPE | IMAGE_PROCESSING_FAILED
 */
export async function processImageToDataUrl(buffer, preset = 'avatar') {
  if (!buffer || !buffer.length) throw fail('EMPTY_FILE');
  if (buffer.length > MAX_IMAGE_BYTES) throw fail('FILE_TOO_LARGE');

  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed || !ALLOWED_MIMES.has(sniffed.mime)) throw fail('INVALID_IMAGE_TYPE');

  const p = PRESETS[preset] || PRESETS.avatar;
  let out;
  try {
    out = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // apply EXIF orientation BEFORE metadata is stripped by re-encode
      .resize(p.width, p.height, { fit: 'cover' })
      .webp({ quality: p.quality })
      .toBuffer();
  } catch {
    // Corrupt/truncated file or pixel-bomb rejection — same client-facing outcome
    throw fail('IMAGE_PROCESSING_FAILED');
  }

  return `data:image/webp;base64,${out.toString('base64')}`;
}

/** Map pipeline error codes to a client-safe message (ID). */
export function imageErrorMessage(code) {
  switch (code) {
    case 'EMPTY_FILE': return 'Tidak ada file gambar yang diunggah';
    case 'FILE_TOO_LARGE': return 'Ukuran gambar maksimal 5MB';
    case 'INVALID_IMAGE_TYPE': return 'Format gambar harus JPG, PNG, atau WebP';
    case 'IMAGE_PROCESSING_FAILED': return 'Gambar tidak valid atau rusak';
    default: return 'Gagal memproses gambar';
  }
}
