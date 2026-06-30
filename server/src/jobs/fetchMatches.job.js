const cron = require('node-cron');
const { syncMatches } = require('../modules/matches/matches.service');
const logger = require('../config/logger');

/**
 * Job: Sync FIFA WC 2026 fixtures from football-data.org
 * Schedule: Every 5 minutes
 */
const fetchMatchesJob = cron.schedule('*/5 * * * *', async () => {
  logger.info('[Job:FetchMatches] Starting fixture sync...');
  try {
    const result = await syncMatches();
    logger.info('[Job:FetchMatches] Done', result);
  } catch (err) {
    logger.error('[Job:FetchMatches] Failed', { error: err.message });
  }
}, { scheduled: false });

module.exports = fetchMatchesJob;
