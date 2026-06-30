import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'worldcupbet_betslip';

function isValidBet(bet) {
  return Boolean(
    bet?.matchId &&
    bet?.oddsId &&
    Number.isFinite(Number(bet.odds)) &&
    Number(bet.odds) > 0
  );
}

function readStoredBets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const valid = parsed.filter(isValidBet);
    if (valid.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

function writeStoredBets(bets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

export function useBetSlip() {
  const [bets, setBets] = useState(readStoredBets);

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = readStoredBets();
      setBets(prev => {
        if (JSON.stringify(prev) === JSON.stringify(stored)) {
          return prev;
        }
        return stored;
      });
    };

    const handleStorageEvent = (e) => {
      if (e.key === STORAGE_KEY) {
        syncFromStorage();
      }
    };

    const handleCustomEvent = () => {
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('betslip:changed', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('betslip:changed', handleCustomEvent);
    };
  }, []);

  useEffect(() => {
    writeStoredBets(bets);
    window.dispatchEvent(new Event('betslip:changed'));
  }, [bets]);

  const addBet = useCallback((bet) => {
    if (!isValidBet(bet)) {
      return false;
    }

    setBets(prev => {
      const exists = prev.find(item => item.id === bet.id);
      return exists
        ? prev.filter(item => item.id !== bet.id)
        : [...prev.filter(item => item.matchId !== bet.matchId), bet];
    });

    return true;
  }, []);

  const removeBet = useCallback((betId) => {
    setBets(prev => prev.filter(item => item.id !== betId));
    return undefined;
  }, []);

  const clearAll = useCallback(() => {
    setBets([]);
  }, []);

  return { bets, addBet, removeBet, clearAll };
}
