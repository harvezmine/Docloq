import api from './api';

const verificationService = {
  // Public lookup by 8-char short code
  verifyByShortCode: async (code) => {
    const { data } = await api.get('/documents/verify', { params: { code } });
    return data;
  },

  // Decodes uploaded QR image (PNG/JPG) then looks up the document
  verifyByQrImage: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/documents/verify-qr-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  verifyByFile: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/documents/verify-file', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getBlockchainIntegrity: async (documentId) => {
    const { data } = await api.get(`/documents/${documentId}/blockchain-integrity`);
    return data;
  },

  // Total page count comes from the X-Total-Pages header; caller must revoke the blobUrl when done
  getVerifyPreview: async (documentId, page = 1) => {
    const res = await api.get(`/documents/${documentId}/verify-preview`, {
      params: { page },
      responseType: 'blob',
    });
    const totalPages = parseInt(res.headers['x-total-pages'] || '1', 10) || 1;
    return { blobUrl: URL.createObjectURL(res.data), totalPages };
  },

  // Caller must revoke the returned blob URL when done
  getQrImageUrl: async (documentId) => {
    const response = await api.get(`/documents/${documentId}/qr-image`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  },
};

export default verificationService;
