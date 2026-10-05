// OSINT Tracker service, Monitor stats, Leaks list, Check Document on-demand.

import api from './api';

const osintService = {
  getStats: () => api.get('/osint/stats'),
  listLeaks: (params = {}) => api.get('/osint/leaks', { params }),
  listTrackedDocs: () => api.get('/osint/documents/tracked'),
  checkDocument: (id) => api.post(`/osint/documents/${id}/check`),
  toggleTracking: (id, enabled) => api.patch(`/documents/${id}/tracking`, { enabled }),
  toggleQrOnDownload: (id, enabled) => api.patch(`/documents/${id}/qr-on-download`, { enabled }),
};

export default osintService;
