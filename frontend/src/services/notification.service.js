import api from './api';

const notificationService = {
  getNotifications: (limit = 30, offset = 0) => {
    return api.get('/notifications', { params: { limit, offset } });
  },

  getUnreadCount: () => {
    return api.get('/notifications/unread-count');
  },

  markAsRead: (id) => {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: () => {
    return api.patch('/notifications/read-all');
  },

  deleteNotification: (id) => {
    return api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
