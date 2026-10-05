// Pure text → chunk splitting. Chunks never span a page boundary, so citations stay page-exact.

const DEFAULT_CHUNK_CHARS = parseInt(process.env.AI_PROJECT_CHUNK_CHARS || '3200', 10);
const DEFAULT_OVERLAP_CHARS = parseInt(process.env.AI_PROJECT_CHUNK_OVERLAP || '400', 10);
const BOUNDARY_LOOKBACK = 200;

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;

/** Largest end <= start+limit that breaks on whitespace and never mid-surrogate-pair. */
function findBreak(text, start, limit) {
  let end = Math.min(start + limit, text.length);
  if (end >= text.length) return text.length;

  const floor = Math.max(start + 1, end - BOUNDARY_LOOKBACK);
  for (let i = end; i > floor; i--) {
    if (/\s/.test(text[i - 1])) return i;
  }
  if (isHighSurrogate(text.charCodeAt(end - 1))) end -= 1;
  return Math.max(end, start + 1);
}

/**
 * @param {Array<{page: number|null, text: string}>} pages
 * @param {{chunkChars?: number, overlapChars?: number}} [opts]
 * @returns {Array<{chunkIndex: number, page: number|null, text: string}>}
 */
export function chunkPages(pages, opts = {}) {
  const chunkChars = opts.chunkChars ?? DEFAULT_CHUNK_CHARS;
  // Clamped so the loop always advances.
  const overlapChars = Math.min(opts.overlapChars ?? DEFAULT_OVERLAP_CHARS, Math.floor(chunkChars / 2));

  const out = [];
  let chunkIndex = 0;

  for (const { page, text } of pages || []) {
    const body = (text || '').trim();
    if (!body) continue;

    let start = 0;
    while (start < body.length) {
      const end = findBreak(body, start, chunkChars);
      const piece = body.slice(start, end).trim();
      if (piece) out.push({ chunkIndex: chunkIndex++, page: page ?? null, text: piece });

      if (end >= body.length) break;
      let next = end - overlapChars;
      // Surrogate nudge before the progress guard, or the decrement can cancel it and spin.
      if (next > 0 && isHighSurrogate(body.charCodeAt(next - 1))) next -= 1;
      if (next <= start) next = end;
      start = next;
    }
  }

  return out;
}

export const CHUNK_DEFAULTS = { chunkChars: DEFAULT_CHUNK_CHARS, overlapChars: DEFAULT_OVERLAP_CHARS };
