const router = require('express').Router();
const ctrl = require('./auth.controller');
const { auth } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { authLimiter } = require('../../middleware/rateLimiter');

router.post('/register', authLimiter, validate(schemas.register), ctrl.register);
router.post('/login',    authLimiter, validate(schemas.login),    ctrl.login);
router.post('/verify-email', authLimiter, validate(schemas.verifyEmail), ctrl.verifyEmail);
router.post('/resend-code',  authLimiter, validate(schemas.resendVerificationCode), ctrl.resendCode);
router.post('/refresh',  ctrl.refresh);
router.get('/me',        auth,        ctrl.me);
router.patch('/me',      auth,        validate(schemas.updateProfile), ctrl.updateMe);

module.exports = router;
