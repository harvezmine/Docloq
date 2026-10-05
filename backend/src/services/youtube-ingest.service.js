// YouTube transcripts. The host is fixed so there is no SSRF surface, but the library scrapes
// an undocumented endpoint and will break when YouTube changes it — fail soft and say why.

import { YoutubeTranscript } from 'youtube-transcript';
import { safeFetch } from './ssrf-guard.js';

const ID_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function parseYouTubeId(url) {
  const m = String(url || '').match(ID_RE);
  return m ? m[1] : null;
}

async function fetchYouTubeTitle(id) {
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await safeFetch(oembed, {
      method: 'GET',
      headers: {
        'User-Agent': 'DocLoq-AI-Project/1.0 (+https://docloq.site)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const title = (data?.title || '').trim();
    return title ? title.slice(0, 200) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYouTubeTranscript(url) {
  const id = parseYouTubeId(url);
  if (!id) throw new Error('URL YouTube tidak valid');

  let items;
  try {
    items = await YoutubeTranscript.fetchTranscript(id);
  } catch (e) {
    throw new Error(`Transkrip tidak tersedia untuk video ini (${e.message})`);
  }
  if (!items?.length) throw new Error('Video ini tidak punya transkrip/caption');

  const text = items.map((i) => i.text).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('Transkrip video kosong');

  const title = await fetchYouTubeTitle(id);
  return { text, videoId: id, title: title || `YouTube: ${id}` };
}
