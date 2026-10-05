import 'dotenv/config';
import OpenAI from 'openai';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const outDir = process.argv[2] || path.join(process.cwd(), '..', 'frontend', 'public');
mkdirSync(outDir, { recursive: true });

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY missing in backend/.env');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE = `A friendly mascot character for an AI research assistant, modern flat vector
illustration, clean and minimal. The character is a soft, rounded, approachable little AI robot
with a smooth rounded head, large calm friendly eyes, and a gentle smile, holding or reading an
open document/notebook. Brand palette: indigo and violet (#4f46e5, #7c3aed) with soft highlights,
subtle depth, no harsh outlines. Centered composition, front-facing, generous even padding,
fully transparent background. No text, no letters, no logo, no drop shadow on the background.
Crisp, high quality, must stay legible and recognizable when cropped to a small circle at 32 pixels.`;

const VARIANTS = [
  { name: 'ai-project-mascot', prompt: BASE },
  {
    name: 'ai-project-mascot-alt-1',
    prompt: `${BASE}\nVariation: the assistant is a friendly owl-like scholar character (owl = knowledge)
wearing tiny round glasses, perched over an open book, same indigo/violet flat vector style.`,
  },
];

const results = [];
for (const v of VARIANTS) {
  process.stdout.write(`generating ${v.name}... `);
  try {
    const res = await openai.images.generate({
      model: process.env.AI_IMAGE_MODEL || 'gpt-image-2',
      prompt: v.prompt,
      size: '1024x1024',
      background: 'transparent',
      output_format: 'png',
      quality: 'high',
      n: 1,
    });
    const b64 = res?.data?.[0]?.b64_json;
    if (!b64) throw new Error('no image returned');
    const file = path.join(outDir, `${v.name}.png`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log('OK ->', file);
    results.push(file);
  } catch (e) {
    console.log('FAILED:', e.message);
  }
}

console.log(`\n${results.length}/${VARIANTS.length} generated in ${outDir}`);
