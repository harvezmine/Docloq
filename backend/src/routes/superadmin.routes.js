
import { Router } from 'express';
import { requireAdminGate } from '../middlewares/superadmin.middleware.js';
import { validateUUID } from '../middlewares/validate.middleware.js';
import {
  getStats,
  listTenants,
  getTenant,
  createTenant,
  setTenantStatus,
  setTenantFeatures,
  getAuditChainStatus,
  verifyAuditChain,
  getAuditBreakReport,
  verifyAuditAnchors,
  listAuditBackups,
  previewAuditRecovery,
  recoverAuditChain,
  getDatabaseOverview,
  listDatabaseTables,
  listDatabaseBackups,
  backupDatabaseNow,
  listAuditAnchors,
  listAuditEntries,
  getAuditEntryProof,
  anchorAuditNow,
  getBlockchainOverview,
  listBlockchainTransactions,
  getBlockchainHealth,
  getEncryptionAdoption,
  getAdminActivity,
  getSecurityOverview,
  getLeakMonitoring,
  getSshStatus,
  sendSshOtp,
  createSshTicket,
} from '../controllers/superadmin.controller.js';

const router = Router();

router.use(requireAdminGate);

router.get('/stats', getStats);
router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', validateUUID('id'), getTenant);
router.patch('/tenants/:id/status', validateUUID('id'), setTenantStatus);
router.patch('/tenants/:id/features', validateUUID('id'), setTenantFeatures);

router.get('/audit/chain-status', getAuditChainStatus);
router.get('/audit/verify-chain', verifyAuditChain);
router.get('/audit/break-report', getAuditBreakReport);
router.get('/audit/verify-anchors', verifyAuditAnchors);
router.get('/audit/anchors', listAuditAnchors);
router.get('/audit/entries', listAuditEntries);
router.get('/audit/entry-proof', getAuditEntryProof);
router.post('/audit/anchor-now', anchorAuditNow);

router.get('/audit/backups', listAuditBackups);
router.post('/audit/recover/preview', previewAuditRecovery);
router.post('/audit/recover', recoverAuditChain);

router.get('/database/overview', getDatabaseOverview);
router.get('/database/tables', listDatabaseTables);
router.get('/database/backups', listDatabaseBackups);
router.post('/database/backup', backupDatabaseNow);

router.get('/blockchain/stats', getBlockchainOverview);
router.get('/blockchain/transactions', listBlockchainTransactions);
router.get('/blockchain/health', getBlockchainHealth);

router.get('/encryption', getEncryptionAdoption);
router.get('/admin-activity', getAdminActivity);
router.get('/security', getSecurityOverview);
router.get('/leak-monitoring', getLeakMonitoring);

router.get('/ssh/status', getSshStatus);
router.post('/ssh/otp', sendSshOtp);
router.post('/ssh/ticket', createSshTicket);

export default router;
