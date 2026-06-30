import { useCallback, useEffect, useState } from 'react';
import { authFetchJson, clearAuthSession, getAuthToken, getStoredUser } from '../config/api';

export function useAuthSession() {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [checking, setChecking] = useState(Boolean(getAuthToken()));

  const syncFromStorage = useCallback(() => {
    setToken(getAuthToken());
    setUser(getStoredUser());
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setChecking(false);
      setToken(null);
      setUser(null);
      return null;
    }

    setChecking(true);
    try {
      const data = await authFetchJson('/auth/me', { cacheMs: 0 });
      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      }
      setToken(currentToken);
      return data?.user || null;
    } catch (err) {
      if (err.status === 401) {
        setToken(null);
        setUser(null);
      }
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleChange = () => {
      syncFromStorage();
      if (getAuthToken()) {
        refreshUser();
      } else {
        setChecking(false);
      }
    };

    window.addEventListener('storage', handleChange);
    window.addEventListener('auth:changed', handleChange);
    handleChange();

    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener('auth:changed', handleChange);
    };
  }, [refreshUser, syncFromStorage]);

  return {
    token,
    user,
    checking,
    isAuthenticated: Boolean(token),
    refreshUser,
    logout,
  };
}
