const rateLimit = require('express-rate-limit');
const { rateLimit: rl } = require('../config/env');

function isReadOnlyPublicData(req) {
  if (req.method !== 'GET') return false;

  return (
    req.path === '/health' ||
    req.path.startsWith('/matches') ||
    req.path.startsWith('/odds')
  );
}

function isProtectedApiRoute(req) {
  return (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/bets') ||
    req.path.startsWith('/wallet') ||
    req.path.startsWith('/admin')
  );
}

const publicLimiter = rateLimit({
  windowMs: rl.windowMs,
  max: rl.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => isReadOnlyPublicData(req) || isProtectedApiRoute(req),
});

const authenticatedLimiter = rateLimit({
  windowMs: rl.windowMs,
  max: rl.max * 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: rl.windowMs,
  max: rl.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true,
});

module.exports = { publicLimiter, authenticatedLimiter, authLimiter };
