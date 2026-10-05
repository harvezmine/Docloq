// DB layer for OSINT tracker: aggregates leaks from watermark scans, cron, and webhook; read APIs for the OSINT UI.

import { db } from '../db/index.js';
import { and, eq, sql, desc } from 'drizzle-orm';
import {
  leakScans,
  leakReports,
  honeytokenTriggers,
  documentHoneytokens,
  downloadWatermarks,
  documents,
  users,
} from '../db/schema.js';
import { configuredProvidersWithKeys } from './search-provider.js';

// Idempotent: writes a leakReports row when the watermark scanner IDs a leaked file.
export async function recordLeakFromWatermark({
  documentId,
  honeytokenId = null,
  watermarkId = null,
  tracedUserId = null,
  matchType,
  confidence = null,
  sourceUrl = null,
  sourceName = 'manual_scanner_upload',
  scannedBy,
  orgId,
}) {
  if (!documentId || !orgId || !matchType) {
    throw new Error('recordLeakFromWatermark: documentId, orgId, matchType required');
  }

  // Idempotency: skip if same doc + sourceUrl + matchType already recorded
  const existing = await db
    .select({ id: leakReports.id })
    .from(leakReports)
    .where(and(
      eq(leakReports.documentId, documentId),
      eq(leakReports.matchType, matchType),
      sourceUrl
        ? eq(leakReports.sourceUrl, sourceUrl)
        : sql`${leakReports.sourceUrl} IS NULL`,
    ))
    .limit(1);
  if (existing.length > 0) return { reportId: existing[0].id, created: false };

  const [scan] = await db.insert(leakScans).values({
    organizationId: orgId,
    documentId,
    scanType: 'manual',
    searchQueries: [],
    sourcesSearched: ['scanner_upload'],
    leaksFound: 1,
    status: 'completed',
    startedAt: new Date(),
    completedAt: new Date(),
    createdBy: scannedBy,
  }).returning({ id: leakScans.id });

  const [report] = await db.insert(leakReports).values({
    scanId: scan.id,
    documentId,
    sourceUrl,
    sourceName,
    sourceType: 'manual',
    matchType,
    matchConfidence: confidence != null ? Math.round(confidence * 100) : null,
    honeytokenId,
    watermarkId: null, // NB: schema FK refers documentWatermarks (image LSB), not downloadWatermarks
    tracedToUserId: tracedUserId,
    evidenceSnapshot: null,
    discoveredAt: new Date(),
  }).returning({ id: leakReports.id });

  return { reportId: report.id, scanId: scan.id, created: true };
}

// Used by webhook AND cron to log honeytoken trigger + companion leakReport.
export async function recordHoneytokenTrigger({
  honeytokenId,
  documentId,
  source,
  evidenceUrl = null,
  decodedPayload = null,
  ip = null,
  ua = null,
  orgId,
  scanId = null,
}) {
  if (!honeytokenId || !documentId || !orgId) {
    throw new Error('recordHoneytokenTrigger: honeytokenId, documentId, orgId required');
  }

  await db.insert(honeytokenTriggers).values({
    honeytokenId,
    documentId,
    triggerSource: source || evidenceUrl || 'unknown',
    triggerIp: ip,
    triggerUserAgent: ua,
    decodedPayload,
    investigationStatus: 'new',
    triggeredAt: new Date(),
  });

  // Build companion leakReport. If no scanId given, open a 1-row scan for context.
  let resolvedScanId = scanId;
  if (!resolvedScanId) {
    const [scan] = await db.insert(leakScans).values({
      organizationId: orgId,
      documentId,
      scanType: 'honeytoken_triggered',
      searchQueries: [],
      sourcesSearched: [source || 'external_webhook'],
      leaksFound: 1,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      createdBy: null,
    }).returning({ id: leakScans.id });
    resolvedScanId = scan.id;
  }

  // Idempotent leakReport
  if (evidenceUrl) {
    const existing = await db
      .select({ id: leakReports.id })
      .from(leakReports)
      .where(and(
        eq(leakReports.documentId, documentId),
        eq(leakReports.sourceUrl, evidenceUrl),
        eq(leakReports.matchType, 'honeytoken'),
      ))
      .limit(1);
    if (existing.length > 0) return { reportId: existing[0].id, scanId: resolvedScanId, created: false };
  }

  const [report] = await db.insert(leakReports).values({
    scanId: resolvedScanId,
    documentId,
    sourceUrl: evidenceUrl,
    sourceName: source || 'external_webhook',
    sourceType: source && source.includes('github') ? 'public_web' : 'external',
    matchType: 'honeytoken',
    matchConfidence: decodedPayload ? 90 : 60,
    honeytokenId,
    tracedToUserId: decodedPayload?.u || null,
    discoveredAt: new Date(),
  }).returning({ id: leakReports.id });

  return { reportId: report.id, scanId: resolvedScanId, created: true };
}

// Record confirmed visible-code leak; idempotent by (documentId, sourceUrl, matchType='visible_code').
export async function recordVisibleLeak({ documentId, orgId, sourceUrl, visibleCode, scanId = null, source = 'google_cse' }) {
  if (!documentId || !orgId || !sourceUrl || !visibleCode) {
    throw new Error('recordVisibleLeak: documentId, orgId, sourceUrl, visibleCode required');
  }
  const existing = await db.select({ id: leakReports.id }).from(leakReports).where(and(
    eq(leakReports.documentId, documentId),
    eq(leakReports.sourceUrl, sourceUrl),
    eq(leakReports.matchType, 'visible_code'),
  )).limit(1);
  if (existing.length > 0) return { reportId: existing[0].id, created: false };

  // Attribution: find the download row carrying this exact visible code.
  const [wm] = await db.select({ downloadedBy: downloadWatermarks.downloadedBy })
    .from(downloadWatermarks)
    .where(eq(downloadWatermarks.visibleCode, visibleCode))
    .limit(1);

  let resolvedScanId = scanId;
  if (!resolvedScanId) {
    const [scan] = await db.insert(leakScans).values({
      organizationId: orgId, documentId, scanType: 'scheduled',
      searchQueries: [], sourcesSearched: [source], leaksFound: 1,
      status: 'completed', startedAt: new Date(), completedAt: new Date(), createdBy: null,
    }).returning({ id: leakScans.id });
    resolvedScanId = scan.id;
  }

  const [report] = await db.insert(leakReports).values({
    scanId: resolvedScanId, documentId, sourceUrl, sourceName: source,
    sourceType: 'public_web', matchType: 'visible_code', matchConfidence: 95,
    tracedToUserId: wm?.downloadedBy || null, discoveredAt: new Date(),
  }).returning({ id: leakReports.id });

  return { reportId: report.id, scanId: resolvedScanId, tracedToUserId: wm?.downloadedBy || null, created: true };
}

// List leak reports for the Leaks tab.
export async function getLeakReports(orgId, { limit = 50, offset = 0 } = {}) {
  const rows = await db
    .select({
      id: leakReports.id,
      documentId: leakReports.documentId,
      documentName: documents.originalFilename,
      sourceUrl: leakReports.sourceUrl,
      sourceName: leakReports.sourceName,
      sourceType: leakReports.sourceType,
      matchType: leakReports.matchType,
      matchConfidence: leakReports.matchConfidence,
      tracedUserId: leakReports.tracedToUserId,
      tracedUserEmail: users.email,
      tracedUserName: sql`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      isAcknowledged: leakReports.isAcknowledged,
      discoveredAt: leakReports.discoveredAt,
      scanType: leakScans.scanType,
    })
    .from(leakReports)
    .innerJoin(leakScans, eq(leakReports.scanId, leakScans.id))
    .leftJoin(documents, eq(leakReports.documentId, documents.id))
    .leftJoin(users, eq(leakReports.tracedToUserId, users.id))
    .where(eq(leakScans.organizationId, orgId))
    .orderBy(desc(leakReports.discoveredAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

// Monitor tab stats: 4 counts + last scan timestamp + autoScan flag.
export async function getMonitorStats(orgId) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [trackedRow] = await db
    .select({ c: sql`count(*)::int` })
    .from(documents)
    .where(and(
      eq(documents.organizationId, orgId),
      eq(documents.trackingEnabled, true),
    ));

  const [wmRow] = await db
    .select({ c: sql`count(*)::int` })
    .from(downloadWatermarks)
    .innerJoin(documents, eq(documents.id, downloadWatermarks.documentId))
    .where(eq(documents.organizationId, orgId));

  const [leakRow] = await db
    .select({ c: sql`count(*)::int` })
    .from(leakReports)
    .innerJoin(leakScans, eq(leakReports.scanId, leakScans.id))
    .where(and(
      eq(leakScans.organizationId, orgId),
      sql`${leakReports.discoveredAt} >= ${since30d}`,
    ));

  const [scanRow] = await db
    .select({ ts: sql`MAX(${leakScans.completedAt})` })
    .from(leakScans)
    .where(eq(leakScans.organizationId, orgId));

  const scanProviders = configuredProvidersWithKeys();

  return {
    trackedDocsCount: trackedRow?.c || 0,
    downloadWatermarkCount: wmRow?.c || 0,
    leakReportsLast30d: leakRow?.c || 0,
    lastScanAt: scanRow?.ts || null,
    autoScanEnabled: process.env.OSINT_AUTOSCAN_ENABLED === 'true' && scanProviders.length > 0,
    autoScanSource: scanProviders.join(', ') || null,
  };
}

// Tracked documents — for the Check Document picker.
export async function listTrackedDocuments(orgId) {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.originalFilename,
      mimeType: documents.mimeType,
      createdAt: documents.createdAt,
      trackingCode: documents.trackingCode,
    })
    .from(documents)
    .where(and(
      eq(documents.organizationId, orgId),
      eq(documents.trackingEnabled, true),
    ))
    .orderBy(desc(documents.createdAt))
    .limit(200);
  return rows;
}

// Resolve honeytokenId from signature prefix (12-char) — used by webhook lookup.
export async function findHoneytokenBySignaturePrefix(prefix) {
  if (!prefix || prefix.length < 8) return null;
  const rows = await db
    .select()
    .from(documentHoneytokens)
    .where(sql`LEFT(${documentHoneytokens.combinedPayloadHash}, ${prefix.length}) = ${prefix}`)
    .limit(1);
  return rows[0] || null;
}
