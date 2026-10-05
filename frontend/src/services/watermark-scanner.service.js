// Watermark Scanner API Service

import api from './api';

const watermarkScannerService = {
  // Scan a file for invisible watermarks
  scanDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/watermark-scanner/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Get watermark download history for a document
  getHistory: (documentId) => {
    return api.get(`/watermark-scanner/history/${documentId}`);
  },

  // Get details for a specific watermark
  getDetails: (watermarkId) => {
    return api.get(`/watermark-scanner/details/${watermarkId}`);
  },
};

export default watermarkScannerService;
