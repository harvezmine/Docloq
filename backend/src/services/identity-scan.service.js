// Local identifier detection — deterministic, no LLM, nothing leaves the process.
// The compliance scan uses this so it can report identifiers without ever sending them out.

// Quantifiers are bounded: unbounded `+` is O(n^2) on pathological input (ReDoS).
const PATTERNS = {
  email: /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})+/g,
  phone: /(?:\+62|62|0)8[0-9]{2}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}\b/g,
  // NIK/NPWP allow separators — KTP cards group the digits ("3175 0312 3456 7890").
  npwp: /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d[\s.-]?\d{3}[\s.-]?\d{3}\b|\b\d{15}\b/g,
  nik: /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b|\b\d{16}\b/g,
};

// Order matters: email first so its digits aren't read as a phone, and NPWP's 15-digit form
// before NIK's 16 so neither claims the other's span.
const SCAN_ORDER = ['email', 'phone', 'npwp', 'nik'];

export const IDENTIFIER_TYPES = Object.freeze(Object.keys(PATTERNS));

/**
 * @param {string} text
 * @returns {{counts: Record<string,number>, total: number, hits: Array<{type,index,length}>}}
 *   hits carry offsets only — never the matched value.
 */
export function scanIdentifiers(text) {
  const counts = Object.fromEntries(IDENTIFIER_TYPES.map((t) => [t, 0]));
  const hits = [];
  if (!text || typeof text !== 'string') return { counts, total: 0, hits };

  // Claimed spans stop one identifier being counted under two types.
  const claimed = [];
  const overlaps = (a, b) => claimed.some(([s, e]) => a < e && b > s);

  for (const type of SCAN_ORDER) {
    const re = new RegExp(PATTERNS[type].source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; }
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      claimed.push([start, end]);
      counts[type] += 1;
      hits.push({ type, index: start, length: m[0].length });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  return { counts, total: hits.length, hits };
}
