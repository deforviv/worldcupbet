const DEFAULT_API_PORT = 3001;
const responseCache = new Map();
const pendingRequests = new Map();

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? '/api'
    : `${window.location.protocol}//${window.location.hostname || 'localhost'}:${DEFAULT_API_PORT}/api`);

export function getAuthToken() {
  return localStorage.getItem('token') || localStorage.getItem('accessToken');
}

export function getStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(data) {
  const token = data?.accessToken || data?.token;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('accessToken', token);
  }
  if (data?.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  if (data?.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  window.dispatchEvent(new Event('auth:changed'));
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth:changed'));
}

export async function fetchJson(path, { timeoutMs = 12000, cacheMs = 5000 } = {}) {
  const cached = responseCache.get(path);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const pending = pendingRequests.get(path);
  if (pending) {
    return pending;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const request = (async () => {
    try {
      const res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (cacheMs > 0) {
        responseCache.set(path, { data, expires: Date.now() + cacheMs });
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error('La requête a expiré. Vérifiez votre connexion et réessayez.');
        timeoutError.name = 'AbortError';
        throw timeoutError;
      }
      throw err;
    }
  })();

  pendingRequests.set(path, request);

  try {
    return await request;
  } finally {
    clearTimeout(timeoutId);
    pendingRequests.delete(path);
  }
}

export async function fetchJsonWithRetry(path, options = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 650;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJson(path, options);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function authFetchJson(path, {
  method = 'GET',
  body,
  timeoutMs = 12000,
  headers = {},
} = {}) {
  const token = getAuthToken();
  if (!token) {
    const err = new Error('Authentification requise');
    err.status = 401;
    throw err;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const finalHeaders = {
      Authorization: `Bearer ${token}`,
      ...headers,
    };
    if (!isFormData) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: finalHeaders,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Réponse serveur invalide. Réessayez dans un instant.');
      }
    }

    if (!res.ok) {
      let message = data?.error || `Server returned ${res.status}`;
      if (data?.details && typeof data.details === 'object') {
        const firstDetail = Object.values(data.details).flat().find(Boolean);
        if (firstDetail) message = firstDetail;
      }
      const err = new Error(message);
      err.status = res.status;
      if (res.status === 401) {
        clearAuthSession();
      }
      throw err;
    }

    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutError = new Error('La requête a expiré. Vérifiez votre connexion et réessayez.');
      timeoutError.name = 'AbortError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
