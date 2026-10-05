// Public preview-only share links, API client.
import api from './api';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const shareService = {
  // ── Org member (authed) ──
  async create(documentId, { expiresInDays = 7, maxViews = null } = {}) {
    const res = await api.post(`/documents/${documentId}/shares`, { expiresInDays, maxViews });
    return res.data;
  },
  async list(documentId) {
    const res = await api.get(`/documents/${documentId}/shares`);
    return res.data;
  },
  async revoke(shareId) {
    const res = await api.delete(`/shares/${shareId}`);
    return res.data;
  },

  // ── Public viewer ──
  async getManifest(token) {
    const res = await api.get(`/shares/${token}`);
    return res.data;
  },
  // Page PNG is loaded directly via <img src> (no auth needed).
  pageUrl(token, n) {
    return `${API_BASE.replace(/\/$/, '')}/shares/${token}/page/${n}`;
  },
};

export default shareService;
