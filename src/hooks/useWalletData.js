import { useSyncExternalStore } from 'react';
import { authFetchJson, getAuthToken } from '../config/api';

const CACHE_MS = 15000;

const subscribers = new Set();
let snapshot = {
  walletData: null,
  loading: true,
  error: null,
  lastUpdated: null,
};
let refreshPromise = null;

function notifySubscribers() {
  subscribers.forEach((listener) => listener());
}

async function loadWallet(force = false) {
  if (refreshPromise && !force) {
    return refreshPromise;
  }
  
  if (!getAuthToken()) {
    snapshot = { walletData: null, loading: false, error: null, lastUpdated: Date.now() };
    notifySubscribers();
    return null;
  }

  // If we have a fresh enough cache, don't refetch unless forced
  if (!force && snapshot.lastUpdated && Date.now() - snapshot.lastUpdated < CACHE_MS && !snapshot.error) {
    return snapshot.walletData;
  }

  refreshPromise = (async () => {
    snapshot = { ...snapshot, loading: true, error: null };
    notifySubscribers();

    try {
      const data = await authFetchJson('/wallet', { timeoutMs: 25000 });
      snapshot = {
        walletData: data || null,
        loading: false,
        error: null,
        lastUpdated: Date.now(),
      };
      return data;
    } catch (err) {
      snapshot = {
        ...snapshot,
        loading: false,
        error: err,
      };
      throw err;
    } finally {
      refreshPromise = null;
      notifySubscribers();
    }
  })();

  return refreshPromise;
}

// Global listeners for auth and wallet events
if (typeof window !== 'undefined') {
  window.addEventListener('auth:changed', () => {
    if (!getAuthToken()) {
       snapshot = { walletData: null, loading: false, error: null, lastUpdated: Date.now() };
       notifySubscribers();
    } else {
       loadWallet(true).catch(() => {});
    }
  });
  window.addEventListener('wallet:changed', () => {
    loadWallet(true).catch(() => {});
  });
}

function subscribe(listener) {
  subscribers.add(listener);
  // Fetch immediately if it's the first subscriber and we have auth
  if (subscribers.size === 1 && getAuthToken()) {
    setTimeout(() => {
      loadWallet().catch(() => {});
    }, 0);
  }
  return () => {
    subscribers.delete(listener);
  };
}

export function useWalletData() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export async function refreshWalletData(force = true) {
  return loadWallet(force);
}
