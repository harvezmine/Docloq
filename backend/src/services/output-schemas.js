// Per-kind JSON schema + prompt for Studio outputs. Pure config, no I/O.
//
// strict mode needs additionalProperties:false and every property in required[] — optional
// fields are not expressible — and rejects $ref cycles, so mindmap depth is unrolled.

import { scanIdentifiers, IDENTIFIER_TYPES } from './identity-scan.service.js';

const CITATION_RULES = `
Setiap klaim WAJIB diakhiri citation [N] yang merujuk ke <source id="N">.
Kalau sebuah fakta tidak ada di sources, JANGAN tulis. Jangan mengarang.
Kalau sumber tidak cukup untuk output ini, kembalikan array/obyek kosong.`;

// Image briefs are drawn verbatim by the image model, so they must never carry [N] markers.
const IMAGE_RULES = `
Hanya pakai fakta yang ada di sources; jangan mengarang. JANGAN tulis penanda sumber seperti [1] atau [2].
Kalau sumber tidak cukup, kembalikan array kosong.`;

// [1], [1, 2], [1-3], [1][2] plus the space before them. Text outputs keep the markers in storage
// (they map claims to sources for citations + provenance); they are stripped when served.
const MARKER_RE = /[ \t]*\[\d+(?:\s*[,–-]\s*\d+)*\](?:[ \t]*\[\d+(?:\s*[,–-]\s*\d+)*\])*/g;
export function stripCitationMarkers(value) {
  if (typeof value === 'string') return value.replace(MARKER_RE, '').replace(/\*\*[ \t]*\*\*/g, '');
  if (Array.isArray(value)) return value.map(stripCitationMarkers);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripCitationMarkers(v)]));
  }
  return value;
}

// Topic → palette guide shared by slides and images, so the design follows the document's
// subject instead of one house palette. Purple/neon are excluded (reads as generic "AI").
const PALETTE_GUIDE = `Pilih warna dari topik dokumen, contoh: hukum/kontrak/properti = navy & hijau tua;
keselamatan kerja (K3) = oranye tua & navy; kesehatan/medis = teal & hijau; keuangan/pajak = biru tua & emas tua;
SDM/pendidikan = biru & kuning tua; lingkungan/pertanian = hijau & cokelat tanah; teknologi/keamanan = biru & cyan gelap;
pemasaran/penjualan = merah bata & abu gelap; pemerintahan = merah tua & navy. Hindari ungu/violet, neon, dan pastel pucat;
warna utama harus cukup gelap untuk teks putih di atasnya.`;

// The text model designs each image for its subject instead of one fixed palette.
const VISUAL_PROMPT = `
visual: arahkan desain sesuai topik dokumen. subject = topik dalam bahasa Inggris (3-6 kata).
tone = karakter visual yang cocok dengan topik. palette = 2-3 warna hex. ${PALETTE_GUIDE}
motif = 2-4 ikon/objek visual yang relevan dengan topik, bahasa Inggris (mis. "office building, keys, calendar").`;

const VISUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'tone', 'palette', 'motif'],
  properties: {
    subject: { type: 'string' },
    tone: { type: 'string', enum: ['formal', 'modern', 'warm', 'technical', 'editorial'] },
    palette: { type: 'array', items: { type: 'string', description: 'Hex, mis. "#1f4e79".' } },
    motif: { type: 'string' },
  },
};

const HEX_RE = /^#[0-9a-f]{6}$/i;
// Brand cobalt + teal when the model's palette is missing or malformed.
const FALLBACK_PALETTE = ['#226bc0', '#0f766e'];

function visualDirection(visual = {}) {
  const palette = (visual.palette || []).map((c) => String(c).trim()).filter((c) => HEX_RE.test(c)).slice(0, 3);
  const colors = palette.length ? palette : FALLBACK_PALETTE;
  return `Design it specifically for the subject "${visual.subject || 'the document topic'}": a ${visual.tone || 'modern'} visual identity, ` +
    `with small flat icons drawn from: ${visual.motif || 'documents, data, checklists'}. ` +
    `Color: use ONLY ${colors.join(', ')} as accent colors (plus lighter tints of them) on an off-white #F8FAFC background ` +
    `with near-black #0F172A body text. Any colored text uses only the darkest of these colors; lighter or yellow tones ` +
    `are for icons, fills and accents only, never for text on a light background. ` +
    `No rainbow palette, no purple, no neon, no gradients, no glow. `;
}

const LEGIBILITY = `Typography: one clean sans-serif, high contrast, large readable sizes, every label spelled EXACTLY as written ` +
  `(keep the Indonesian words, numbers and currency as given), no extra words, no reference numbers or square brackets, ` +
  `no gibberish, no watermark. `;

const SPECS = {
  summary: {
    title: 'Ringkasan',
    prompt: `Buat ringkasan komprehensif dari SEMUA sources dalam markdown.
Struktur: paragraf pembuka, lalu poin-poin utama, lalu kesimpulan.
Gunakan **bold** untuk istilah kunci. Jangan pakai heading level 1.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['markdown'],
      properties: {
        markdown: { type: 'string', description: 'Ringkasan dalam markdown, dengan citation [N].' },
      },
    },
  },

  report: {
    title: 'Laporan',
    prompt: `Buat laporan komprehensif dari SEMUA sources dalam markdown.
Struktur: judul, ringkasan eksekutif, temuan utama sebagai poin, lalu kesimpulan.
Gunakan **bold** untuk istilah kunci. Jangan pakai heading level 1.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['markdown'],
      properties: {
        markdown: { type: 'string', description: 'Laporan markdown dengan citation [N].' },
      },
    },
  },

  faq: {
    title: 'FAQ',
    prompt: `Susun 5-12 pertanyaan yang paling mungkin ditanyakan tentang isi sources, beserta jawabannya.
Pertanyaan harus spesifik ke isi dokumen, bukan generik.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['question', 'answer'],
            properties: {
              question: { type: 'string' },
              answer: { type: 'string', description: 'Jawaban dengan citation [N].' },
            },
          },
        },
      },
    },
  },

  timeline: {
    title: 'Timeline',
    prompt: `Ekstrak semua peristiwa, tenggat, milestone dan termin pembayaran yang punya waktu.
Urutkan kronologis. date: ISO-8601 (YYYY-MM-DD) kalau tanggalnya pasti; kalau hanya relatif
("30 hari setelah tanda tangan"), tulis apa adanya di date dan jelaskan di description.
Kalau tidak ada peristiwa berwaktu, kembalikan events: []. Jangan mengarang tanggal.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['events'],
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'title', 'description'],
            properties: {
              date: { type: 'string', description: 'ISO-8601 atau deskripsi relatif apa adanya.' },
              title: { type: 'string' },
              description: { type: 'string', description: 'Dengan citation [N].' },
            },
          },
        },
      },
    },
  },

  datatable: {
    title: 'Tabel Data',
    prompt: `Ekstrak data terstruktur dari sources menjadi tabel — misalnya pihak, kewajiban, nilai,
tanggal, atau klausul. Pilih kolom yang paling informatif untuk isi dokumen ini (maksimal 6 kolom).
Setiap cell berisi teks singkat, dan jumlah cells harus sama dengan jumlah columns.
Sertakan citation [N] di cell terakhir tiap baris.
Kalau tidak ada data yang bisa ditabelkan, kembalikan columns: [] dan rows: []. Jangan mengarang.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['columns', 'rows'],
      properties: {
        columns: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'label'],
            properties: { key: { type: 'string' }, label: { type: 'string' } },
          },
        },
        // Cells are positional rather than a keyed object: strict json_schema cannot express
        // "an object whose keys come from another field's values".
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['cells'],
            properties: { cells: { type: 'array', items: { type: 'string' } } },
          },
        },
      },
    },
  },

  mindmap: {
    title: 'Mind Map',
    image: true,
    size: '1536x1024',
    // The text model turns the sources into a compact hierarchical outline; that outline is
    // handed to gpt-image as a diagram brief.
    prompt: `Ekstrak struktur konsep dari sources sebagai outline hierarkis ringkas (maks 3 level,
maks 6 cabang utama, label 2-5 kata). Ini akan digambar sebagai mind map, jadi ringkas dan jelas.${IMAGE_RULES}${VISUAL_PROMPT}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['root', 'visual'],
      properties: {
        visual: VISUAL_SCHEMA,
        // Depth is unrolled, not recursive: strict mode rejects $ref cycles, and an unbounded
        // tree would be unrenderable in a 288px panel anyway.
        root: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'children'],
          properties: {
            label: { type: 'string' },
            children: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['label', 'children'],
                properties: {
                  label: { type: 'string' },
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['label'],
                      properties: { label: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // Compose the gpt-image prompt from the outline the text model returned.
    imagePrompt: (raw, instructions) => {
      const data = stripCitationMarkers(raw);
      const branches = (data.root?.children || [])
        .map((c) => `"${c.label}" -> {${(c.children || []).map((g) => `"${g.label}"`).join(', ')}}`)
        .join('; ');
      return `A clean, presentation-quality mind map diagram, landscape. ` + visualDirection(data.visual) +
        `Central node, the largest element, filled with the first accent color with white text: "${data.root?.label || ''}". ` +
        `Main branches radiate evenly around it as rounded cards, each with one small icon; alternate the accent colors ` +
        `between branches, and draw each branch's sub-items as lighter tinted cards joined by smooth lines: ${branches}. ` +
        LEGIBILITY + `Flat vector style, balanced composition, generous whitespace.` +
        (instructions ? ` Extra guidance from the user: ${instructions}.` : '');
    },
  },

  compliance: {
    title: 'Pemeriksaan Kepatuhan',
    // Identifiers are counted HERE, locally — the LLM never sees them. A scanner that asked
    // the model to find NIKs would ship every NIK to OpenAI, which is the thing it warns about.
    enrich: (snippets) => {
      const perSource = new Map();
      for (const s of snippets) {
        const r = scanIdentifiers(s.text);
        if (!r.total) continue;
        const cur = perSource.get(s.sourceId) || {
          sourceNumber: s.sourceNumber,
          title: s.title,
          counts: Object.fromEntries(IDENTIFIER_TYPES.map((t) => [t, 0])),
          total: 0,
        };
        for (const t of IDENTIFIER_TYPES) cur.counts[t] += r.counts[t];
        cur.total += r.total;
        perSource.set(s.sourceId, cur);
      }
      return { identityFindings: [...perSource.values()].sort((a, b) => b.total - a.total) };
    },
    prompt: `Periksa risiko kepatuhan dan kelengkapan dokumen dari sources.
Cari: klausul penting yang hilang (kerahasiaan, pemutusan, force majeure, penyelesaian sengketa,
perlindungan data), kewajiban yang timpang, tanggal atau nilai yang ambigu, dan risiko hukum lain.
severity: "tinggi" | "sedang" | "rendah". Beri rekomendasi konkret dan bisa dikerjakan.
JANGAN menyalin nomor identitas apapun ke dalam output. Jangan mengarang.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['risks'],
      properties: {
        risks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['severity', 'title', 'description', 'recommendation'],
            properties: {
              severity: { type: 'string', enum: ['tinggi', 'sedang', 'rendah'] },
              title: { type: 'string' },
              description: { type: 'string', description: 'Dengan citation [N].' },
              recommendation: { type: 'string' },
            },
          },
        },
      },
    },
  },

  slides: {
    title: 'Slide Deck',
    prompt: `Rancang deck presentasi 6-12 slide dari sources.
Slide pertama = layout 'title' (judul deck); subtitle = satu kalimat konteks. Slide terakhir = kesimpulan / next steps.
Untuk tiap slide pilih layout yang paling cocok: 'title' | 'bullets' | 'two-col' | 'quote' | 'section'.
'quote' = bullets[0] adalah kutipan/pernyataan kunci, bullets[1] (opsional) sumber/konteksnya.
'two-col' = bullets dibagi dua kelompok sama besar (mis. kewajiban vs hak, sebelum vs sesudah).
'section' = pembatas bagian (title = nama bagian, bullets[0] = satu kalimat pengantar).
Variasikan layout: minimal 3 jenis berbeda; deck > 7 slide pakai 'section' untuk tiap bagian besar;
pakai 'quote' bila ada satu pernyataan/angka kunci yang layak ditonjolkan.
bullets 3-5 per slide, satu kalimat pendek (maks 18 kata). notes = catatan pembicara singkat.
theme: rancang sesuai topik dokumen. accent & secondary = hex. ${PALETTE_GUIDE}
dark = true hanya bila topiknya cocok dengan nuansa gelap (mis. teknologi, keamanan siber).
style: formal (hukum, pemerintahan, keuangan), modern (bisnis, produk, pemasaran),
warm (SDM, edukasi, kesehatan, sosial), technical (IT, engineering, data, K3/operasional).${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['theme', 'subtitle', 'slides'],
      properties: {
        theme: {
          type: 'object',
          additionalProperties: false,
          required: ['accent', 'secondary', 'dark', 'style'],
          properties: {
            accent: { type: 'string', description: 'Hex warna aksen utama, mis. "#1f4e79".' },
            secondary: { type: 'string', description: 'Hex warna pendamping, mis. "#2e7d5b".' },
            dark: { type: 'boolean' },
            style: { type: 'string', enum: ['formal', 'modern', 'warm', 'technical'] },
          },
        },
        subtitle: { type: 'string' },
        slides: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['layout', 'title', 'bullets', 'notes'],
            properties: {
              layout: { type: 'string', enum: ['title', 'bullets', 'two-col', 'quote', 'section'] },
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string', description: 'Dengan citation [N].' } },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
  },

  infographic: {
    title: 'Infografis',
    image: true,
    size: '1024x1536',
    prompt: `Ekstrak 5-8 fakta/angka/poin paling penting dari sources untuk sebuah infografis satu halaman.
Tiap poin singkat: label 1-4 kata + detail maks 10 kata (angka/nilai di depan bila ada, tanpa tanda baca di akhir).
isSequence = true bila poin-poin adalah tahapan/urutan waktu. Ini akan digambar sebagai infografis.${IMAGE_RULES}${VISUAL_PROMPT}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'points', 'isSequence', 'visual'],
      properties: {
        title: { type: 'string' },
        isSequence: { type: 'boolean' },
        visual: VISUAL_SCHEMA,
        points: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'detail'],
            properties: { label: { type: 'string' }, detail: { type: 'string' } },
          },
        },
      },
    },
    imagePrompt: (raw, instructions) => {
      const data = stripCitationMarkers(raw);
      const points = (data.points || []).map((p, i) => `${i + 1}. label "${p.label}", detail "${p.detail}"`).join('; ');
      const body = data.isSequence
        ? `Below the header, a numbered vertical flow of steps connected by a line, one step per item`
        : `Below the header, a clean two-column grid of fact cards`;
      return `A one-page editorial infographic, portrait, magazine quality. ` + visualDirection(data.visual) +
        `Header band filled with the first accent color, the title in large white type: "${data.title || ''}", ` +
        `next to a simple flat illustration of the subject. ${body}; each item has one small icon, the detail's key ` +
        `number or phrase large and bold in an accent color, and the label in dark text: ${points}. ` +
        LEGIBILITY + `Clear hierarchy, aligned grid, consistent icon style, generous margins.` +
        (instructions ? ` Extra guidance from the user: ${instructions}.` : '');
    },
  },
};

export const OUTPUT_KINDS = Object.freeze(Object.keys(SPECS));

/** Own-property check: `SPECS[kind]` truthiness would let '__proto__'/'constructor' through. */
export const isValidKind = (kind) =>
  typeof kind === 'string' && Object.prototype.hasOwnProperty.call(SPECS, kind);

export function getOutputSpec(kind) {
  if (!isValidKind(kind)) throw new Error(`kind tidak valid: ${kind}`);
  return SPECS[kind];
}

// Kinds surfaced in the Studio grid, in display order. faq/timeline/datatable/compliance stay
// in SPECS (API-reachable, tests green) but are intentionally NOT here.
export const STUDIO_KINDS = Object.freeze(['report', 'slides', 'mindmap', 'infographic']);

// Kinds whose result is a generated PNG, not a text payload.
export const IMAGE_KINDS = Object.freeze(['mindmap', 'infographic']);
export const isImageKind = (kind) => IMAGE_KINDS.includes(kind);
