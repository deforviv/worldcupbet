import { useSyncExternalStore } from 'react';
import { fetchJsonWithRetry } from '../config/api';

const REFRESH_INTERVAL_MS = 30000;
const UPCOMING_PATH = '/matches/upcoming';
const RESULTS_PATH = '/matches/results';
const CACHE_MS = 60000;

const subscribers = new Set();
let snapshot = {
  upcoming: [],
  results: [],
  loading: true,
  error: null,
  lastUpdated: null,
};
let refreshPromise = null;
let refreshTimer = null;

function notifySubscribers() {
  subscribers.forEach((listener) => listener());
}

async function loadMatches(force = false) {
  if (refreshPromise && !force) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    snapshot = { ...snapshot, loading: true, error: null };
    notifySubscribers();

    try {
      const [upcomingData, resultsData] = await Promise.all([
        fetchJsonWithRetry(UPCOMING_PATH, { timeoutMs: 12000, cacheMs: CACHE_MS }),
        fetchJsonWithRetry(RESULTS_PATH, { timeoutMs: 12000, cacheMs: CACHE_MS }),
      ]);

      snapshot = {
        upcoming: Array.isArray(upcomingData) ? upcomingData : [],
        results: Array.isArray(resultsData) ? resultsData : [],
        loading: false,
        error: null,
        lastUpdated: Date.now(),
      };
    } catch (err) {
      snapshot = {
        ...snapshot,
        loading: false,
        error: err,
      };
    } finally {
      refreshPromise = null;
      notifySubscribers();
    }
  })();

  return refreshPromise;
}

function startPolling() {
  if (refreshTimer) return;
  loadMatches();
  refreshTimer = setInterval(() => loadMatches(), REFRESH_INTERVAL_MS);
}

function stopPolling() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function subscribe(listener) {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    startPolling();
  }

  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      stopPolling();
    }
  };
}

export function useMatchesData() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export async function refreshMatches(force = false) {
  return loadMatches(force);
}
