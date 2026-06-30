require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { publicLimiter, authenticatedLimiter } = require('./middleware/rateLimiter');
const { frontend, isDev } = require('./config/env');
const logger = require('./config/logger');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes      = require('./modules/auth/auth.routes');
const matchesRoutes   = require('./modules/matches/matches.routes');
const oddsRoutes      = require('./modules/odds/odds.routes');
const betsRoutes      = require('./modules/bets/bets.routes');
const walletRoutes    = require('./modules/wallet/wallet.routes');
const adminRoutes     = require('./modules/admin/admin.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');

const app = express();
const allowedOrigins = new Set([
  frontend.url,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    if (isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api', publicLimiter);
app.use('/api/bets', authenticatedLimiter);
app.use('/api/wallet', authenticatedLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'WorldCupBet API' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/odds',    oddsRoutes);
app.use('/api/bets',    betsRoutes);
app.use('/api/wallet',  walletRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/notifications', notificationsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    logger.error(`[Error] ${req.method} ${req.path}`, {
      error: message,
      stack: err.stack,
    });
  }

  res.status(status).json({ error: message });
});

module.exports = app;
