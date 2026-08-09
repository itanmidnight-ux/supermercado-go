/* ═══════════════════════════════════════════════════════════════
   API Helper — Admin & Worker Panels
   Robust token management with auto-recovery on 401
   ═══════════════════════════════════════════════════════════════ */
const API = (() => {
  const BASE = window.location.origin + '/api';

  const isWorker = window.location.pathname.includes('/worker');
  const storagePrefix = isWorker ? 'worker' : 'admin';

  let token = localStorage.getItem(`${storagePrefix}_token`) || null;
  let user = null;

  try {
    const u = localStorage.getItem(`${storagePrefix}_user`);
    if (u) user = JSON.parse(u);
  } catch {}

  // Callback when 401 occurs — panels override this to show login screen
  let onAuthError = null;

  function getHeaders() {
    const h = { 'Content-Type': 'application/json' };
    // Always read fresh token from localStorage in case it was refreshed
    const freshToken = localStorage.getItem(`${storagePrefix}_token`);
    if (freshToken) {
      token = freshToken;
    }
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function clearAuth() {
    token = null;
    user = null;
    localStorage.removeItem(`${storagePrefix}_token`);
    localStorage.removeItem(`${storagePrefix}_user`);
  }

  async function request(url, options = {}) {
    const opts = { headers: getHeaders(), ...options };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }
    if (opts.body instanceof FormData) {
      delete opts.headers['Content-Type'];
    }

    const res = await fetch(BASE + url, opts);

    // Handle 401 — token expired or invalid
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      clearAuth();
      if (onAuthError) onAuthError(data.error || 'Sesión expirada');
      const e = new Error(data.error || 'Token de autenticación inválido');
      e.isAuthError = true;
      throw e;
    }

    // Handle 403 — no permissions
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No tiene permisos para esta acción');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de servidor');
    return data;
  }

  return {
    get token() { return token; },
    get user() { return user; },
    get isLogged() { return !!token && !!user; },
    get isWorker() { return isWorker; },

    set onAuthError(fn) { onAuthError = fn; },

    async login(email, password) {
      const res = await request('/auth/login', { method: 'POST', body: { email, password } });

      if (isWorker) {
        if (res.user && res.user.role !== 'worker') {
          throw new Error('Esta cuenta no tiene permisos de repartidor');
        }
      } else {
        if (res.user && res.user.role !== 'admin') {
          throw new Error('Esta cuenta no tiene permisos de administrador');
        }
      }

      token = res.token;
      user = res.user;
      localStorage.setItem(`${storagePrefix}_token`, token);
      localStorage.setItem(`${storagePrefix}_user`, JSON.stringify(user));
      return user;
    },

    logout() {
      clearAuth();
    },

    /**
     * Validate current token by calling /auth/me.
     * Returns true if valid, false if expired/invalid.
     */
    async validateToken() {
      if (!token) return false;
      try {
        await request('/auth/me');
        return true;
      } catch {
        return false;
      }
    },

    get: (url) => request(url),
    post: (url, body) => request(url, { method: 'POST', body }),
    put: (url, body) => request(url, { method: 'PUT', body }),
    delete: (url) => request(url, { method: 'DELETE' }),

    async upload(url, formData) {
      const h = {};
      const freshToken = localStorage.getItem(`${storagePrefix}_token`);
      if (freshToken) {
        token = freshToken;
      }
      if (token) h['Authorization'] = 'Bearer ' + token;
      const res = await fetch(BASE + url, { method: 'POST', headers: h, body: formData });

      if (res.status === 401) {
        clearAuth();
        if (onAuthError) onAuthError('Sesión expirada');
        const e = new Error('Token de autenticación inválido');
        e.isAuthError = true;
        throw e;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de servidor');
      return data;
    }
  };
})();
