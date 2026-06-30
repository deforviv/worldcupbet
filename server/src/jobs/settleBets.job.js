const cron = require('node-cron');
const { runSettlement } = require('../modules/settlements/settlement.service');
const { lockOddsForMatch } = require('../modules/odds/odds.service');
const prisma = require('../config/database');
const logger = require('../config/logger');

/**
 * Job: Settle bets for completed matches + lock odds for started matches
 * Schedule: Every 15 minutes
 */
const settleBetsJob = cron.schedule('*/15 * * * *', async () => {
  logger.info('[Job:SettleBets] Running...');
  try {
    // 1. Lock odds for matches that have just kicked off
    const startedMatches = await prisma.match.findMany({
      where: {
        status: { in: ['LIVE', 'FINISHED'] },
        oddsLockedAt: null,
      },
    });
    for (const m of startedMatches) {
      await lockOddsForMatch(m.id).catch(e =>
        logger.warn(`[Job:SettleBets] Lock failed for ${m.id}`, { error: e.message })
      );
    }

    // 2. Settle finished matches
    await runSettlement();
    logger.info('[Job:SettleBets] Done');
  } catch (err) {
    logger.error('[Job:SettleBets] Failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = settleBetsJob;
