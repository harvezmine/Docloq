// OSINT discovery: search the public web for tracked-doc canary codes, then attribute hits via the visible code.
import { db } from '../db/index.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { documents, downloadWatermarks, leakScans } from '../db/schema.js';
import { parseCodes, searchPrefix } from './tracking-code.service.js';
import { searchWeb } from './search-provider.js';
import { recordVisibleLeak } from './leak-scanner.service.js';
import { safeFetch } from './ssrf-guard.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Docs per OR-batched search query: keeps query length within provider limits while one batch = one provider credit.
const BATCH_SIZE = 15;

// Pure: filters search hits to de-duped matches for this doc's codes.
// If exact tracking code isn't found in text (e.g. GitHub PDF preview doesn't render PDF text),
// it falls back to matching filename/hash in the URL/Title/Snippet.
export function matchHitsToCodes(hits, doc) {
  const seen = new Set();
  const matches = [];
  for (const hit of hits) {
    if (!hit?.url || seen.has(hit.url)) continue;
    
    const combinedText = `${hit.url}\n${hit.title || ''}\n${hit.snippet || ''}\n${hit.text || ''}`;
    
    // 1. Strong match: exact DLQ code found in text
    const codes = parseCodes(combinedText).filter((c) => c.docCode === doc.code);
    if (codes.length > 0) {
      seen.add(hit.url);
      const c = codes[0];
      matches.push({ url: hit.url, docCode: c.docCode, dlCode: c.dlCode, full: c.full });
      continue;
    }
    
    // 2. Metadata match: doc's name or hash is in the search result snippet/url
    // We decode the URL so GitHub URLs with %20 (spaces) are matched correctly.
    const metaSearchStr = `${decodeURIComponent(hit.url)}\n${hit.title || ''}\n${hit.snippet || ''}`.toLowerCase();
    
    // Strip extensions for robust matching
    const originalNameBase = doc.filename ? doc.filename.replace(/\.[^/.]+$/, "").toLowerCase() : null;
    const storedNameBase = doc.storedFilename ? doc.storedFilename.replace(/\.[^/.]+$/, "").toLowerCase() : null;
    
    const hasOriginal = originalNameBase && metaSearchStr.includes(originalNameBase);
    const hasStored = storedNameBase && metaSearchStr.includes(storedNameBase);
    const hasHash = doc.contentHash && metaSearchStr.includes(doc.contentHash.toLowerCase());
    
    if (hasOriginal || hasStored || hasHash) {
      seen.add(hit.url);
      matches.push({ url: hit.url, docCode: doc.code, dlCode: null, full: searchPrefix(doc.code) });
    }
  }
  return matches;
}

// Pure: why a scan found nothing searchable. A download that carried no visible code — an
// un-stampable format, or a download predating stamping — is NOT the same as never downloaded,
// and saying so sends the user off to re-download a doc they already downloaded.
export function skipReasonFor({ isOnDemand, downloadCount, visibleCount }) {
  if (visibleCount > 0) return null;
  if (!isOnDemand) return 'no_tracked_docs';
  return downloadCount > 0 ? 'no_visible_code' : 'never_downloaded';
}

async function fetchHitText(url) {
  // SSRF-guarded: hit URLs come from third-party results and could redirect internally; safeFetch validates every hop.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await safeFetch(url, { headers: { 'User-Agent': 'docloq-osint' }, signal: ctrl.signal });
    if (!res.ok) return '';
    const t = await res.text();
    return t.length > 524288 ? t.slice(0, 524288) : t;
  } catch { return ''; } finally { clearTimeout(timer); }
}

// Scan tracked docs for one org via Google CSE.
// searchError surfaces the last search failure (e.g. 403/misconfig) so it isn't misread as "0 leaks".
export async function runDiscoveryScan(orgId, { docIds, maxQueries = 90, onLog = () => {} } = {}) {
  if (!orgId) throw new Error('runDiscoveryScan: orgId required');

  // Frugality: skip docs with no visible-coded download — they can't appear on the public web, so searching wastes queries.
  const conds = [
    eq(documents.organizationId, orgId),
    eq(documents.trackingEnabled, true),
    sql`EXISTS (SELECT 1 FROM download_watermarks dw WHERE dw.document_id = ${documents.id} AND dw.visible_code IS NOT NULL)`,
  ];
  let tracked = await db.select({ 
    id: documents.id, 
    code: documents.trackingCode, 
    filename: documents.originalFilename,
    storedFilename: documents.filename,
    contentHash: documents.contentHash,
    mimeType: documents.mimeType
  })
    .from(documents).where(and(...conds));
  if (docIds && docIds.length) tracked = tracked.filter((d) => docIds.includes(d.id));
  tracked = tracked.filter((d) => d.code);

  const scanType = (docIds && docIds.length) ? 'manual' : 'scheduled';

  // Nothing searchable: signal why so the UI shows a real reason instead of a misleading "0 leaks".
  if (tracked.length === 0) {
    const isOnDemand = !!(docIds && docIds.length);
    let downloadCount = 0;
    if (isOnDemand) {
      // Separates "never downloaded" from "downloaded, but nothing searchable was stamped".
      const [row] = await db.select({ c: sql`count(*)::int` })
        .from(downloadWatermarks)
        .where(inArray(downloadWatermarks.documentId, docIds));
      downloadCount = row?.c || 0;
    }
    return {
      scanned: 0, queries: 0, confirmed: 0, hits: 0, matches: [],
      searchError: null, searchUnavailable: false, scanId: null,
      skippedReason: skipReasonFor({ isOnDemand, downloadCount, visibleCount: 0 }),
    };
  }

  if (tracked.length > maxQueries) {
    onLog(`Query cap ${maxQueries} < ${tracked.length} tracked docs — scanning first ${maxQueries}, rest skipped this run.`);
    tracked = tracked.slice(0, maxQueries);
  }

  // Open ONE scan-summary row; every hit reuses this scanId (no per-hit scan rows).
  const [scanRow] = await db.insert(leakScans).values({
    organizationId: orgId,
    documentId: (docIds && docIds.length === 1) ? tracked[0].id : null,
    scanType,
    status: 'running',
    startedAt: new Date(),
    searchQueries: [],
    sourcesSearched: [],
    leaksFound: 0,
    createdBy: null,
  }).returning({ id: leakScans.id });
  const scanId = scanRow.id;

  let confirmed = 0;
  let searchOk = 0;
  let searchError = null;
  const matches = [];
  const queriesRun = [];
  const providersUsed = new Set();

  // OR-batch docCodes ("DLQ-a" OR "DLQ-b" OR …): one search credit per batch, not per doc.
  const batches = [];
  for (let i = 0; i < tracked.length; i += BATCH_SIZE) batches.push(tracked.slice(i, i + BATCH_SIZE));

  for (const batch of batches) {
    const q = batch.map((d) => {
      const terms = [`"${searchPrefix(d.code)}"`];
      if (d.filename) terms.push(`"${d.filename}"`);
      return terms.join(' OR ');
    }).join(' OR ');
    onLog(`[discovery] query: ${q}`);
    let hits = [];
    let provider = 'web';
    try {
      const r = await searchWeb(q, { onLog });
      hits = r.results;
      provider = r.provider;
      searchOk += 1;
      queriesRun.push(q);
      providersUsed.add(provider);
      onLog(`[discovery] provider=${provider}, hits=${hits.length}, urls=${hits.map((h) => h.url).join(', ') || '(none)'}`);
    } catch (err) {
      searchError = err.message;
      if (err.message === 'RATE_LIMITED') { onLog('Search rate limit hit — stopping scan.'); break; }
      onLog(`Batch search failed: ${err.message}`);
      continue;
    }

    // Fetch each UNIQUE result URL once (a page may carry several codes).
    const textByUrl = new Map();
    for (const h of hits) {
      if (!textByUrl.has(h.url)) textByUrl.set(h.url, await fetchHitText(h.url));
    }
    const enriched = hits.map((h) => ({ ...h, text: textByUrl.get(h.url) || '' }));

    // Attribute per docCode over the shared hit set (matchHitsToCodes filters to one code).
    for (const doc of batch) {
      for (const m of matchHitsToCodes(enriched, doc)) {
        matches.push({ documentId: doc.id, url: m.url, dlCode: m.dlCode, provider });
        try {
          const rr = await recordVisibleLeak({ documentId: doc.id, orgId, sourceUrl: m.url, visibleCode: m.full, scanId, source: provider });
          if (rr.created) confirmed += 1;
        } catch (err) { onLog(`record leak failed: ${err.message}`); }
      }
    }
    await sleep(300);
  }

  const searchUnavailable = searchOk === 0 && !!searchError;

  // Finalize scan-summary row even on 0 hits, so lastScanAt still updates for audit.
  await db.update(leakScans).set({
    status: searchUnavailable ? 'failed' : 'completed',
    completedAt: new Date(),
    leaksFound: confirmed,
    searchQueries: queriesRun,
    sourcesSearched: [...providersUsed],
  }).where(eq(leakScans.id, scanId));

  return {
    scanned: tracked.length,
    queries: searchOk,
    confirmed,
    hits: matches.length,
    matches,
    searchError,
    searchUnavailable,
    scanId,
  };
}
