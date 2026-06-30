const prisma = require('../../config/database');
const { fetchWorldCupMatches, normalizeMatch } = require('../../providers/footballData.provider');
const { generateAndSaveOdds } = require('../odds/odds.service');
const { runSettlement } = require('../settlements/settlement.service');
const logger = require('../../config/logger');

let syncInFlight = null;
let lastSyncFinishedAt = 0;
const MIN_SYNC_INTERVAL_MS = 4 * 60 * 1000;

function sameDate(a, b) {
  return new Date(a).getTime() === new Date(b).getTime();
}

const PLACEHOLDER_STRINGS = ['TBD', 'UNKNOWN', 'UN', 'NA', 'N/A', 'NONE'];

function isPlaceholderValue(value) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim().toUpperCase();
  return PLACEHOLDER_STRINGS.includes(text);
}

function buildMatchUpdates(existing, normalized) {
  const updates = {};
  const fields = [
    'status',
    'homeScore',
    'awayScore',
    'stage',
    'group',
  ];

  for (const field of fields) {
    if (existing[field] !== normalized[field]) {
      updates[field] = normalized[field];
    }
  }

  if (!isPlaceholderValue(normalized.homeTeam) && existing.homeTeam !== normalized.homeTeam) {
    updates.homeTeam = normalized.homeTeam;
  }
  if (!isPlaceholderValue(normalized.awayTeam) && existing.awayTeam !== normalized.awayTeam) {
    updates.awayTeam = normalized.awayTeam;
  }
  if (!isPlaceholderValue(normalized.homeTeamCode) && existing.homeTeamCode !== normalized.homeTeamCode) {
    updates.homeTeamCode = normalized.homeTeamCode;
  }
  if (!isPlaceholderValue(normalized.awayTeamCode) && existing.awayTeamCode !== normalized.awayTeamCode) {
    updates.awayTeamCode = normalized.awayTeamCode;
  }

  if (!sameDate(existing.kickoffTime, normalized.kickoffTime)) {
    updates.kickoffTime = normalized.kickoffTime;
  }

  return updates;
}

function clearMatchCaches() {
  cache.upcoming = { data: null, expires: 0, pending: null };
  cache.results = { data: null, expires: 0, pending: null };
}

/**
 * Sync all WC 2026 fixtures from football-data.org into the database.
 * Upserts by externalId — safe to call repeatedly.
 *
 * KEY RESILIENCE RULE:
 *   If the external API is unreachable even after retries, we catch the error
 *   here and log a warning. The database keeps its existing rows intact.
 *   This means the site never goes blank: it always serves whatever the DB has.
 */
async function runSyncMatches() {
  logger.info('[Matches] Starting fixture sync...');

  let rawMatches;
  try {
    rawMatches = await fetchWorldCupMatches();
  } catch (apiErr) {
    logger.warn(
      '[Matches] Sync skipped — API unavailable. Existing DB data is preserved.',
      { error: apiErr.message }
    );
    // Return 0/0 so callers know nothing was written (not an unhandled crash)
    return { created: 0, updated: 0, skipped: true };
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const normalizedMatches = rawMatches.map(normalizeMatch);
  const externalIds = normalizedMatches.map(match => match.externalId);
  const existingMatches = await prisma.match.findMany({
    where: { externalId: { in: externalIds } },
  });
  const existingByExternalId = new Map(
    existingMatches.map(match => [match.externalId, match])
  );

  for (const normalized of normalizedMatches) {
    try {
      const existing = existingByExternalId.get(normalized.externalId);

      if (!existing) {
        const match = await prisma.match.create({ data: normalized });
        // Generate initial odds in the background without blocking the server boot.
        // Stagger generation by 200ms per match to avoid DB pool exhaustion.
        if (match.status === 'SCHEDULED') {
          setTimeout(() => {
            generateAndSaveOdds(match.id).catch(e =>
              logger.warn(`[Matches] Odds generation failed for ${match.id}`, { error: e.message })
            );
          }, created * 200);
        }
        created++;
      } else {
        const updates = buildMatchUpdates(existing, normalized);
        if (Object.keys(updates).length === 0) {
          unchanged++;
          continue;
        }

        // Only update mutable fields — never overwrite oddsLockedAt / settledAt
        await prisma.match.update({
          where: { id: existing.id },
          data: updates,
        });
        updated++;
      }
    } catch (dbErr) {
      // Log row-level error and keep going — don't abort the whole sync
      logger.warn(`[Matches] Failed to upsert match ${normalized.externalId}`, {
        error: dbErr.message,
      });
    }
  }

  if (created > 0 || updated > 0) {
    clearMatchCaches();
  }

  logger.info(`[Matches] Sync complete — ${created} created, ${updated} updated, ${unchanged} unchanged`);

  if (created > 0 || updated > 0) {
    try {
      logger.info('[Matches] Running settlement check after sync...');
      await runSettlement();
    } catch (err) {
      logger.error('[Matches] Settlement after match sync failed', { error: err.message });
    }
  }

  return { created, updated, unchanged, skipped: false };
}

async function syncMatches({ force = false } = {}) {
  if (syncInFlight) {
    logger.info('[Matches] Sync already running — reusing in-flight job');
    return syncInFlight;
  }

  const elapsed = Date.now() - lastSyncFinishedAt;
  if (!force && lastSyncFinishedAt && elapsed < MIN_SYNC_INTERVAL_MS) {
    return {
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: true,
      reason: 'recent_sync',
    };
  }

  syncInFlight = runSyncMatches()
    .finally(() => {
      lastSyncFinishedAt = Date.now();
      syncInFlight = null;
    });

  return syncInFlight;
}

async function getAllMatches({ status, page = 1, limit = 20 }) {
  const where = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      orderBy: { kickoffTime: 'asc' },
      skip,
      take: limit,
      include: { odds: { where: { marketType: 'HOME_WIN' }, take: 1 } },
    }),
    prisma.match.count({ where }),
  ]);

  return { matches, total, page, limit, pages: Math.ceil(total / limit) };
}

async function getMatchById(id) {
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      odds: { orderBy: [{ marketType: 'asc' }, { probability: 'desc' }] },
    },
  });
  if (!match) throw Object.assign(new Error('Match not found'), { status: 404 });

  if (match.status === 'SCHEDULED' && match.kickoffTime <= new Date()) {
    match.status = 'LIVE';
  }

  return match;
}

// ─── IN-MEMORY CACHE TO DRASTICALLY SPEED UP FRONTEND ───
const cache = {
  upcoming: { data: null, expires: 0, pending: null },
  results:  { data: null, expires: 0, pending: null }
};
const CACHE_TTL = 60000; // 60 seconds

async function getUpcoming() {
  const now = Date.now();
  if (cache.upcoming.data && cache.upcoming.expires > now) {
    return cache.upcoming.data;
  }
  if (cache.upcoming.pending) {
    return cache.upcoming.pending;
  }

  cache.upcoming.pending = (async () => {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: ['SCHEDULED', 'LIVE'] },
      },
      orderBy: { kickoffTime: 'asc' },
      take: 20,
      include: {
        odds: {
          where: { marketType: { in: ['HOME_WIN', 'DRAW', 'AWAY_WIN'] } },
          orderBy: { marketType: 'asc' },
        },
      },
    });

    const formatted = matches.map(match => {
      // Dynamically override status to LIVE if kickoff time has passed
      if (match.status === 'SCHEDULED' && match.kickoffTime <= new Date()) {
        match.status = 'LIVE';
      }
      return match;
    });

    cache.upcoming.data = formatted;
    cache.upcoming.expires = now + CACHE_TTL;
    return formatted;
  })();

  try {
    return await cache.upcoming.pending;
  } catch (err) {
    if (cache.upcoming.data) {
      logger.warn('[Matches] Returning stale upcoming cache after DB error', { error: err.message });
      return cache.upcoming.data;
    }
    throw err;
  } finally {
    cache.upcoming.pending = null;
  }
}

async function getResults() {
  const now = Date.now();
  if (cache.results.data && cache.results.expires > now) {
    return cache.results.data;
  }
  if (cache.results.pending) {
    return cache.results.pending;
  }

  cache.results.pending = (async () => {
    const results = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      orderBy: { kickoffTime: 'desc' },
      take: 30,
    });

    cache.results.data = results;
    cache.results.expires = now + CACHE_TTL;
    return results;
  })();

  try {
    return await cache.results.pending;
  } catch (err) {
    if (cache.results.data) {
      logger.warn('[Matches] Returning stale results cache after DB error', { error: err.message });
      return cache.results.data;
    }
    throw err;
  } finally {
    cache.results.pending = null;
  }
}

module.exports = { syncMatches, getAllMatches, getMatchById, getUpcoming, getResults };
