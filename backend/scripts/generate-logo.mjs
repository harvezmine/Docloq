// One-off: generate the DocLoq sidebar mark with gpt-image-1.
// White glyph on a transparent background, so it sits on the accent-colored tile
// and inherits whatever accent the user picked.
//
//   node scripts/generate-logo.mjs [outDir]

import 'dotenv/config';
import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const outDir = process.argv[2] || path.join(process.cwd(), '..', 'frontend', 'public', 'brand');
mkdirSync(outDir, { recursive: true });

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY missing in backend/.env');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VARIANTS = [
  {
    name: 'mark-lock',
    prompt: `A minimalist app icon glyph, pure solid white on a fully transparent background.
The glyph: a simple geometric letter D whose vertical stem doubles as the body of a padlock,
with a small clean semicircular shackle arcing from the top of the D.
Flat solid white shapes only. Uniform thick strokes. Strong geometric construction,
generous negative space, rounded corners. No gradient, no shading, no 3D, no outline,
no text, no drop shadow, no background color whatsoever.
Centered with even padding. Must stay legible at 24 pixels.`,
  },
  {
    name: 'mark-doc',
    prompt: `A minimalist app icon glyph, pure solid white on a fully transparent background.
The glyph: a simple document sheet with one folded corner, and a small keyhole shape
cut out of its center as negative space.
Flat solid white shapes only. Uniform thick strokes, rounded corners, strictly geometric.
No gradient, no shading, no 3D, no text, no drop shadow, no background color whatsoever.
Centered with even padding. Must stay legible at 24 pixels.`,
  },
  {
    name: 'mark-shield',
    prompt: `A minimalist app icon glyph, pure solid white on a fully transparent background.
The glyph: a rounded shield silhouette containing three short horizontal bars of
decreasing width, suggesting lines of text on a document.
Flat solid white shapes only. Bold uniform weight, rounded corners, geometric and symmetrical.
No gradient, no shading, no 3D, no text, no drop shadow, no background color whatsoever.
Centered with even padding. Must stay legible at 24 pixels.`,
  },
];

const results = [];
for (const v of VARIANTS) {
  process.stdout.write(`generating ${v.name}... `);
  try {
    const res = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: v.prompt,
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png',
      quality: 'high',
      n: 1,
    });
    const b64 = res?.data?.[0]?.b64_json;
    if (!b64) throw new Error('no image returned');
    const file = path.join(outDir, `docloq-${v.name}.png`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('OK ->', file);
    results.push(file);
  } catch (e) {
    console.log('FAILED:', e.message);
  }
}

console.log(`\n${results.length}/${VARIANTS.length} generated in ${outDir}`);
