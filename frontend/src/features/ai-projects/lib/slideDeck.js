// Slide deck theme + PPTX export. The model picks accent/secondary/style for the deck's topic;
// everything here keeps that choice readable: text on a color fill is white or ink by contrast,
// body text is always ink-on-paper, and the accent is used for fills and markers, not body copy.

const HEX_RE = /^#?([0-9a-f]{6})$/i;
const hex = (value, fallback) => (HEX_RE.exec(String(value || '').trim())?.[1] || fallback).toUpperCase();

// WCAG relative luminance.
function luminance(h) {
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Blend `h` toward `base` by `t` (0 = h, 1 = base). Used for card tints. */
function mix(h, base, t) {
  const ch = (s, i) => parseInt(s.slice(i, i + 2), 16);
  return [0, 2, 4]
    .map((i) => Math.round(ch(h, i) * (1 - t) + ch(base, i) * t).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const INK = '0F172A';
const PAPER = 'FFFFFF';

/** Colors (6-digit hex, no #) and fonts for a deck. Old decks without these fields get the brand look. */
export function deckTheme(data) {
  const t = data?.theme || {};
  const accent = hex(t.accent, '226BC0');
  const secondary = hex(t.secondary, '0F766E');
  const dark = !!t.dark;
  const style = ['formal', 'modern', 'warm', 'technical'].includes(t.style) ? t.style : 'modern';
  return {
    accent,
    secondary,
    dark,
    style,
    bg: dark ? INK : PAPER,
    ink: dark ? 'F1F5F9' : INK,
    muted: dark ? '94A3B8' : '64748B',
    surface: dark ? '1E293B' : mix(accent, PAPER, 0.93),
    onAccent: luminance(accent) > 0.4 ? INK : PAPER,
    onSecondary: luminance(secondary) > 0.4 ? INK : PAPER,
    // Fonts that exist in PowerPoint, Keynote and (via metric-compatible substitutes) Google Slides.
    headFont: style === 'formal' ? 'Georgia' : 'Calibri',
    bodyFont: 'Calibri',
  };
}

// Server strips [N] already; this keeps decks saved before that clean too.
export const cleanText = (s) => String(s ?? '').replace(/[ \t]*\[\d+(?:\s*[,–-]\s*\d+)*\]/g, '').trim();

/** Split two-col bullets into two balanced groups. */
export const splitColumns = (bullets) => {
  const half = Math.ceil(bullets.length / 2);
  return [bullets.slice(0, half), bullets.slice(half)];
};

const sizeFor = (text, steps) => {
  const len = String(text || '').length;
  for (const [max, size] of steps) if (len <= max) return size;
  return steps[steps.length - 1][1];
};

// 16:9 widescreen, inches.
const W = 13.333;
const H = 7.5;
const MX = 0.8; // side margin

function footer(slide, th, deckTitle, n, total) {
  slide.addText(deckTitle, { x: MX, y: H - 0.55, w: 8, h: 0.3, fontFace: th.bodyFont, fontSize: 10, color: th.muted });
  slide.addText(`${n} / ${total}`, { x: W - MX - 2, y: H - 0.55, w: 2, h: 0.3, fontFace: th.bodyFont, fontSize: 10, color: th.muted, align: 'right' });
}

/** Bullet rows with an accent square marker, sized to the available height. */
function bulletRows(pptx, slide, th, bullets, { x, y, w, h, marker, narrow = false }) {
  if (!bullets.length) return;
  const longest = Math.max(...bullets.map((b) => b.length));
  const fontSize = narrow
    ? (bullets.length > 3 || longest > 90 ? 16 : 18)
    : (bullets.length > 4 || longest > 110 ? 18 : longest > 70 ? 20 : 22);
  const rowH = Math.min(1.25, h / bullets.length);
  // Center the marker on the first line: half a line (1.2 × size) minus half the marker.
  const markerTop = (fontSize * 1.2) / 72 / 2 - 0.065;
  bullets.forEach((text, i) => {
    const top = y + i * rowH;
    slide.addShape(pptx.ShapeType.rect, {
      x, y: top + markerTop, w: 0.13, h: 0.13, fill: { color: marker }, line: { color: marker },
    });
    slide.addText(text, {
      x: x + 0.3, y: top, w: w - 0.3, h: rowH, fontFace: th.bodyFont, fontSize, color: th.ink,
      valign: 'top', margin: 0, lineSpacingMultiple: 1.1, fit: 'shrink',
    });
  });
}

function slideTitle(pptx, slide, th, text, width = W - 2 * MX) {
  slide.addShape(pptx.ShapeType.rect, { x: MX, y: 0.7, w: 0.7, h: 0.08, fill: { color: th.accent }, line: { color: th.accent } });
  slide.addText(text, {
    x: MX, y: 0.9, w: width, h: 1.1, fontFace: th.headFont, bold: true, color: th.ink,
    fontSize: sizeFor(text, [[45, 32], [80, 26], [Infinity, 22]]), valign: 'top', margin: 0, fit: 'shrink',
  });
}

export async function downloadSlidesPptx(deckTitle, data, fileTitle = 'deck') {
  // Loaded on demand: pptxgenjs is ~1MB and most sessions never export.
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deckTitle;

  const th = deckTheme(data);
  const slides = data.slides || [];
  const total = slides.length;
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  let section = 0;

  slides.forEach((s, idx) => {
    const n = idx + 1;
    const title = cleanText(s.title);
    const bullets = (s.bullets || []).map(cleanText).filter(Boolean);
    const slide = pptx.addSlide();
    slide.background = { color: th.bg };

    if (s.layout === 'title') {
      // Full-bleed accent cover; the secondary band ties in the deck's second color.
      slide.background = { color: th.accent };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.35, w: W, h: 0.35, fill: { color: th.secondary }, line: { color: th.secondary } });
      slide.addShape(pptx.ShapeType.rect, { x: MX, y: 2.05, w: 1.1, h: 0.1, fill: { color: th.onAccent }, line: { color: th.onAccent } });
      slide.addText(title, {
        x: MX, y: 2.35, w: W - 2 * MX, h: 1.9, fontFace: th.headFont, bold: true, color: th.onAccent,
        fontSize: sizeFor(title, [[40, 44], [70, 36], [Infinity, 30]]), valign: 'top', margin: 0, fit: 'shrink',
      });
      const sub = idx === 0 ? cleanText(data.subtitle) || bullets[0] : bullets[0];
      if (sub) {
        slide.addText(sub, { x: MX, y: 4.35, w: W - 2 * MX - 1, h: 1.0, fontFace: th.bodyFont, fontSize: 20, color: th.onAccent, valign: 'top', margin: 0, fit: 'shrink' });
      }
      slide.addText(today, { x: MX, y: H - 1.05, w: 6, h: 0.35, fontFace: th.bodyFont, fontSize: 12, color: th.onAccent });
    } else if (s.layout === 'section') {
      section += 1;
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.4, h: H, fill: { color: th.accent }, line: { color: th.accent } });
      slide.addText(String(section).padStart(2, '0'), {
        x: 0.6, y: 2.4, w: 3.4, h: 2, fontFace: th.headFont, bold: true, fontSize: 96, color: th.onAccent, margin: 0,
      });
      slide.addText(title, {
        x: 5.1, y: 2.4, w: W - 5.1 - MX, h: 1.6, fontFace: th.headFont, bold: true, color: th.ink,
        fontSize: sizeFor(title, [[40, 36], [70, 30], [Infinity, 26]]), valign: 'bottom', margin: 0, fit: 'shrink',
      });
      if (bullets[0]) {
        slide.addText(bullets[0], { x: 5.1, y: 4.15, w: W - 5.1 - MX, h: 1.4, fontFace: th.bodyFont, fontSize: 18, color: th.muted, valign: 'top', margin: 0, fit: 'shrink' });
      }
      footer(slide, th, deckTitle, n, total);
    } else if (s.layout === 'quote') {
      slide.background = { color: th.surface };
      slide.addText(title, { x: MX, y: 0.7, w: W - 2 * MX, h: 0.5, fontFace: th.bodyFont, fontSize: 14, bold: true, color: th.muted, margin: 0 });
      slide.addText('“', { x: MX - 0.1, y: 1.2, w: 1.5, h: 1.6, fontFace: 'Georgia', fontSize: 120, color: th.accent, margin: 0 });
      slide.addText(bullets[0] || title, {
        x: 1.9, y: 1.9, w: W - 1.9 - MX - 0.4, h: 3.2, fontFace: th.headFont, italic: true, color: th.ink,
        fontSize: sizeFor(bullets[0], [[90, 32], [160, 26], [Infinity, 22]]), valign: 'middle', margin: 0, fit: 'shrink',
      });
      if (bullets[1]) {
        slide.addText(`— ${bullets[1]}`, { x: 1.9, y: 5.25, w: W - 1.9 - MX, h: 0.6, fontFace: th.bodyFont, fontSize: 16, color: th.muted, margin: 0, fit: 'shrink' });
      }
      footer(slide, th, deckTitle, n, total);
    } else if (s.layout === 'two-col') {
      slideTitle(pptx, slide, th, title);
      const colW = (W - 2 * MX - 0.4) / 2;
      const cols = splitColumns(bullets);
      // Cards hug their content (both the same height) instead of leaving a tall empty box.
      const cardH = Math.min(4.3, 0.75 + Math.max(...cols.map((col) => col.length)) * 1.0);
      cols.forEach((col, c) => {
        const x = MX + c * (colW + 0.4);
        const bar = c === 0 ? th.accent : th.secondary;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.25, w: colW, h: cardH, fill: { color: th.surface }, line: { color: th.surface }, rectRadius: 0.08 });
        slide.addShape(pptx.ShapeType.rect, { x, y: 2.25, w: colW, h: 0.09, fill: { color: bar }, line: { color: bar } });
        bulletRows(pptx, slide, th, col, { x: x + 0.35, y: 2.65, w: colW - 0.7, h: cardH - 0.65, marker: bar, narrow: true });
      });
      footer(slide, th, deckTitle, n, total);
    } else {
      slideTitle(pptx, slide, th, title);
      bulletRows(pptx, slide, th, bullets, { x: MX + 0.05, y: 2.3, w: W - 2 * MX - 0.05, h: 4.3, marker: th.accent });
      footer(slide, th, deckTitle, n, total);
    }

    if (s.notes) slide.addNotes(cleanText(s.notes));
  });

  await pptx.writeFile({ fileName: `${fileTitle.replace(/[^\w-]+/g, '-').toLowerCase()}.pptx` });
}
