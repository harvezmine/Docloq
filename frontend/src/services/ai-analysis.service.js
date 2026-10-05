import api from './api';

const aiAnalysisService = {
  getDocuments: (search = '') => {
    const params = search ? { search } : {};
    return api.get('/ai-analysis/documents', { params });
  },

  // Decrypts, embeds, and indexes the document in Qdrant.
  // redactionMode: 'censored' censors identities before anything reaches OpenAI; 'full' sends
  // the document as-is. Applied at ingest, so it cannot be changed without re-ingesting.
  grantAccess: (documentId, redactionMode = 'censored') => {
    return api.post(`/ai-analysis/documents/${documentId}/grant`, { redactionMode });
  },

  // Deletes the document's vector from Qdrant
  revokeAccess: (documentId) => {
    return api.post(`/ai-analysis/documents/${documentId}/revoke`);
  },

  analyzeDocument: (documentId, prompt, pageRange = null) => {
    const body = { prompt };
    if (pageRange && pageRange.length > 0) {
      body.pageRange = pageRange;
    }
    return api.post(`/ai-analysis/documents/${documentId}/analyze`, body);
  },

  getPageInfo: (documentId) => {
    return api.get(`/ai-analysis/documents/${documentId}/page-info`);
  },

  getQuota: () => {
    return api.get('/ai-analysis/quota');
  },

  getHistory: (documentId) => {
    return api.get(`/ai-analysis/documents/${documentId}/history`);
  },

  getStatus: (documentId) => {
    return api.get(`/ai-analysis/documents/${documentId}/status`);
  },
};

export default aiAnalysisService;
