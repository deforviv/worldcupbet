const cron = require('node-cron');
const { recalcAllUpcomingOdds } = require('../modules/odds/odds.service');
const logger = require('../config/logger');

/**
 * Job: Recalculate odds for all upcoming matches
 * Schedule: Every 12 hours (00:00 and 12:00)
 */
const recalcOddsJob = cron.schedule('0 0,12 * * *', async () => {
  logger.info('[Job:RecalcOdds] Starting odds recalculation...');
  try {
    await recalcAllUpcomingOdds();
    logger.info('[Job:RecalcOdds] Done');
  } catch (err) {
    logger.error('[Job:RecalcOdds] Failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = recalcOddsJob;
