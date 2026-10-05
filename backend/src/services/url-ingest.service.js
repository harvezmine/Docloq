// URL ingestion — fetch + extract main text via cheerio. SSRF-guarded.

import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { URL } from 'url';
import { safeFetch } from './ssrf-guard.js';

const MAX_BYTES = parseInt(process.env.AI_PROJECT_URL_MAX_BYTES || '5242880', 10); // 5 MB
const TIMEOUT_MS = 10_000;
const MAX_TEXT_LEN = 32_000;

export const fetchUrl = async (rawUrl) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    // safeFetch validates the target and every redirect hop (resolve-and-classify, not string match); see ssrf-guard.js.
    res = await safeFetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'DocLoq-AI-Project/1.0 (+https://docloq.site)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9',
        'Accept-Language': 'id,en;q=0.8',
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('URL fetch timeout (>10s)');
    if (err.message?.startsWith('SSRF_BLOCKED')) {
      throw new Error('URL ke host privat/lokal tidak diizinkan');
    }
    throw new Error(`Gagal fetch URL: ${err.message}`);
  }
  clearTimeout(timer);

  const url = new URL(res.url || rawUrl);

  if (!res.ok) throw new Error(`URL respond HTTP ${res.status}`);

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BYTES) throw new Error(`URL terlalu besar (>${Math.round(MAX_BYTES / 1_048_576)} MB)`);

  const contentType = res.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/xhtml/.test(contentType)) {
    throw new Error(`Content-type tidak didukung: ${contentType}`);
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      try { reader.cancel(); } catch { /* ignore */ }
      throw new Error(`URL melebihi ${Math.round(MAX_BYTES / 1_048_576)} MB saat streaming`);
    }
    chunks.push(value);
  }
  const html = new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));

  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, nav, footer, header, aside, form, button, svg').remove();

  const title = $('title').first().text().trim()
    || $('meta[property="og:title"]').attr('content')
    || url.hostname;

  // Prioritize semantic containers
  let text = '';
  const containers = ['main', 'article', '[role="main"]', '#content', '.content', '.post', '.entry'];
  for (const sel of containers) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      if (text.trim().length > 200) break;
    }
  }
  if (!text || text.trim().length < 200) {
    text = $('body').text();
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length === 0) throw new Error('Tidak ada konten teks yang bisa diekstrak dari URL ini');

  if (text.length > MAX_TEXT_LEN) text = text.slice(0, MAX_TEXT_LEN);

  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  return {
    title: title.slice(0, 200),
    text,
    contentHash,
    url: url.href,
  };
};
