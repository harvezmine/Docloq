// Detects per-download watermarks (U+2060-63) and upload honeytokens (U+200B-FEFF)

import { db } from '../db/index.js';
import { downloadWatermarks, documents, users, documentHoneytokens } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { extractDownloadWatermark } from '../services/download-watermark.service.js';
import { extractHoneytokens } from '../services/honeytoken.service.js';
import { extractText } from '../services/upload-pipeline.service.js';
import { extractAllWatermarkSources } from '../services/watermark-extract.service.js';
import { recordLeakFromWatermark } from '../services/leak-scanner.service.js';

// POST /api/watermark-scanner/scan
export const scanForWatermark = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // Two extraction paths: rendered body text (catches honeytokens in DOCX text runs) and
    // raw metadata sources (catches watermarks in PDF Keywords / Office custom XML, which body extraction strips)
    let bodyText = '';
    try {
      bodyText = (await extractText(buffer, mimetype)) || '';
    } catch (err) {
      console.warn('[WatermarkScanner] Body text extraction failed:', err.message);
      if (mimetype === 'text/plain') {
        bodyText = buffer.toString('utf-8');
      }
    }

    let metadataSources = [];
    try {
      metadataSources = await extractAllWatermarkSources(buffer, mimetype);
    } catch (err) {
      console.warn('[WatermarkScanner] Multi-source extraction failed:', err.message);
    }

    // Body text first (more readable for honeytoken scoring), then metadata sources
    const combinedHaystack = [bodyText, ...metadataSources]
      .filter((s) => s && s.length > 0)
      .join('\n');

    if (combinedHaystack.length < 5) {
      return res.json({
        success: true,
        data: {
          found: false,
          message: 'Could not extract readable text or metadata from the uploaded file',
          filename: originalname,
        },
      });
    }

    // Prefer whichever source yields the highest confidence, to avoid metadata noise polluting the result
    let downloadResult = extractDownloadWatermark(combinedHaystack);
    if (!downloadResult.payload) {
      // Retry per-source — joining sources can break bit alignment
      for (const src of metadataSources) {
        const r = extractDownloadWatermark(src);
        if (r.payload && (r.confidence || 0) > (downloadResult.confidence || 0)) {
          downloadResult = r;
          break;
        }
      }
    }

    let honeytokenResult = extractHoneytokens(combinedHaystack);
    if (!honeytokenResult.payload) {
      for (const src of metadataSources) {
        const r = extractHoneytokens(src);
        if (r.payload && (r.confidence || 0) > (honeytokenResult.confidence || 0)) {
          honeytokenResult = r;
          break;
        }
      }
    }

    const result = {
      found: false,
      filename: originalname,
      downloadWatermark: null,
      uploadHoneytoken: null,
    };

    if (downloadResult.payload && downloadResult.confidence > 0.4) {
      const { w: watermarkId, d: docId, u: downloaderId } = downloadResult.payload;

      let watermarkRecord = null;
      let downloaderInfo = null;
      let documentInfo = null;

      if (watermarkId) {
        const [wmRow] = await db
          .select()
          .from(downloadWatermarks)
          .where(eq(downloadWatermarks.watermarkId, watermarkId))
          .limit(1);
        watermarkRecord = wmRow || null;
      }

      if (downloaderId) {
        const [userRow] = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, downloaderId))
          .limit(1);
        downloaderInfo = userRow || null;
      }

      if (docId) {
        const orgId = req.user?.organizationId;
        const whereClause = orgId
          ? and(eq(documents.id, docId), eq(documents.organizationId, orgId))
          : eq(documents.id, docId);
        const [docRow] = await db
          .select({
            id: documents.id,
            originalFilename: documents.originalFilename,
            mimeType: documents.mimeType,
          })
          .from(documents)
          .where(whereClause)
          .limit(1);
        documentInfo = docRow || null;
      }

      result.found = true;
      result.downloadWatermark = {
        watermarkId,
        confidence: downloadResult.confidence,
        positions: downloadResult.positions.length,
        downloader: downloaderInfo
          ? {
              id: downloaderInfo.id,
              name: `${downloaderInfo.firstName || ''} ${downloaderInfo.lastName || ''}`.trim() || downloaderInfo.email,
              email: downloaderInfo.email,
            }
          : downloaderId ? { id: downloaderId, name: 'Unknown User', email: null } : null,
        document: documentInfo
          ? { id: documentInfo.id, name: documentInfo.originalFilename, mimeType: documentInfo.mimeType }
          : docId ? { id: docId, name: 'Unknown Document' } : null,
        downloadedAt: watermarkRecord?.createdAt || downloadResult.payload.t,
        ipAddress: watermarkRecord?.ipAddress || null,
        method: watermarkRecord?.documentFormat || 'unicode_invisible',
      };
    }

    if (honeytokenResult.payload && honeytokenResult.confidence > 0.4) {
      const { d: docId, u: uploaderId, o: orgId } = honeytokenResult.payload;

      let uploaderInfo = null;
      if (uploaderId) {
        const [userRow] = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, uploaderId))
          .limit(1);
        uploaderInfo = userRow || null;
      }

      result.uploadHoneytoken = {
        method: honeytokenResult.method,
        confidence: honeytokenResult.confidence,
        uploader: uploaderInfo
          ? {
              id: uploaderInfo.id,
              name: `${uploaderInfo.firstName || ''} ${uploaderInfo.lastName || ''}`.trim() || uploaderInfo.email,
              email: uploaderInfo.email,
            }
          : uploaderId ? { id: uploaderId, name: 'Unknown User' } : null,
        documentId: docId || null,
        organizationId: orgId || null,
        timestamp: honeytokenResult.payload.t || null,
      };

      if (!result.found) {
        result.found = true;
      }
    }

    if (!result.found) {
      // Confidence >0 but no decodable payload still means invisible markers were found — different message than "no watermark"
      const downloadHinted = (downloadResult.confidence || 0) > 0;
      const honeytokenHinted = (honeytokenResult.confidence || 0) > 0;
      if (downloadHinted || honeytokenHinted) {
        result.message = 'Invisible markers detected but payload could not be decoded. File may be partially modified or from a different system.';
        result.partial = true;
      } else {
        result.message = 'No watermarks or honeytokens detected. The document may have been sanitized or is not from this system.';
      }
    } else {
      // Check whether the decoded watermark is orphaned (not registered in the DB)
      const orphanWatermark = result.downloadWatermark && !result.downloadWatermark.downloader && !result.downloadWatermark.document?.name;
      if (orphanWatermark) {
        result.orphan = true;
        result.message = 'Watermark detected but not registered in this system. Payload decoded successfully but no matching download record found.';
      }

      // Wrapped in try/catch so the scan response never fails on a DB write error
      try {
        const orgId = req.user?.organizationId;
        if (orgId && !result.orphan) {
          const docId = result.downloadWatermark?.document?.id
            || result.uploadHoneytoken?.documentId;
          if (docId) {
            if (result.downloadWatermark) {
              await recordLeakFromWatermark({
                documentId: docId,
                tracedUserId: result.downloadWatermark.downloader?.id || null,
                matchType: 'watermark',
                confidence: result.downloadWatermark.confidence,
                sourceUrl: null,
                sourceName: 'manual_scanner_upload',
                scannedBy: req.user?.id,
                orgId,
              });
            }
            if (result.uploadHoneytoken) {
              await recordLeakFromWatermark({
                documentId: docId,
                tracedUserId: result.uploadHoneytoken.uploader?.id || null,
                matchType: 'honeytoken',
                confidence: result.uploadHoneytoken.confidence,
                sourceUrl: null,
                sourceName: 'manual_scanner_upload',
                scannedBy: req.user?.id,
                orgId,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[WatermarkScanner] recordLeakFromWatermark failed:', err.message);
      }
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[WatermarkScanner] Scan error:', error);
    return res.status(500).json({ success: false, message: 'Failed to scan document' });
  }
};

// GET /api/watermark-scanner/history/:documentId
export const getWatermarkHistory = async (req, res) => {
  try {
    const { documentId } = req.params;

    const records = await db
      .select({
        id: downloadWatermarks.id,
        watermarkId: downloadWatermarks.watermarkId,
        documentFormat: downloadWatermarks.documentFormat,
        ipAddress: downloadWatermarks.ipAddress,
        createdAt: downloadWatermarks.createdAt,
        isActive: downloadWatermarks.isActive,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(downloadWatermarks)
      .leftJoin(users, eq(downloadWatermarks.downloadedBy, users.id))
      .where(eq(downloadWatermarks.documentId, documentId))
      .orderBy(desc(downloadWatermarks.createdAt));

    const history = records.map((r) => ({
      id: r.id,
      watermarkId: r.watermarkId,
      user: r.firstName
        ? `${r.firstName}${r.lastName ? ' ' + r.lastName : ''}`
        : r.email?.split('@')[0] || 'Unknown',
      email: r.email,
      downloadedAt: r.createdAt,
      ipAddress: r.ipAddress,
      format: r.documentFormat,
      isActive: r.isActive,
    }));

    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('[WatermarkScanner] History error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch watermark history' });
  }
};

// GET /api/watermark-scanner/details/:watermarkId
export const getWatermarkDetails = async (req, res) => {
  try {
    const { watermarkId } = req.params;

    const [record] = await db
      .select()
      .from(downloadWatermarks)
      .where(eq(downloadWatermarks.watermarkId, watermarkId))
      .limit(1);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Watermark record not found' });
    }

    let userInfo = null;
    if (record.downloadedBy) {
      const [user] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, record.downloadedBy))
        .limit(1);
      userInfo = user || null;
    }

    let docInfo = null;
    if (record.documentId) {
      const [doc] = await db
        .select({
          id: documents.id,
          originalFilename: documents.originalFilename,
          mimeType: documents.mimeType,
        })
        .from(documents)
        .where(eq(documents.id, record.documentId))
        .limit(1);
      docInfo = doc || null;
    }

    return res.json({
      success: true,
      data: {
        ...record,
        downloader: userInfo
          ? {
              id: userInfo.id,
              name: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || userInfo.email,
              email: userInfo.email,
            }
          : null,
        document: docInfo
          ? { id: docInfo.id, name: docInfo.originalFilename, mimeType: docInfo.mimeType }
          : null,
      },
    });
  } catch (error) {
    console.error('[WatermarkScanner] Details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch watermark details' });
  }
};
