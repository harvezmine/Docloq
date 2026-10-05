import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const GATE_STORAGE_KEY = 'docloq_superadmin_gate';

export const getGate = () => {
  try {
    return sessionStorage.getItem(GATE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

export const setGate = (password) => {
  try {
    sessionStorage.setItem(GATE_STORAGE_KEY, password);
  } catch {
  }
};

export const clearGate = () => {
  try {
    sessionStorage.removeItem(GATE_STORAGE_KEY);
  } catch {
  }
};

const client = axios.create({
  baseURL: `${API_URL}/superadmin`,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const gate = getGate();
  if (gate) {
    config.headers['X-Admin-Gate'] = gate;
  }
  return config;
});

const unwrap = (res) => {
  const body = res?.data;
  if (body && body.success === false) {
    const err = new Error(body.message || 'Permintaan gagal.');
    err.response = res;
    throw err;
  }
  return body?.data;
};

const superadminService = {
  getStats: async () => {
    const res = await client.get('/stats');
    return unwrap(res);
  },

  listTenants: async ({ search = '', page = 1, limit = 10 } = {}) => {
    const res = await client.get('/tenants', { params: { search, page, limit } });
    return unwrap(res);
  },

  getTenant: async (id) => {
    const res = await client.get(`/tenants/${id}`);
    return unwrap(res);
  },

  createTenant: async ({ companyName, email, firstName, lastName, password }) => {
    const res = await client.post('/tenants', {
      companyName,
      email,
      firstName,
      lastName,
      password,
    });
    return unwrap(res);
  },

  setTenantStatus: async (id, isActive) => {
    const res = await client.patch(`/tenants/${id}/status`, { isActive });
    return unwrap(res);
  },

  setTenantFeatures: async (id, features) => {
    const res = await client.patch(`/tenants/${id}/features`, { features });
    return unwrap(res);
  },

  getAuditChainStatus: async (orgId) => unwrap(await client.get('/audit/chain-status', { params: { orgId } })),
  verifyAuditChain: async (orgId) => unwrap(await client.get('/audit/verify-chain', { params: { orgId } })),
  verifyAuditAnchors: async (orgId) => unwrap(await client.get('/audit/verify-anchors', { params: { orgId } })),
  getAuditBreakReport: async (orgId) => unwrap(await client.get('/audit/break-report', { params: { orgId } })),
  listAuditAnchors: async (orgId) => unwrap(await client.get('/audit/anchors', { params: { orgId } })),
  listAuditEntries: async (orgId, limit = 50) => unwrap(await client.get('/audit/entries', { params: { orgId, limit } })),
  getAuditEntryProof: async (orgId, seq) => unwrap(await client.get('/audit/entry-proof', { params: { orgId, seq } })),
  anchorAuditNow: async (orgId) => unwrap(await client.post('/audit/anchor-now', {}, { params: { orgId } })),

  getAuditBackups: async () => unwrap(await client.get('/audit/backups')),
  previewAuditRecovery: async (orgId, file) => unwrap(await client.post('/audit/recover/preview', { orgId, file })),
  recoverAuditChain: async (orgId, file) => unwrap(await client.post('/audit/recover', { orgId, file })),

  getDatabaseOverview: async () => unwrap(await client.get('/database/overview')),
  getDatabaseTables: async () => unwrap(await client.get('/database/tables')),
  getDatabaseBackups: async () => unwrap(await client.get('/database/backups')),
  backupDatabase: async () => unwrap(await client.post('/database/backup', {})),

  getBlockchainStats: async () => unwrap(await client.get('/blockchain/stats')),
  getBlockchainTransactions: async (limit = 25) => unwrap(await client.get('/blockchain/transactions', { params: { limit } })),

  getBlockchainHealth: async () => unwrap(await client.get('/blockchain/health')),
  getEncryptionAdoption: async () => unwrap(await client.get('/encryption')),
  getAdminActivity: async ({ page = 1, limit = 30 } = {}) =>
    unwrap(await client.get('/admin-activity', { params: { page, limit } })),
  getSecurityOverview: async () => unwrap(await client.get('/security')),
  getLeakMonitoring: async () => unwrap(await client.get('/leak-monitoring')),

  getSshStatus: async () => unwrap(await client.get('/ssh/status')),
  sendSshOtp: async () => unwrap(await client.post('/ssh/otp', {})),
  createSshTicket: async (otp) => unwrap(await client.post('/ssh/ticket', { otp })),
};

export function sshWsUrl(wsPath, ticket) {
  const origin = new URL(API_URL, window.location.origin).origin;
  const wsOrigin = origin.replace(/^http/, 'ws');
  return `${wsOrigin}${wsPath}?ticket=${encodeURIComponent(ticket)}`;
}

export default superadminService;
