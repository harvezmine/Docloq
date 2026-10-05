import api from './api';

const blockchainService = {
  anchorDocument: async (documentId) => {
    const response = await api.post(`/blockchain/anchor/${documentId}`);
    return response.data;
  },

  // Re-anchor after an edit
  updateAnchor: async (documentId) => {
    const response = await api.put(`/blockchain/anchor/${documentId}`);
    return response.data;
  },

  verifyDocument: async (documentId) => {
    const response = await api.post(`/blockchain/verify/${documentId}`);
    return response.data;
  },

  getAnchorInfo: async (documentId) => {
    const response = await api.get(`/blockchain/anchor/${documentId}`);
    return response.data;
  },

  // Auto-anchor = re-anchor automatically on each edit
  setAutoAnchor: async (documentId, enabled) => {
    const response = await api.patch(`/blockchain/auto-anchor/${documentId}`, { enabled });
    return response.data;
  },

  anchorBatch: async (documentIds) => {
    const response = await api.post('/blockchain/anchor-batch', { documentIds });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/blockchain/stats');
    return response.data;
  },

  getTransactions: async (params = {}) => {
    const response = await api.get('/blockchain/transactions', { params });
    return response.data;
  },
};

export default blockchainService;
