// Thin wrapper over Serper.dev (Google results as JSON). Fallback web-search
// provider for OSINT discovery when Google CSE is unavailable/misconfigured.
// Uses global fetch so tests can stub it. Normalized output matches googleSearch:
// [{ url, title, snippet }].
const ENDPOINT = 'https://google.serper.dev/search';

export async function serperSearch(query, { num = 10, timeoutMs = 8000 } = {}) {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('SERPER_NOT_CONFIGURED');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      // num capped at 10 → one Serper credit per query (frugal by default).
      body: JSON.stringify({ q: query, num: Math.min(num, 10) }),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('SERPER_TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`SERPER_HTTP_${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.organic) ? data.organic : [];
  return items.map((it) => ({ url: it.link, title: it.title || '', snippet: it.snippet || '' }));
}
