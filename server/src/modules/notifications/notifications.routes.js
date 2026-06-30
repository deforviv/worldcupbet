const router = require('express').Router();
const { auth } = require('../../middleware/auth');
const ctrl = require('./notifications.controller');

router.use(auth);
router.get('/count', ctrl.unreadCount);
router.get('/', ctrl.listNotifications);
router.post('/mark-read', ctrl.markAllRead);

module.exports = router;
