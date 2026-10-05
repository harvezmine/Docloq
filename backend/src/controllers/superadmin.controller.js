
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import {
  organizations, users, documents, documentVersions, aiProjects, aiProjectChats, apiRequestLogs,
  auditLogs, auditChainHead, auditChainAnchors, pqcKeypairs, aiQuotas, securityEvents, blockchainAnchors,
  leakScans, leakReports, downloadWatermarks,
} from '../db/schema.js';
import { eq, and, ilike, sql, count, inArray, desc, asc, gte, gt, isNotNull } from 'drizzle-orm';
import authConfig from '../config/auth.config.js';
import { FEATURE_KEYS, resolveFeatures } from '../middlewares/superadmin.middleware.js';
import { verifyChainForOrg, appendAuditEntry, ADMIN_ACTOR, buildEntryProof } from '../services/audit.service.js';
import * as auditRecovery from '../services/audit-recovery.service.js';
import * as databaseSvc from '../services/database.service.js';
import { configuredProvidersWithKeys } from '../services/search-provider.js';
import * as sshSvc from '../services/ssh-console.service.js';

const sshClientIp = (req) => ((req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket?.remoteAddress || req.ip;
import { verifyAnchorsForOrg, anchorOrgPending, getAuditEntryMerkleProof, buildBreakReport } from '../services/audit-anchor.service.js';
import { isReady as blockchainReady, getBlockchainStats, getTransactionHistory, getChainMeta } from '../services/blockchain.service.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCompanyCode = () =>
  Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

const TOKENS_SQL = sql`COALESCE(SUM(
  COALESCE((${aiProjectChats.metadata} ->> 'promptTokens')::int, 0) +
  COALESCE((${aiProjectChats.metadata} ->> 'completionTokens')::int, 0)
), 0)`;

const fetchWithTimeout = async (url, ms = 1500) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok || (r.status >= 200 && r.status < 500);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};

const checkHealth = async () => {
  const onlyofficeUrl = process.env.ONLYOFFICE_URL_INTERNAL || process.env.ONLYOFFICE_URL || 'http://localhost:8082';
  const vaultUrl = process.env.VAULT_ADDR || process.env.VAULT_URL || 'http://vault-1:8200';

  const [dbOk, onlyoffice, vault, redis] = await Promise.all([
    db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
    fetchWithTimeout(`${onlyofficeUrl.replace(/\/$/, '')}/healthcheck`),
    fetchWithTimeout(`${vaultUrl.replace(/\/$/, '')}/v1/sys/health`),
    (async () => {
      try {
        const { default: Redis } = await import('ioredis');
        const c = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 1500,
        });
        c.on('error', () => {});
        await c.connect();
        const pong = await c.ping();
        c.disconnect();
        return pong === 'PONG';
      } catch {
        return false;
      }
    })(),
  ]);

  return { db: dbOk, redis, onlyoffice, vault };
};

const logAdminAction = async (organizationId, adminAction, { action = 'update', details, req } = {}) => {
  try {
    await appendAuditEntry({
      organizationId,
      userId: null,
      action,
      resourceType: 'organization',
      resourceId: organizationId,
      details: { ...details, actor: ADMIN_ACTOR, adminAction },
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.warn('[Superadmin] audit log failed:', err.message);
  }
};

export const getStats = async (req, res) => {
  try {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [[uc], [oc], [dc], [stor], [tok]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(organizations),
      db.select({ n: count() }).from(documents),
      db.select({ s: sql`COALESCE(SUM(${documents.fileSize}), 0)` }).from(documents),
      db.select({ t: TOKENS_SQL }).from(aiProjectChats),
    ]);

    const [[nt], [nw], [nm]] = await Promise.all([
      db.select({ n: count() }).from(users).where(gte(users.createdAt, startToday)),
      db.select({ n: count() }).from(users).where(gte(users.createdAt, startWeek)),
      db.select({ n: count() }).from(users).where(gte(users.createdAt, startMonth)),
    ]);

    const [reqRow] = await db
      .select({
        volume: count(),
        avg: sql`COALESCE(AVG(${apiRequestLogs.requestDuration}), 0)`,
        errors: sql`COUNT(*) FILTER (WHERE ${apiRequestLogs.statusCode} >= 500)`,
      })
      .from(apiRequestLogs)
      .where(gte(apiRequestLogs.createdAt, start24h));

    const volume24h = Number(reqRow?.volume || 0);
    const errors = Number(reqRow?.errors || 0);

    const health = await checkHealth();

    return res.json({
      success: true,
      data: {
        counts: {
          users: Number(uc?.n || 0),
          tenants: Number(oc?.n || 0),
          documents: Number(dc?.n || 0),
          newToday: Number(nt?.n || 0),
          newWeek: Number(nw?.n || 0),
          newMonth: Number(nm?.n || 0),
        },
        storageBytes: Number(stor?.s || 0),
        aiTokens: Number(tok?.t || 0),
        requests: {
          volume24h,
          avgLatencyMs: Math.round(Number(reqRow?.avg || 0)),
          errorRatePct: volume24h ? Math.round((errors / volume24h) * 1000) / 10 : 0,
        },
        health,
      },
    });
  } catch (error) {
    console.error('superadmin getStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
};

const aggregatesFor = async (orgIds) => {
  if (orgIds.length === 0) return { userCount: {}, activeUsers: {}, docs: {}, tokens: {}, owner: {}, lastActive: {}, quota: {} };

  const [userRows, activeRows, docRows, tokenRows, ownerRows, lastActiveRows, quotaRows] = await Promise.all([
    db.select({ org: users.organizationId, n: count() }).from(users)
      .where(inArray(users.organizationId, orgIds)).groupBy(users.organizationId),
    db.select({ org: users.organizationId, n: count() }).from(users)
      .where(and(inArray(users.organizationId, orgIds), eq(users.isActive, true))).groupBy(users.organizationId),
    db.select({ org: documents.organizationId, n: count(), s: sql`COALESCE(SUM(${documents.fileSize}), 0)` })
      .from(documents).where(inArray(documents.organizationId, orgIds)).groupBy(documents.organizationId),
    db.select({ org: aiProjects.organizationId, t: TOKENS_SQL })
      .from(aiProjectChats).innerJoin(aiProjects, eq(aiProjects.id, aiProjectChats.projectId))
      .where(inArray(aiProjects.organizationId, orgIds)).groupBy(aiProjects.organizationId),
    db.select({ org: users.organizationId, email: users.email }).from(users)
      .where(and(inArray(users.organizationId, orgIds), eq(users.role, 'owner'))),
    db.select({ org: users.organizationId, last: sql`MAX(${users.lastLoginAt})` }).from(users)
      .where(inArray(users.organizationId, orgIds)).groupBy(users.organizationId),
    db.select({ org: aiQuotas.organizationId, used: aiQuotas.analysisUsedThisMonth, limit: aiQuotas.monthlyAnalysisLimit })
      .from(aiQuotas).where(inArray(aiQuotas.organizationId, orgIds)),
  ]);

  const userCount = Object.fromEntries(userRows.map((r) => [r.org, Number(r.n)]));
  const activeUsers = Object.fromEntries(activeRows.map((r) => [r.org, Number(r.n)]));
  const docs = Object.fromEntries(docRows.map((r) => [r.org, { count: Number(r.n), storage: Number(r.s) }]));
  const tokens = Object.fromEntries(tokenRows.map((r) => [r.org, Number(r.t)]));
  const owner = Object.fromEntries(ownerRows.map((r) => [r.org, r.email]));
  const lastActive = Object.fromEntries(lastActiveRows.map((r) => [r.org, r.last || null]));
  const quota = Object.fromEntries(quotaRows.map((r) => [r.org, { used: Number(r.used || 0), limit: Number(r.limit || 0) }]));
  return { userCount, activeUsers, docs, tokens, owner, lastActive, quota };
};

const DORMANT_DAYS = 30;
const toTenant = (org, agg) => {
  const last = agg.lastActive[org.id] || null;
  const dormant = !last || (Date.now() - new Date(last).getTime()) > DORMANT_DAYS * 86400_000;
  return {
    id: org.id,
    name: org.name,
    ownerEmail: agg.owner[org.id] || null,
    userCount: agg.userCount[org.id] || 0,
    activeUsers: agg.activeUsers[org.id] || 0,
    docCount: agg.docs[org.id]?.count || 0,
    storageBytes: agg.docs[org.id]?.storage || 0,
    aiTokens: agg.tokens[org.id] || 0,
    isActive: org.isActive !== false,
    features: resolveFeatures(org),
    createdAt: org.createdAt,
    lastActiveAt: last,
    dormant,
    aiQuota: agg.quota[org.id] || { used: 0, limit: 0 },
    retention: { dataRetentionDays: org.dataRetentionDays ?? null, archiveAfterDays: org.archiveAfterDays ?? null },
  };
};

export const listTenants = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();
    const where = search ? ilike(organizations.name, `%${search}%`) : undefined;

    const [[{ total }], orgs] = await Promise.all([
      db.select({ total: count() }).from(organizations).where(where),
      db.select().from(organizations).where(where)
        .orderBy(desc(organizations.createdAt)).limit(limit).offset((page - 1) * limit),
    ]);

    const agg = await aggregatesFor(orgs.map((o) => o.id));
    const tenants = orgs.map((o) => toTenant(o, agg));

    return res.json({
      success: true,
      data: {
        tenants,
        pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
      },
    });
  } catch (error) {
    console.error('superadmin listTenants error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list tenants' });
  }
};

export const getTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const agg = await aggregatesFor([id]);
    const startMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [nm] = await db.select({ n: count() }).from(users)
      .where(and(eq(users.organizationId, id), gte(users.createdAt, startMonth)));

    return res.json({ success: true, data: { ...toTenant(org, agg), newThisMonth: Number(nm?.n || 0) } });
  } catch (error) {
    console.error('superadmin getTenant error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load tenant' });
  }
};

export const createTenant = async (req, res) => {
  try {
    const { companyName, email, password, firstName, lastName } = req.body;
    if (!companyName || !email || !password) {
      return res.status(400).json({ success: false, message: 'companyName, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const [dupe] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, email.toLowerCase())).limit(1);
    if (dupe) return res.status(409).json({ success: false, message: 'Email already registered' });

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let companyCode;
    for (let i = 0; i < 5; i++) {
      const cand = generateCompanyCode();
      const [ex] = await db.select({ id: organizations.id }).from(organizations)
        .where(eq(organizations.companyCode, cand)).limit(1);
      if (!ex) { companyCode = cand; break; }
    }
    if (!companyCode) companyCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

    const [org] = await db.insert(organizations).values({
      id: uuidv4(),
      name: companyName,
      slug: `${slug}-${Date.now()}`,
      companyCode,
    }).returning();

    const passwordHash = await bcrypt.hash(password, authConfig.password.saltRounds);
    await db.insert(users).values({
      id: uuidv4(),
      organizationId: org.id,
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      role: 'owner',
      isActive: true,
      isEmailVerified: false,
    });

    await logAdminAction(org.id, 'tenant_create', { action: 'create', details: { companyName, companyCode }, req });

    return res.status(201).json({ success: true, data: { id: org.id, companyCode } });
  } catch (error) {
    console.error('superadmin createTenant error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create tenant' });
  }
};

export const setTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const isActive = req.body?.isActive === true;
    const [org] = await db.update(organizations)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning({ id: organizations.id, isActive: organizations.isActive });
    if (!org) return res.status(404).json({ success: false, message: 'Tenant not found' });
    await logAdminAction(id, 'tenant_status', { action: 'update', details: { isActive }, req });
    return res.json({ success: true, data: org });
  } catch (error) {
    console.error('superadmin setTenantStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update tenant status' });
  }
};

export const setTenantFeatures = async (req, res) => {
  try {
    const { id } = req.params;
    const incoming = req.body?.features || {};
    const merged = {};
    for (const k of FEATURE_KEYS) {
      if (k in incoming) merged[k] = incoming[k] === true;
    }
    if (Object.keys(merged).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid feature flags provided' });
    }

    const [org] = await db.select({ settings: organizations.settings })
      .from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const settings = { ...(org.settings || {}) };
    settings.features = { ...(settings.features || {}), ...merged };

    await db.update(organizations).set({ settings, updatedAt: new Date() }).where(eq(organizations.id, id));
    await logAdminAction(id, 'tenant_features', { action: 'update', details: { before: org.settings?.features || {}, after: settings.features }, req });
    return res.json({ success: true, data: { id, features: resolveFeatures({ settings }) } });
  } catch (error) {
    console.error('superadmin setTenantFeatures error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update tenant features' });
  }
};


export const getAuditChainStatus = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });

    const [head] = await db.select().from(auditChainHead).where(eq(auditChainHead.organizationId, orgId));
    const [chainedRow] = await db
      .select({ n: count() })
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), sql`${auditLogs.sequenceNumber} IS NOT NULL`));
    const [lastAnchor] = await db
      .select()
      .from(auditChainAnchors)
      .where(eq(auditChainAnchors.organizationId, orgId))
      .orderBy(desc(auditChainAnchors.toSeq))
      .limit(1);
    const [anchorCountRow] = await db
      .select({ n: count() })
      .from(auditChainAnchors)
      .where(eq(auditChainAnchors.organizationId, orgId));

    const lastSeq = head?.lastSeq || 0;
    const anchoredUpTo = lastAnchor?.toSeq || 0;

    return res.json({
      success: true,
      data: {
        organizationId: orgId,
        chainedEntries: Number(chainedRow?.n || 0),
        lastSeq,
        lastHash: head?.lastHash || null,
        updatedAt: head?.updatedAt || null,
        anchorCount: Number(anchorCountRow?.n || 0),
        anchoredUpTo,
        pendingAnchor: Math.max(0, lastSeq - anchoredUpTo),
        blockchainReady: blockchainReady(),
        anchoring: {
          enabled: process.env.AUDIT_ANCHOR_ENABLED === 'true',
          everyN: Math.max(1, parseInt(process.env.AUDIT_ANCHOR_EVERY_N || '256', 10)),
          checkMinutes: Math.max(1, parseInt(process.env.AUDIT_ANCHOR_CHECK_MINUTES || '30', 10)),
          intervalHours: Math.max(1, parseInt(process.env.AUDIT_ANCHOR_INTERVAL_HOURS || '6', 10)),
        },
        chain: getChainMeta(),
        lastAnchor: lastAnchor
          ? { fromSeq: lastAnchor.fromSeq, toSeq: lastAnchor.toSeq, rootHash: lastAnchor.rootHash, txHash: lastAnchor.blockchainTxHash, blockNumber: lastAnchor.blockNumber, anchoredAt: lastAnchor.anchoredAt }
          : null,
      },
    });
  } catch (error) {
    console.error('superadmin getAuditChainStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load chain status' });
  }
};

export const verifyAuditChain = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    return res.json({ success: true, data: await verifyChainForOrg(orgId) });
  } catch (error) {
    console.error('superadmin verifyAuditChain error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify chain' });
  }
};

// audit recovery
export const listAuditBackups = async (req, res) => {
  try {
    return res.json({ success: true, data: { backups: auditRecovery.listBackups() } });
  } catch (error) {
    console.error('superadmin listAuditBackups error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list backups' });
  }
};

export const previewAuditRecovery = async (req, res) => {
  try {
    const orgId = (req.body?.orgId || req.query.orgId || '').trim();
    const file = (req.body?.file || req.query.file || '').trim();
    if (!orgId || !file) return res.status(400).json({ success: false, message: 'orgId and file are required' });
    return res.json({ success: true, data: await auditRecovery.previewRecovery(orgId, file) });
  } catch (error) {
    console.error('superadmin previewAuditRecovery error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to preview recovery' });
  }
};

export const recoverAuditChain = async (req, res) => {
  try {
    const orgId = (req.body?.orgId || req.query.orgId || '').trim();
    const file = (req.body?.file || req.query.file || '').trim();
    if (!orgId || !file) return res.status(400).json({ success: false, message: 'orgId and file are required' });
    const result = await auditRecovery.restoreMissing(orgId, file, { actor: ADMIN_ACTOR });
    try {
      await logAdminAction(orgId, 'audit_recover', {
        details: { file, restored: result.restored, restoredSeqs: result.restoredSeqs },
        req,
      });
    } catch { /* ignore */ }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('superadmin recoverAuditChain error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to recover chain' });
  }
};

// database tab
export const getDatabaseOverview = async (req, res) => {
  try {
    return res.json({ success: true, data: await databaseSvc.getOverview() });
  } catch (error) {
    console.error('superadmin getDatabaseOverview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load database overview' });
  }
};

export const listDatabaseTables = async (req, res) => {
  try {
    return res.json({ success: true, data: { tables: await databaseSvc.listTables() } });
  } catch (error) {
    console.error('superadmin listDatabaseTables error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list tables' });
  }
};

export const listDatabaseBackups = async (req, res) => {
  try {
    return res.json({ success: true, data: { backups: databaseSvc.listBackups() } });
  } catch (error) {
    console.error('superadmin listDatabaseBackups error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list backups' });
  }
};

export const backupDatabaseNow = async (req, res) => {
  try {
    const result = await databaseSvc.runBackup();
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('superadmin backupDatabaseNow error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Backup failed' });
  }
};

export const getAuditBreakReport = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    return res.json({ success: true, data: await buildBreakReport(orgId) });
  } catch (error) {
    console.error('superadmin getAuditBreakReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to build break report' });
  }
};

export const verifyAuditAnchors = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    return res.json({ success: true, data: await verifyAnchorsForOrg(orgId) });
  } catch (error) {
    console.error('superadmin verifyAuditAnchors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify anchors' });
  }
};

export const listAuditAnchors = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    const rows = await db
      .select()
      .from(auditChainAnchors)
      .where(eq(auditChainAnchors.organizationId, orgId))
      .orderBy(desc(auditChainAnchors.toSeq))
      .limit(100);
    return res.json({ success: true, data: { anchors: rows } });
  } catch (error) {
    console.error('superadmin listAuditAnchors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list anchors' });
  }
};

export const listAuditEntries = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rows = await db
      .select({
        sequenceNumber: auditLogs.sequenceNumber,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        prevHash: auditLogs.prevHash,
        entryHash: auditLogs.entryHash,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), sql`${auditLogs.sequenceNumber} IS NOT NULL`))
      .orderBy(desc(auditLogs.sequenceNumber))
      .limit(limit);
    return res.json({ success: true, data: { entries: rows } });
  } catch (error) {
    console.error('superadmin listAuditEntries error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list entries' });
  }
};

export const getAuditEntryProof = async (req, res) => {
  try {
    const orgId = (req.query.orgId || '').trim();
    const seq = parseInt(req.query.seq, 10);
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    if (!Number.isInteger(seq) || seq < 1) return res.status(400).json({ success: false, message: 'seq must be a positive integer' });

    const [row] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.sequenceNumber, seq)));
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' });

    const [prevRow] = await db
      .select({ entryHash: auditLogs.entryHash })
      .from(auditLogs)
      .where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.sequenceNumber, seq - 1)));

    let merkle;
    try {
      merkle = await getAuditEntryMerkleProof(orgId, seq, row.entryHash);
    } catch (err) {
      merkle = { anchored: false, reason: err.message };
    }

    return res.json({ success: true, data: { ...buildEntryProof(row, prevRow?.entryHash ?? null), merkle } });
  } catch (error) {
    console.error('superadmin getAuditEntryProof error:', error);
    return res.status(500).json({ success: false, message: 'Failed to build entry proof' });
  }
};

export const anchorAuditNow = async (req, res) => {
  try {
    const orgId = (req.query.orgId || req.body?.orgId || '').trim();
    if (!orgId) return res.status(400).json({ success: false, message: 'orgId is required' });
    if (!blockchainReady()) {
      return res.status(503).json({ success: false, message: 'Blockchain belum aktif (set BLOCKCHAIN_ENABLED=true + wallet ber-gas).' });
    }
    const result = await anchorOrgPending(orgId, { force: true });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('superadmin anchorAuditNow error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to anchor' });
  }
};


export const getBlockchainOverview = async (req, res) => {
  try {
    const stats = await getBlockchainStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('superadmin getBlockchainOverview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load blockchain stats' });
  }
};

export const listBlockchainTransactions = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const txs = await getTransactionHistory(limit, offset);
    return res.json({ success: true, data: txs });
  } catch (error) {
    console.error('superadmin listBlockchainTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load transactions' });
  }
};

export const getBlockchainHealth = async (req, res) => {
  try {
    const minBalance = parseFloat(process.env.POLYGON_MIN_BALANCE || '0.5');
    const stats = await getBlockchainStats();
    const balance = parseFloat(stats.polygonBalance || '0');

    const [pend] = await db.select({ n: count() }).from(blockchainAnchors).where(eq(blockchainAnchors.status, 'pending'));

    const [heads, anchTops] = await Promise.all([
      db.select({ org: auditChainHead.organizationId, lastSeq: auditChainHead.lastSeq }).from(auditChainHead),
      db.select({ org: auditChainAnchors.organizationId, top: sql`MAX(${auditChainAnchors.toSeq})` })
        .from(auditChainAnchors).groupBy(auditChainAnchors.organizationId),
    ]);
    const topMap = Object.fromEntries(anchTops.map((r) => [r.org, Number(r.top || 0)]));
    let auditBacklog = 0;
    for (const h of heads) auditBacklog += Math.max(0, Number(h.lastSeq || 0) - (topMap[h.org] || 0));

    const [lastA] = await db.select({ at: sql`MAX(${auditChainAnchors.anchoredAt})` }).from(auditChainAnchors);
    const lastAnchoredAt = lastA?.at || null;
    const lastAnchorAgeHours = lastAnchoredAt ? Math.round((Date.now() - new Date(lastAnchoredAt).getTime()) / 3600_000) : null;

    return res.json({
      success: true,
      data: {
        enabled: stats.enabled,
        network: stats.network,
        walletAddress: stats.walletAddress || null,
        walletBalance: balance,
        minBalance,
        lowBalance: stats.enabled && balance < minBalance,
        pendingAnchors: Number(pend?.n || 0),
        auditBacklog,
        lastAnchoredAt,
        lastAnchorAgeHours,
      },
    });
  } catch (error) {
    console.error('superadmin getBlockchainHealth error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load blockchain health' });
  }
};

export const getEncryptionAdoption = async (req, res) => {
  try {
    const rows = await db.select({ v: documentVersions.keyWrapVersion, n: count() })
      .from(documentVersions).groupBy(documentVersions.keyWrapVersion);
    let v1 = 0, v2 = 0, other = 0;
    for (const r of rows) {
      const n = Number(r.n);
      if (r.v === 'v2_hybrid_pqc') v2 += n;
      else if (r.v === 'v1_vault') v1 += n;
      else other += n;
    }
    const total = v1 + v2 + other;

    const [[kp], [orgTotal]] = await Promise.all([
      db.select({ n: sql`COUNT(DISTINCT ${pqcKeypairs.organizationId})` }).from(pqcKeypairs).where(eq(pqcKeypairs.isActive, true)),
      db.select({ n: count() }).from(organizations),
    ]);

    const perRows = await db.select({ org: documents.organizationId, v: documentVersions.keyWrapVersion, n: count() })
      .from(documentVersions).innerJoin(documents, eq(documents.id, documentVersions.documentId))
      .groupBy(documents.organizationId, documentVersions.keyWrapVersion);
    const map = {};
    for (const r of perRows) {
      const m = map[r.org] || (map[r.org] = { v1: 0, v2: 0, total: 0 });
      const n = Number(r.n);
      if (r.v === 'v2_hybrid_pqc') m.v2 += n; else m.v1 += n;
      m.total += n;
    }
    const orgIds = Object.keys(map).filter((k) => k && k !== 'null');
    const nameRows = orgIds.length
      ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))
      : [];
    const nameMap = Object.fromEntries(nameRows.map((o) => [o.id, o.name]));
    const perTenant = orgIds
      .map((id) => ({ orgId: id, name: nameMap[id] || null, v1: map[id].v1, v2: map[id].v2, total: map[id].total, pctV2: map[id].total ? Math.round((map[id].v2 / map[id].total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);

    return res.json({
      success: true,
      data: {
        platform: { v1, v2, other, total, pctV2: total ? Math.round((v2 / total) * 1000) / 10 : 0 },
        orgsWithActiveKeypair: Number(kp?.n || 0),
        totalOrgs: Number(orgTotal?.n || 0),
        pqcEnabled: process.env.PQC_WRAP_ENABLED === 'true',
        perTenant,
      },
    });
  } catch (error) {
    console.error('superadmin getEncryptionAdoption error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load encryption adoption' });
  }
};

export const getAdminActivity = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const adminWhere = and(
      inArray(auditLogs.resourceType, ['organization', 'system']),
      sql`${auditLogs.details} ->> 'actor' = ${ADMIN_ACTOR}`,
    );
    const [[{ total }], rows] = await Promise.all([
      db.select({ total: count() }).from(auditLogs).where(adminWhere),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        organizationId: auditLogs.organizationId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        orgName: organizations.name,
      })
        .from(auditLogs)
        .leftJoin(organizations, eq(organizations.id, auditLogs.organizationId))
        .where(adminWhere)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ]);
    return res.json({
      success: true,
      data: { activity: rows, pagination: { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) } },
    });
  } catch (error) {
    console.error('superadmin getAdminActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load admin activity' });
  }
};

const K_ANON = 5;
export const getSecurityOverview = async (req, res) => {
  try {
    const now = new Date();
    const start30 = new Date(Date.now() - 30 * 86400_000);

    const [[tot], [totp], [locked], [failed], [unverified], [google]] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(users).where(eq(users.twoFactorEnabled, true)),
      db.select({ n: count() }).from(users).where(gt(users.lockedUntil, now)),
      db.select({ s: sql`COALESCE(SUM(${users.failedLoginAttempts}), 0)` }).from(users),
      db.select({ n: count() }).from(users).where(eq(users.isEmailVerified, false)),
      db.select({ n: count() }).from(users).where(isNotNull(users.googleId)),
    ]);
    const totalUsers = Number(tot?.n || 0);
    const googleCount = Number(google?.n || 0);

    const evRows = await db.select({ type: securityEvents.eventType, n: count() }).from(securityEvents)
      .where(and(eq(securityEvents.isResolved, false), gte(securityEvents.createdAt, start30)))
      .groupBy(securityEvents.eventType);
    const eventsByType = Object.fromEntries(evRows.map((r) => [r.type, Number(r.n)]));

    const [uRows, tRows, lRows] = await Promise.all([
      db.select({ org: users.organizationId, n: count() }).from(users).groupBy(users.organizationId),
      db.select({ org: users.organizationId, n: count() }).from(users).where(eq(users.twoFactorEnabled, true)).groupBy(users.organizationId),
      db.select({ org: users.organizationId, n: count() }).from(users).where(gt(users.lockedUntil, now)).groupBy(users.organizationId),
    ]);
    const uMap = Object.fromEntries(uRows.map((r) => [r.org, Number(r.n)]));
    const tMap = Object.fromEntries(tRows.map((r) => [r.org, Number(r.n)]));
    const lMap = Object.fromEntries(lRows.map((r) => [r.org, Number(r.n)]));
    const orgIds = Object.keys(uMap).filter((k) => k && k !== 'null');
    const nameRows = orgIds.length
      ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))
      : [];
    const nameMap = Object.fromEntries(nameRows.map((o) => [o.id, o.name]));
    const perTenant = orgIds.map((id) => {
      const u = uMap[id];
      if (u < K_ANON) return { orgId: id, name: nameMap[id] || null, suppressed: true, users: u };
      return {
        orgId: id, name: nameMap[id] || null, suppressed: false, users: u,
        totpEnabled: tMap[id] || 0,
        totpPct: Math.round(((tMap[id] || 0) / u) * 1000) / 10,
        locked: lMap[id] || 0,
      };
    }).sort((a, b) => b.users - a.users);

    return res.json({
      success: true,
      data: {
        platform: {
          totalUsers,
          totpEnabled: Number(totp?.n || 0),
          totpPct: totalUsers ? Math.round((Number(totp?.n || 0) / totalUsers) * 1000) / 10 : 0,
          lockedNow: Number(locked?.n || 0),
          failedLoginSum: Number(failed?.s || 0),
          unverifiedEmail: Number(unverified?.n || 0),
          googleSso: googleCount,
          passwordOnly: Math.max(0, totalUsers - googleCount),
        },
        eventsByType,
        perTenant,
      },
    });
  } catch (error) {
    console.error('superadmin getSecurityOverview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load security overview' });
  }
};

export const getLeakMonitoring = async (req, res) => {
  try {
    const now = Date.now();
    const since7d = new Date(now - 7 * 86400_000);
    const since30d = new Date(now - 30 * 86400_000);
    const serperBudget = parseInt(process.env.SERPER_MONTHLY_BUDGET || '2500', 10);
    const CREDITS = sql`COALESCE(SUM(COALESCE(jsonb_array_length(${leakScans.searchQueries}), 0)), 0)`;
    const isSerper = sql`${leakScans.sourcesSearched} @> '["serper"]'::jsonb`;

    const [
      [tracked], [wm], [totalScans], [scans7d], [lastScan],
      [totalLeaks], [leaks30d], [credTotal], [cred30d],
    ] = await Promise.all([
      db.select({ n: count() }).from(documents).where(eq(documents.trackingEnabled, true)),
      db.select({ n: count() }).from(downloadWatermarks).where(isNotNull(downloadWatermarks.visibleCode)),
      db.select({ n: count() }).from(leakScans),
      db.select({ n: count() }).from(leakScans).where(gte(leakScans.completedAt, since7d)),
      db.select({ ts: sql`MAX(${leakScans.completedAt})` }).from(leakScans),
      db.select({ n: count() }).from(leakReports),
      db.select({ n: count() }).from(leakReports).where(gte(leakReports.discoveredAt, since30d)),
      db.select({ c: CREDITS }).from(leakScans).where(isSerper),
      db.select({ c: CREDITS }).from(leakScans).where(and(isSerper, gte(leakScans.completedAt, since30d))),
    ]);

    const [trackedByOrg, scanByOrg, leakByOrg] = await Promise.all([
      db.select({ org: documents.organizationId, n: count() }).from(documents)
        .where(eq(documents.trackingEnabled, true)).groupBy(documents.organizationId),
      db.select({ org: leakScans.organizationId, n: count(), last: sql`MAX(${leakScans.completedAt})` })
        .from(leakScans).groupBy(leakScans.organizationId),
      db.select({ org: leakScans.organizationId, n: count() }).from(leakReports)
        .innerJoin(leakScans, eq(leakReports.scanId, leakScans.id)).groupBy(leakScans.organizationId),
    ]);
    const trackedMap = Object.fromEntries(trackedByOrg.map((r) => [r.org, Number(r.n)]));
    const scanMap = Object.fromEntries(scanByOrg.map((r) => [r.org, { scans: Number(r.n), last: r.last }]));
    const leakMap = Object.fromEntries(leakByOrg.map((r) => [r.org, Number(r.n)]));
    const orgIds = [...new Set([...Object.keys(trackedMap), ...Object.keys(scanMap)])].filter((k) => k && k !== 'null');
    const nameRows = orgIds.length
      ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds))
      : [];
    const nameMap = Object.fromEntries(nameRows.map((o) => [o.id, o.name]));
    const byTenant = orgIds
      .map((id) => ({
        orgId: id, name: nameMap[id] || null,
        trackedDocs: trackedMap[id] || 0,
        scans: scanMap[id]?.scans || 0,
        leaks: leakMap[id] || 0,
        lastScanAt: scanMap[id]?.last || null,
      }))
      .sort((a, b) => b.leaks - a.leaks || b.scans - a.scans);

    const recentScans = await db.select({
      id: leakScans.id,
      orgName: organizations.name,
      scanType: leakScans.scanType,
      status: leakScans.status,
      leaksFound: leakScans.leaksFound,
      queries: sql`COALESCE(jsonb_array_length(${leakScans.searchQueries}), 0)`,
      sources: leakScans.sourcesSearched,
      completedAt: leakScans.completedAt,
      startedAt: leakScans.startedAt,
    })
      .from(leakScans)
      .leftJoin(organizations, eq(organizations.id, leakScans.organizationId))
      .orderBy(desc(sql`COALESCE(${leakScans.completedAt}, ${leakScans.startedAt})`))
      .limit(15);

    return res.json({
      success: true,
      data: {
        providers: {
          configured: configuredProvidersWithKeys(),
          autoScanEnabled: process.env.OSINT_AUTOSCAN_ENABLED === 'true' && configuredProvidersWithKeys().length > 0,
        },
        platform: {
          trackedDocs: Number(tracked?.n || 0),
          watermarkedDownloads: Number(wm?.n || 0),
          totalScans: Number(totalScans?.n || 0),
          scansLast7d: Number(scans7d?.n || 0),
          lastScanAt: lastScan?.ts || null,
          totalLeaks: Number(totalLeaks?.n || 0),
          leaksLast30d: Number(leaks30d?.n || 0),
          serperCreditsTotal: Number(credTotal?.c || 0),
          serperCreditsLast30d: Number(cred30d?.c || 0),
          serperMonthlyBudget: serperBudget,
        },
        byTenant,
        recentScans,
      },
    });
  } catch (error) {
    console.error('superadmin getLeakMonitoring error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load leak monitoring' });
  }
};

export const getSshStatus = (req, res) => {
  const c = sshSvc.cfg();
  return res.json({
    success: true,
    data: {
      enabled: sshSvc.isEnabled(),
      host: sshSvc.isEnabled() ? c.host : null,
      user: sshSvc.isEnabled() ? c.user : null,
      port: c.port,
      otpRequired: sshSvc.otpRequired(),
      busy: sshSvc.isActive(),
    },
  });
};

const sshAuditCtx = (req) => ({ ip: sshClientIp(req), userAgent: req.headers?.['user-agent'] || null });

export const sendSshOtp = async (req, res) => {
  if (!sshSvc.isEnabled()) return res.status(404).json({ success: false, message: 'SSH console disabled' });
  const ctx = sshAuditCtx(req);
  if (sshSvc.isLocked(ctx.ip)) {
    sshSvc.auditSsh('ssh_access_locked', 'SSH OTP requested while the IP was locked out', { ...ctx, stage: 'otp' });
    return res.status(429).json({ success: false, message: 'Terkunci sementara.' });
  }
  try {
    const r = await sshSvc.sendOtp();
    if (!r.sent) {
      sshSvc.auditSsh('ssh_otp_failed', 'SSH console OTP not sent', { ...ctx, reason: r.reason });
      const map = { 'not-configured': 'OTP email belum dikonfigurasi.', cooldown: 'Tunggu sebentar sebelum kirim ulang.', rate: 'Terlalu banyak permintaan OTP.' };
      return res.status(429).json({ success: false, message: map[r.reason] || 'Gagal mengirim OTP.' });
    }
    sshSvc.auditSsh('ssh_otp_sent', 'SSH console OTP sent to the operator inbox', { ...ctx });
    return res.json({ success: true, data: { sent: true } });
  } catch (error) {
    console.error('superadmin sendSshOtp error:', error.message);
    sshSvc.auditSsh('ssh_otp_failed', 'SSH console OTP send failed', { ...ctx, reason: 'send-error' });
    return res.status(500).json({ success: false, message: 'Gagal mengirim OTP.' });
  }
};

export const createSshTicket = (req, res) => {
  if (!sshSvc.isEnabled()) return res.status(404).json({ success: false, message: 'SSH console disabled' });
  const ctx = sshAuditCtx(req);
  if (sshSvc.isLocked(ctx.ip)) {
    sshSvc.auditSsh('ssh_access_locked', 'SSH ticket requested while the IP was locked out', { ...ctx, stage: 'ticket' });
    return res.status(429).json({ success: false, message: 'Terkunci sementara — coba lagi nanti.' });
  }
  if (sshSvc.otpRequired() && !sshSvc.verifyOtp(req.body?.otp)) {
    sshSvc.auditSsh('ssh_ticket_denied', 'SSH ticket denied — wrong or expired OTP', { ...ctx });
    return res.status(401).json({ success: false, message: 'OTP salah atau kadaluarsa.' });
  }
  const ticket = sshSvc.issueTicket(ctx.ip);
  sshSvc.auditSsh('ssh_ticket_issued', 'SSH console ticket issued', { ...ctx, otpRequired: sshSvc.otpRequired() });
  return res.json({ success: true, data: { ticket, wsPath: '/api/superadmin/ssh' } });
};
