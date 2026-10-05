// Signing Service - API calls for DocuSeal e-signing integration

import api from './api';

const signingService = {
  // options.signatureField: { x, y, w, h, page } for custom placement
  requestSigning: async (taskId, documentId, options = {}) => {
    const response = await api.post('/signing/request', {
      taskId,
      documentId,
      ...options,
    });
    return response.data;
  },

  getSigningStatus: async (taskId) => {
    const response = await api.get(`/signing/${taskId}/status`);
    return response.data;
  },

  // Manually polls DocuSeal for updated signing status
  checkSigningStatus: async (taskId) => {
    const response = await api.post(`/signing/${taskId}/check`);
    return response.data;
  },

  // Makes signature image background transparent; imageBase64 can be a data URL or raw base64
  removeBackground: async (imageBase64) => {
    const response = await api.post('/signing/remove-bg', {
      image: imageBase64,
    });
    return response.data;
  },

  getSignedDocuments: async (signatureId) => {
    const response = await api.get(`/signing/${signatureId}/documents`);
    return response.data;
  },
};

export default signingService;
