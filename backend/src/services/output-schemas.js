// Per-kind JSON schema + prompt for Studio outputs. Pure config, no I/O.
//
// strict mode needs additionalProperties:false and every property in required[] — optional
// fields are not expressible — and rejects $ref cycles, so mindmap depth is unrolled.

import { scanIdentifiers, IDENTIFIER_TYPES } from './identity-scan.service.js';

const CITATION_RULES = `
Setiap klaim WAJIB diakhiri citation [N] yang merujuk ke <source id="N">.
Kalau sebuah fakta tidak ada di sources, JANGAN tulis. Jangan mengarang.
Kalau sumber tidak cukup untuk output ini, kembalikan array/obyek kosong.`;

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
maks 6 cabang utama, label 2-5 kata). Ini akan digambar sebagai mind map, jadi ringkas dan jelas.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['root'],
      properties: {
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
    imagePrompt: (data, instructions) =>
      `A polished, professional mind map diagram, radial layout, presentation quality. ` +
      `Central node (emphasized, largest): "${data.root?.label || ''}". ` +
      `Main branches radiating outward, each a distinct color from a cohesive modern palette ` +
      `(indigo #4f46e5, violet #7c3aed, teal #0d9488, amber #d97706, rose #e11d48): ` +
      `${(data.root?.children || []).map((c) => `"${c.label}" -> [${(c.children || []).map((g) => g.label).join(', ')}]`).join('; ')}. ` +
      `Rounded rectangular node cards with soft shadows, smooth curved connector lines, clear visual hierarchy, ` +
      `balanced spacing, crisp legible sans-serif labels spelled EXACTLY as written, correct spelling, no gibberish text, ` +
      `clean flat vector style, plenty of whitespace, solid white background, no watermark.` +
      (instructions ? ` Extra guidance: ${instructions}.` : ''),
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
Slide pertama = judul + konteks. Slide terakhir = kesimpulan / next steps.
Untuk tiap slide pilih layout yang paling cocok: 'title' | 'bullets' | 'two-col' | 'quote' | 'section'.
bullets 3-5 per slide, satu kalimat. notes = catatan pembicara singkat.
theme: pilih satu palet yang cocok dengan isi (accent hex + apakah gelap).${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['theme', 'slides'],
      properties: {
        theme: {
          type: 'object',
          additionalProperties: false,
          required: ['accent', 'dark'],
          properties: {
            accent: { type: 'string', description: 'Hex warna aksen, mis. "#4f46e5".' },
            dark: { type: 'boolean' },
          },
        },
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
Tiap poin singkat (label + nilai bila ada). Ini akan digambar sebagai infografis.${CITATION_RULES}`,
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'points'],
      properties: {
        title: { type: 'string' },
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
    imagePrompt: (data, instructions) =>
      `A premium one-page editorial infographic, portrait orientation, professional data-visualization aesthetic. ` +
      `Bold title header at the top: "${data.title || ''}". ` +
      `Below it, a clean grid of stat/fact cards, each with a simple line icon, a large emphasized value and a short label: ` +
      `${(data.points || []).map((p, i) => `${i + 1}. "${p.label}" = "${p.detail}"`).join('; ')}. ` +
      `Cohesive palette (indigo #4f46e5 and violet #7c3aed accents on a light neutral background), consistent iconography, ` +
      `strong visual hierarchy, generous margins, crisp legible sans-serif typography spelled EXACTLY as written, correct spelling, ` +
      `no gibberish or placeholder text, modern flat design, high resolution, no watermark.` +
      (instructions ? ` Extra guidance: ${instructions}.` : ''),
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
