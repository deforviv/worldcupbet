require('dotenv').config();
const app    = require('./src/app');
const { port } = require('./src/config/env');
const prisma   = require('./src/config/database');
const logger   = require('./src/config/logger');const { runSettlement } = require('./src/modules/settlements/settlement.service');
// ─── Cron Jobs ────────────────────────────────────────────────────────────────
const fetchMatchesJob = require('./src/jobs/fetchMatches.job');
const recalcOddsJob   = require('./src/jobs/recalcOdds.job');
const settleBetsJob   = require('./src/jobs/settleBets.job');

async function start() {
  // 1. Test DB connection
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed', { error: err.message });
    process.exit(1);
  }

  // 2. Start HTTP server first so the app is reachable immediately
  const server = app.listen(port, () => {
    logger.info(`🚀 WorldCupBet API running on http://localhost:${port}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
  });

  // 3. Start cron jobs
  fetchMatchesJob.start();
  recalcOddsJob.start();
  settleBetsJob.start();
  logger.info('⏰ Cron jobs started');

  // 4. ALWAYS run an initial fixture sync on boot — no env flag required.
  //    This ensures the DB is populated immediately so the frontend never
  //    shows an empty list on first load. On API failure the service keeps
  //    existing DB rows (no data loss, no fake data).
  logger.info('🔄 Running startup fixture sync...');
  const { syncMatches } = require('./src/modules/matches/matches.service');
  syncMatches()
    .then(async result => {
      if (result.skipped) {
        logger.warn('⚠️  Startup sync skipped — football API unreachable. Serving existing DB data.');
      } else {
        logger.info(`✅ Startup sync complete — ${result.created} created, ${result.updated} updated`);
      }

      if (!result.skipped && (result.updated > 0 || result.created > 0)) {
        try {
          logger.info('🔄 Running settlement check after startup sync...');
          await runSettlement();
          logger.info('✅ Settlement check after startup sync complete');
        } catch (settlementErr) {
          logger.error('❌ Settlement check after startup sync failed', { error: settlementErr.message });
        }
      }
    })
    .catch(e => logger.error('❌ Startup sync error', { error: e.message }));

  // 5. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
