// OSINT Controller — thin wrappers around leak-scanner + osint-discovery (Google CSE).

import {
  getLeakReports,
  getMonitorStats,
  listTrackedDocuments,
  recordHoneytokenTrigger,
  findHoneytokenBySignaturePrefix,
} from '../services/leak-scanner.service.js';
import { runDiscoveryScan } from '../services/osint-discovery.service.js';
import { db } from '../db/index.js';
import { documentHoneytokens, documents } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

function authed(req, res) {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!orgId || !userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }
  return { orgId, userId };
}

export async function getStats(req, res) {
  const ctx = authed(req, res); if (!ctx) return;
  try {
    const data = await getMonitorStats(ctx.orgId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[OSINT] stats error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function listLeaks(req, res) {
  const ctx = authed(req, res); if (!ctx) return;
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const data = await getLeakReports(ctx.orgId, { limit, offset });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[OSINT] leaks error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function listTracked(req, res) {
  const ctx = authed(req, res); if (!ctx) return;
  try {
    const data = await listTrackedDocuments(ctx.orgId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[OSINT] tracked error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function checkDocumentOnDemand(req, res) {
  const ctx = authed(req, res); if (!ctx) return;
  try {
    const docId = req.params.id;
    const [doc] = await db
      .select({ id: documents.id, trackingCode: documents.trackingCode })
      .from(documents)
      .where(and(
        eq(documents.id, docId),
        eq(documents.organizationId, ctx.orgId),
        eq(documents.trackingEnabled, true),
      ))
      .limit(1);

    if (!doc || !doc.trackingCode) {
      return res.status(404).json({
        success: false,
        message: 'Dokumen tidak ditemukan atau tracking belum diaktifkan',
      });
    }

    const result = await runDiscoveryScan(ctx.orgId, { docIds: [docId], onLog: (m) => console.log('[OSINT]', m) });

    // Map error codes to human messages so the UI shows "search unavailable" instead of a misleading "0 leaks found"
    if (result.searchError) {
      const code = result.searchError;
      const map = {
        NO_SEARCH_PROVIDER: 'Belum ada provider web-search yang dikonfigurasi (set OSINT_SEARCH_PROVIDERS + key-nya). Hubungi admin.',
        GOOGLE_CSE_NOT_CONFIGURED: 'Google CSE belum dikonfigurasi (GOOGLE_CSE_KEY / GOOGLE_CSE_CX belum diset).',
        SERPER_NOT_CONFIGURED: 'Serper belum dikonfigurasi (SERPER_API_KEY belum diset).',
        SEARXNG_NOT_CONFIGURED: 'SearXNG belum dikonfigurasi (SEARXNG_URL belum diset).',
        RATE_LIMITED: 'Provider membatasi permintaan (rate limit). Coba lagi beberapa saat.',
        GOOGLE_TIMEOUT: 'Permintaan pencarian (Google) timeout. Coba lagi.',
        SERPER_TIMEOUT: 'Permintaan pencarian (Serper) timeout. Coba lagi.',
        SEARXNG_TIMEOUT: 'Permintaan pencarian (SearXNG) timeout. Coba lagi.',
      };
      result.searchErrorMessage = map[code]
        || (code.startsWith('GOOGLE_HTTP_')
          ? `Google Search error (${code.replace('GOOGLE_HTTP_', 'HTTP ')}). Custom Search JSON API mungkin belum di-enable pada project key tsb.`
          : code.startsWith('SERPER_HTTP_')
            ? `Serper error (${code.replace('SERPER_HTTP_', 'HTTP ')}). Cek API key / kuota Serper.`
            : code.startsWith('SEARXNG_HTTP_')
              ? `SearXNG error (${code.replace('SEARXNG_HTTP_', 'HTTP ')}). Cek apakah instance SearXNG berjalan.`
              : 'Pencarian gagal.');
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[OSINT] check error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Public webhook — auth via x-osint-key header in route middleware
export async function reportWebhook(req, res) {
  try {
    const { signaturePrefix, sourceUrl, sourceName, decodedPayload } = req.body || {};
    if (!sourceUrl) {
      return res.status(400).json({ success: false, message: 'sourceUrl required' });
    }
    if (!signaturePrefix && !decodedPayload?.d) {
      return res.status(400).json({ success: false, message: 'signaturePrefix or decodedPayload.d required' });
    }

    let honeytoken = null;
    if (signaturePrefix) {
      honeytoken = await findHoneytokenBySignaturePrefix(signaturePrefix);
    } else if (decodedPayload?.d) {
      const rows = await db
        .select()
        .from(documentHoneytokens)
        .where(and(
          eq(documentHoneytokens.documentId, decodedPayload.d),
          eq(documentHoneytokens.isActive, true),
        ))
        .limit(1);
      honeytoken = rows[0] || null;
    }

    if (!honeytoken) {
      return res.status(404).json({ success: false, message: 'No matching honeytoken' });
    }

    const [doc] = await db
      .select({ organizationId: documents.organizationId })
      .from(documents)
      .where(eq(documents.id, honeytoken.documentId))
      .limit(1);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const result = await recordHoneytokenTrigger({
      honeytokenId: honeytoken.id,
      documentId: honeytoken.documentId,
      source: sourceName || 'external_webhook',
      evidenceUrl: sourceUrl,
      decodedPayload: decodedPayload || null,
      ip: req.ip,
      ua: req.get('user-agent'),
      orgId: doc.organizationId,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[OSINT] webhook error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
