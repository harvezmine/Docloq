// Web-search provider selector: tries providers in OSINT_SEARCH_PROVIDERS order, falling back on error/misconfig (e.g. Google CSE 403 → Serper).
import { googleSearch } from './google-search.service.js';
import { serperSearch } from './serper-search.service.js';
import { searxngSearch } from './searxng-search.service.js';

const PROVIDERS = {
  google_cse: googleSearch,
  serper: serperSearch,
  searxng: searxngSearch,
};

/** Providers configured AND known, in order. */
export function configuredProviders() {
  return (process.env.OSINT_SEARCH_PROVIDERS || 'google_cse,serper')
    .split(',')
    .map((s) => s.trim())
    .filter((p) => PROVIDERS[p]);
}

/** Whether a provider actually has its required key(s) set. */
function providerHasKeys(name) {
  if (name === 'google_cse') return !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);
  if (name === 'serper') return !!process.env.SERPER_API_KEY;
  if (name === 'searxng') return !!process.env.SEARXNG_URL; // only URL required, API key optional
  return false;
}

/** Configured providers that are actually usable (keys present), in order. */
export function configuredProvidersWithKeys() {
  return configuredProviders().filter(providerHasKeys);
}

// Run one web search across configured providers with fallback.
// Throws the LAST provider's error (not the first) so a real failure isn't masked as "0 results".
export async function searchWeb(query, opts = {}) {
  const names = configuredProviders();
  if (names.length === 0) throw new Error('NO_SEARCH_PROVIDER');

  let lastErr = null;
  for (const name of names) {
    try {
      const results = await PROVIDERS[name](query, opts);
      return { provider: name, results };
    } catch (err) {
      lastErr = err;
      // Any failure (unconfigured, rate-limit, http, timeout) → try the next provider.
      opts.onLog?.(`[search] ${name} failed: ${err.message}`);
    }
  }
  throw lastErr || new Error('NO_SEARCH_PROVIDER');
}
