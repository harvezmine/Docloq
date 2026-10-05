// Thin wrapper over a self-hosted SearXNG instance (meta search engine).
// Provides web-search results in the same normalized format as Google CSE / Serper.
// SearXNG JSON API: GET {SEARXNG_URL}/search?q=…&format=json
//
// Required env:
//   SEARXNG_URL  — base URL of the SearXNG instance (e.g. http://localhost:8888)
//
// Optional env:
//   SEARXNG_API_KEY — if your instance requires an API key (X-API-Key header)

const DEFAULT_TIMEOUT = 10000;

export async function searxngSearch(query, { num = 10, timeoutMs = DEFAULT_TIMEOUT, onLog = () => {} } = {}) {
  const baseUrl = process.env.SEARXNG_URL;
  if (!baseUrl) throw new Error('SEARXNG_NOT_CONFIGURED');

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: 'general,it,repos',
    language: 'en',
    pageno: '1',
  });

  const url = `${baseUrl.replace(/\/+$/, '')}/search?${params.toString()}`;

  const headers = { 'User-Agent': 'docloq-osint/1.0' };
  const apiKey = process.env.SEARXNG_API_KEY;
  if (apiKey) headers['X-API-Key'] = apiKey;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { headers, signal: ctrl.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('SEARXNG_TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`SEARXNG_HTTP_${res.status}`);

  const data = await res.json();
  const items = Array.isArray(data.results) ? data.results : [];

  onLog(`[searxng] ${items.length} results from engines: ${[...new Set(items.map((i) => i.engine))].join(', ') || '(none)'}`);

  return items.slice(0, num).map((it) => ({
    url: it.url,
    title: it.title || '',
    snippet: it.content || '',
  }));
}
