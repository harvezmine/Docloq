// One OpenAI-compatible client for every AI call (chat, tools, JSON outputs, images, embeddings).
// OPENROUTER_API_KEY set → OpenRouter; else OPENAI_API_KEY → OpenAI directly (legacy).
// Models stay bare in .env (gpt-4.1-mini); OpenRouter needs the vendor prefix, which
// modelId() adds. A name that already has one (google/…) is passed through untouched.

import OpenAI from 'openai';

const openrouterKey = process.env.OPENROUTER_API_KEY || '';
const apiKey = openrouterKey || process.env.OPENAI_API_KEY || '';

export const AI_PROVIDER = openrouterKey ? 'openrouter' : apiKey ? 'openai' : null;
export const AI_BASE_URL = openrouterKey
  ? (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1')
  : 'https://api.openai.com/v1';
export const AI_NOT_CONFIGURED = 'AI tidak terkonfigurasi (OPENROUTER_API_KEY missing)';

// Optional OpenRouter attribution headers — shows DocLoq by name in the OpenRouter dashboard.
const attribution = openrouterKey
  ? { 'HTTP-Referer': process.env.APP_URL || 'https://docloq.site', 'X-Title': 'DocLoq' }
  : {};

export const modelId = (name) =>
  (AI_PROVIDER === 'openrouter' && name && !name.includes('/') ? `openai/${name}` : name);

/** Reasoning models (gpt-5+, o-series) reject temperature and spend completion tokens thinking. */
export const isReasoningModel = (name) => /^(openai\/)?(gpt-[5-9]|o[0-9])/i.test(name || '');

export const llm = apiKey
  ? new OpenAI({ apiKey, baseURL: AI_BASE_URL, defaultHeaders: attribution })
  : null;

/** Headers for the raw-fetch call sites (analysis, embeddings). */
export const aiHeaders = () => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  ...attribution,
});
