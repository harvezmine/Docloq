import api from './api';

const trashService = {
  // Get all trash items
  list: async () => {
    const response = await api.get('/trash');
    return response.data;
  },

  // Restore item from trash
  restore: async (id) => {
    const response = await api.post(`/trash/${id}/restore`);
    return response.data;
  },

  // Permanently delete item
  permanentDelete: async (id) => {
    const response = await api.delete(`/trash/${id}`);
    return response.data;
  },

  // Empty all trash
  emptyTrash: async () => {
    const response = await api.delete('/trash');
    return response.data;
  },
};

export default trashService;
