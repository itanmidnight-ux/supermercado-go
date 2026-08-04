/* ════════════════════════════════════════════════════════════════════════════════
   Supermercados Go — Auth Module
   Handles login, register, token management, and user state
   ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Auth = (() => {
  const TOKEN_KEY = 'sg_token';
  const USER_KEY = 'sg_user';

  let user = null;
  let token = null;
  let listeners = [];

  // ─── Load from localStorage ───────────────────────────────────────
  function load() {
    try {
      token = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      user = raw ? JSON.parse(raw) : null;
    } catch {
      token = null;
      user = null;
    }
  }

  // ─── Save to localStorage ─────────────────────────────────────────
  function save() {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    notifyListeners();
    updateUI();
  }

  // ─── Notify listeners ─────────────────────────────────────────────
  function notifyListeners() {
    listeners.forEach(fn => fn({ user, token }));
  }

  // ─── Update UI elements based on auth state ───────────────────────
  function updateUI() {
    const authLabel = document.getElementById('authLabel');
    const ordersBtn = document.getElementById('ordersBtn');
    const mobileOrdersLink = document.getElementById('mobileOrdersLink');
    const mobileNavUser = document.getElementById('mobileNavUser');
    const mobileNavUserName = document.getElementById('mobileNavUserName');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    if (isLogged()) {
      if (authLabel) authLabel.textContent = user.name ? user.name.split(' ')[0] : 'Cuenta';
      if (ordersBtn) ordersBtn.style.display = 'flex';
      if (mobileOrdersLink) mobileOrdersLink.style.display = 'flex';
      if (mobileNavUser) mobileNavUser.style.display = 'flex';
      if (mobileNavUserName) mobileNavUserName.textContent = user.name || 'Usuario';
      if (mobileAuthBtn) mobileAuthBtn.style.display = 'none';
      if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'flex';
    } else {
      if (authLabel) authLabel.textContent = 'Ingresar';
      if (ordersBtn) ordersBtn.style.display = 'none';
      if (mobileOrdersLink) mobileOrdersLink.style.display = 'none';
      if (mobileNavUser) mobileNavUser.style.display = 'none';
      if (mobileAuthBtn) mobileAuthBtn.style.display = 'flex';
      if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
    }
  }

  // ─── Check if logged in ───────────────────────────────────────────
  function isLogged() {
    return !!token && !!user;
  }

  // ─── Get user ─────────────────────────────────────────────────────
  function getUser() {
    return user;
  }

  // ─── Get token ────────────────────────────────────────────────────
  function getToken() {
    return token;
  }

  // ─── Login ────────────────────────────────────────────────────────
  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesion');
    }
    token = data.token;
    user = data.user;
    save();
    return data;
  }

  // ─── Register ─────────────────────────────────────────────────────
  async function register(name, email, phone, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al crear la cuenta');
    }
    token = data.token;
    user = data.user;
    save();
    return data;
  }

  // ─── Logout ───────────────────────────────────────────────────────
  function logout() {
    token = null;
    user = null;
    save();
  }

  // ─── Fetch current user profile ───────────────────────────────────
  async function fetchProfile() {
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!res.ok) {
        if (res.status === 401) logout();
        return null;
      }
      const data = await res.json();
      user = data.user;
      save();
      return user;
    } catch {
      return null;
    }
  }

  // ─── Get auth headers ─────────────────────────────────────────────
  function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  // ─── Require auth (redirect or throw) ─────────────────────────────
  function requireAuth() {
    if (!isLogged()) {
      window.location.hash = '#/ingresar';
      return false;
    }
    return true;
  }

  // ─── Subscribe to auth changes ────────────────────────────────────
  function onChange(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(fn => fn !== callback);
    };
  }

  // ─── Initialize ───────────────────────────────────────────────────
  load();
  updateUI();

  return {
    isLogged,
    getUser,
    getToken,
    login,
    register,
    logout,
    fetchProfile,
    getHeaders,
    requireAuth,
    onChange,
    updateUI,
  };
})();
