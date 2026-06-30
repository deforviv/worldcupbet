const notificationsService = require('./notifications.service');

const unreadCount = async (req, res, next) => {
  try {
    const count = await notificationsService.getUnreadNotificationsCount(req.user.id);
    res.json({ count });
  } catch (err) { next(err); }
};

const listNotifications = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const notifications = await notificationsService.getNotifications(req.user.id, { page, limit: 20 });
    res.json({ notifications });
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    await notificationsService.markAllNotificationsRead(req.user.id);
    res.json({ message: 'Notifications marquées comme lues' });
  } catch (err) { next(err); }
};

module.exports = { unreadCount, listNotifications, markAllRead };