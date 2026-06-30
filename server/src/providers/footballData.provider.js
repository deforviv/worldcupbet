const axios = require('axios');
const { footballData } = require('../config/env');
const logger = require('../config/logger');

const client = axios.create({
  baseURL: footballData.baseUrl,
  headers: { 'X-Auth-Token': footballData.apiKey },
  timeout: 15000,
});

/**
 * Helper: pause execution for a given number of milliseconds.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch all FIFA World Cup 2026 matches with exponential-backoff retry.
 * On total failure the function THROWS so callers (syncMatches) know not to
 * wipe the DB — existing rows are the safest fallback (no fake data).
 *
 * Retry schedule:  attempt 1 → immediate
 *                  attempt 2 → 2 s
 *                  attempt 3 → 4 s
 */
async function fetchWorldCupMatches(retries = 3) {
  let lastErr;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`[FootballData] Fetching WC 2026 matches (attempt ${attempt}/${retries})...`);
      const res = await client.get(`/competitions/${footballData.competitionCode}/matches`);
      const matches = res.data.matches || [];
      logger.info(`[FootballData] Received ${matches.length} matches from API.`);
      return matches;
    } catch (err) {
      lastErr = err;
      logger.warn(`[FootballData] Attempt ${attempt} failed: ${err.message}`);

      if (attempt < retries) {
        const waitMs = 2000 * attempt; // 2 s, 4 s
        logger.info(`[FootballData] Waiting ${waitMs / 1000}s before retry...`);
        await sleep(waitMs);
      }
    }
  }

  logger.error('[FootballData] All fetch attempts failed. Existing DB data will be kept.', {
    error: lastErr?.message,
  });
  throw lastErr;
}

/**
 * Fetch a single match by its external ID
 */
async function fetchMatchById(externalId) {
  try {
    const res = await client.get(`/matches/${externalId}`);
    return res.data;
  } catch (err) {
    logger.error('[FootballData] Failed to fetch match', { externalId, error: err.message });
    throw err;
  }
}

/**
 * Map Football-Data.org status strings to our MatchStatus enum.
 */
function mapStatus(fdStatus) {
  const map = {
    SCHEDULED: 'SCHEDULED',
    TIMED:     'SCHEDULED',
    IN_PLAY:   'LIVE',
    PAUSED:    'LIVE',
    FINISHED:  'FINISHED',
    POSTPONED: 'POSTPONED',
    SUSPENDED: 'POSTPONED',
    CANCELLED: 'CANCELLED',
  };
  return map[fdStatus] || 'SCHEDULED';
}

/**
 * Normalize a raw match from Football-Data.org into our DB schema.
 */
const PLACEHOLDER_STRINGS = ['TBD', 'UNKNOWN', 'UN', 'NA', 'N/A', 'NONE'];

function isPlaceholderValue(value) {
  if (!value) return true;
  return PLACEHOLDER_STRINGS.includes(String(value).trim().toUpperCase());
}

function normalizeTeamName(team) {
  if (!team) return null;
  const candidates = [team.name, team.shortName, team.tla];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = String(candidate).trim();
    if (!isPlaceholderValue(text)) return text;
  }
  return null;
}

function normalizeTeamCode(team) {
  if (!team) return null;
  const candidates = [team.tla, team.shortName];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = String(candidate).trim().toUpperCase();
    if (isPlaceholderValue(text)) continue;
    if (/^[A-Z]{3}$/.test(text)) return text;
  }
  return null;
}

function normalizeMatch(m) {
  const homeTeam = normalizeTeamName(m.homeTeam);
  const awayTeam = normalizeTeamName(m.awayTeam);
  const homeTeamCode = normalizeTeamCode(m.homeTeam);
  const awayTeamCode = normalizeTeamCode(m.awayTeam);

  return {
    externalId:   m.id,
    homeTeam:     homeTeam || 'TBD',
    awayTeam:     awayTeam || 'TBD',
    homeTeamCode: homeTeamCode || 'TBD',
    awayTeamCode: awayTeamCode || 'TBD',
    kickoffTime:  new Date(m.utcDate),
    competition:  'FIFA World Cup 2026',
    stage:        m.stage || null,
    group:        m.group || null,
    status:       mapStatus(m.status),
    homeScore:    m.score?.fullTime?.home ?? null,
    awayScore:    m.score?.fullTime?.away ?? null,
  };
}

module.exports = { fetchWorldCupMatches, fetchMatchById, normalizeMatch };
