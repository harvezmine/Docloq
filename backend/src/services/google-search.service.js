// Thin wrapper over the Google Custom Search JSON API.
// Uses global fetch so tests can stub it.
const ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

export async function googleSearch(query, { num = 10, timeoutMs = 8000 } = {}) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) throw new Error('GOOGLE_CSE_NOT_CONFIGURED');

  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}`
    + `&q=${encodeURIComponent(query)}&num=${Math.min(num, 10)}`;

  // Bound the request so a slow/hung API call can't stall the whole scan.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('GOOGLE_TIMEOUT');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`GOOGLE_HTTP_${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((it) => ({ url: it.link, title: it.title || '', snippet: it.snippet || '' }));
}
