import api from './api';

const folderService = {
  // Get all folders (flat list)
  getAllFolders: async () => {
    const response = await api.get('/folders');
    return response.data;
  },

  // Get single folder with documents and children
  getFolder: async (id) => {
    const response = await api.get(`/folders/${id}`);
    return response.data;
  },

  createFolder: async ({ name, parentId, color, icon, description }) => {
    const response = await api.post('/folders', { name, parentId, color, icon, description });
    return response.data;
  },

  updateFolder: async (id, data) => {
    const response = await api.put(`/folders/${id}`, data);
    return response.data;
  },

  // Delete folder (soft-delete)
  deleteFolder: async (id) => {
    const response = await api.delete(`/folders/${id}`);
    return response.data;
  },

  // Move document to folder (or root if folderId is null)
  moveDocument: async (documentId, folderId) => {
    const response = await api.post('/folders/move-document', { documentId, folderId });
    return response.data;
  },

  // Move folder to new parent (or root if newParentId is null)
  moveFolder: async (folderId, newParentId) => {
    const response = await api.post('/folders/move-folder', { folderId, newParentId });
    return response.data;
  },
};

export default folderService;
