import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../services/notification.service.js';

// GET /api/notifications
export const list = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;
    const data = await getUserNotifications(req.user.id, { limit, offset });
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Notification] list error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/notifications/unread-count
export const unreadCount = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('[Notification] unreadCount error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const read = async (req, res) => {
  try {
    const updated = await markAsRead(req.params.id, req.user.id);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Notification] read error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// PATCH /api/notifications/read-all
export const readAll = async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Notification] readAll error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/notifications/:id
export const remove = async (req, res) => {
  try {
    const deleted = await deleteNotification(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('[Notification] remove error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
