import api from './api';

// Handles both RFC5987 (filename*=UTF-8''..) and plain filename=".." forms
function filenameFromDisposition(disposition) {
  if (!disposition) return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star?.[1]) { try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { /* fall through */ } }
  const plain = /filename="?([^"]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() || null;
}

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const documentService = {
  getAllDocuments: async () => {
    const response = await api.get('/documents');
    return response.data;
  },

  getDocument: async (id) => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  uploadDocument: async (file, onProgress, folderId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
    return response.data;
  },

  // Prefer server filename; fall back so the file is never saved as "unknown"
  downloadDocument: async (id, filename) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    const serverName = filenameFromDisposition(response.headers?.['content-disposition']);
    saveBlob(response.data, serverName || filename || `document-${id}`);
  },

  downloadDocumentAs: async (id, originalFilename, format) => {
    const response = await api.get(`/documents/${id}/download-as`, {
      params: { format },
      responseType: 'blob',
    });
    const serverName = filenameFromDisposition(response.headers?.['content-disposition']);
    const baseName = (originalFilename || `document-${id}`).replace(/\.[^.]+$/, '');
    saveBlob(response.data, serverName || `${baseName}.${format}`);
  },

  deleteDocument: async (id) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  // PDF becomes an editable DOCX; no-op for already-editable formats
  convertToEditable: async (id) => {
    const response = await api.post(`/documents/${id}/convert-to-editable`);
    return response.data;
  },

  getOnlyOfficeConfig: async (id, mode = 'view', { theme, bandwidth } = {}) => {
    const params = { mode };
    if (theme) params.theme = theme;
    if (bandwidth) params.bandwidth = bandwidth;
    const response = await api.get(`/documents/${id}/onlyoffice-config`, { params });
    return response.data;
  },

  // Uses the OnlyOffice Command Service
  forceSave: async (id) => {
    const response = await api.post(`/documents/${id}/force-save`);
    return response.data;
  },

  getFileUrl: (id) => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    return `${baseUrl}/documents/${id}/file`;
  },

  // <img>/<iframe> can't send auth headers, so fetch via axios and wrap in an
  // object URL; uses /file (no watermark/audit side-effects), not /download
  getFileBlobUrl: async (id, mimeType) => {
    const response = await api.get(`/documents/${id}/file`, { responseType: 'blob' });
    const typed = mimeType ? new Blob([response.data], { type: mimeType }) : response.data;
    return window.URL.createObjectURL(typed);
  },

  getPresence: async (id) => {
    const response = await api.get(`/documents/${id}/presence`);
    return response.data;
  },

  sendHeartbeat: async (id, mode) => {
    const response = await api.post(`/documents/${id}/presence`, { mode });
    return response.data;
  },

  leavePresence: async (id) => {
    const response = await api.delete(`/documents/${id}/presence`);
    return response.data;
  },

  releaseLock: async (id) => {
    const response = await api.post(`/documents/${id}/edit-lock/release`);
    return response.data;
  },

  forceReleaseLock: async (id) => {
    const response = await api.post(`/documents/${id}/edit-lock/force-release`);
    return response.data;
  },

  pingEditor: async (id) => {
    const response = await api.post(`/documents/${id}/ping-editor`);
    return response.data;
  },

  getBreadcrumb: async (id) => {
    const response = await api.get(`/documents/${id}/breadcrumb`);
    return response.data;
  },

  renameDocument: async (id, filename) => {
    const response = await api.patch(`/documents/${id}`, { filename });
    return response.data;
  },

  listComments: async (id) => {
    const response = await api.get(`/documents/${id}/comments`);
    return response.data;
  },

  createComment: async (id, payload) => {
    const response = await api.post(`/documents/${id}/comments`, payload);
    return response.data;
  },

  deleteComment: async (commentId) => {
    const response = await api.delete(`/documents/comments/${commentId}`);
    return response.data;
  },

  searchMentionableUsers: async (id, q) => {
    const response = await api.get(`/documents/${id}/mentionable-users`, { params: { q } });
    return response.data;
  },
};

export default documentService;
