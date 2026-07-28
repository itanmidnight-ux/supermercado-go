import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/cuenta.css';
import { mountLayout, getToken, setToken, clearToken, authFetch } from './layout';
import { gsap } from './animations';

mountLayout();

// Convención de sesión del sitio: JWT crudo en localStorage['sg_token'],
// enviado como header Authorization: Bearer <token> en requests autenticadas.
// getToken/setToken/clearToken/authFetch viven en layout.ts (única fuente,
// las 3 páginas del sitio que necesitan sesión los importan de ahí -- antes
// cada página tenía su propia copia con comportamiento levemente distinto
// en el manejo de 401).

function redirectAfterAuth(): void {
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect');
  location.href = redirect || 'cuenta.html';
}

// ── Elementos ────────────────────────────────────────────────
const authSection = document.getElementById('cuenta-auth') as HTMLElement;
const profileSection = document.getElementById('cuenta-profile') as HTMLElement;
const authPanels = document.getElementById('auth-panels') as HTMLElement;
const authTabs = document.getElementById('auth-tabs') as HTMLElement;

const loginForm = document.getElementById('login-form') as HTMLFormElement;
const registerForm = document.getElementById('register-form') as HTMLFormElement;
const forgotPanel = document.getElementById('forgot-panel') as HTMLElement;
const forgotRequestForm = document.getElementById('forgot-request-form') as HTMLFormElement;
const forgotResetForm = document.getElementById('forgot-reset-form') as HTMLFormElement;

type PanelName = 'login' | 'register' | 'forgot';

function showPanel(name: PanelName): void {
  const panels: Record<PanelName, HTMLElement> = {
    login: loginForm,
    register: registerForm,
    forgot: forgotPanel,
  };

  const current = Object.values(panels).find((p) => !p.hidden);
  const target = panels[name];
  if (current === target) return;

  authTabs.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
  });

  const swap = (): void => {
    Object.values(panels).forEach((p) => { p.hidden = p !== target; });
    if (target === forgotPanel) {
      forgotRequestForm.hidden = false;
      forgotResetForm.hidden = true;
    }
    gsap.fromTo(target, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  };

  if (current) {
    gsap.to(current, {
      opacity: 0,
      y: -8,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: swap,
    });
  } else {
    swap();
  }
}

authTabs.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => showPanel(tab.dataset.tab as PanelName));
});

authPanels.querySelectorAll<HTMLButtonElement>('[data-tab-goto]').forEach((btn) => {
  btn.addEventListener('click', () => showPanel(btn.dataset.tabGoto as PanelName));
});

function showError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.hidden = false;
}

function hideError(el: HTMLElement): void {
  el.hidden = true;
}

function setBusy(btn: HTMLButtonElement, busy: boolean, idleLabel: string): void {
  btn.disabled = busy;
  btn.textContent = busy ? 'Un momento…' : idleLabel;
}

// ── Login ────────────────────────────────────────────────────
const loginError = document.getElementById('login-error') as HTMLElement;
const loginSubmit = document.getElementById('login-submit') as HTMLButtonElement;

async function doLogin(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Credenciales incorrectas' };
    setToken(data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: 'No pudimos conectar con el servidor. Probá de nuevo.' };
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(loginError);
  const fd = new FormData(loginForm);
  const username = String(fd.get('username') || '').trim();
  const password = String(fd.get('password') || '');

  if (!username || !password) {
    showError(loginError, 'Completá usuario/correo y contraseña.');
    return;
  }

  setBusy(loginSubmit, true, 'Iniciar sesión');
  const result = await doLogin(username, password);
  setBusy(loginSubmit, false, 'Iniciar sesión');

  if (!result.ok) {
    showError(loginError, result.error || 'Credenciales incorrectas');
    return;
  }
  redirectAfterAuth();
});

// ── Registro ─────────────────────────────────────────────────
const registerError = document.getElementById('register-error') as HTMLElement;
const registerSuccess = document.getElementById('register-success') as HTMLElement;
const registerSubmit = document.getElementById('register-submit') as HTMLButtonElement;

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(registerError);
  registerSuccess.hidden = true;

  const fd = new FormData(registerForm);
  const display_name = String(fd.get('display_name') || '').trim();
  const email = String(fd.get('email') || '').trim();
  const phone = String(fd.get('phone') || '').trim();
  const address = String(fd.get('address') || '').trim();
  const password = String(fd.get('password') || '');
  const password2 = String(fd.get('password2') || '');

  if (!display_name || !email || !phone || !address || !password) {
    showError(registerError, 'Completá todos los campos.');
    return;
  }
  if (password.length < 8) {
    showError(registerError, 'La contraseña debe tener mínimo 8 caracteres.');
    return;
  }
  if (password !== password2) {
    showError(registerError, 'Las contraseñas no coinciden.');
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showError(registerError, 'El celular debe tener 10 dígitos (ej: 3138207044).');
    return;
  }

  setBusy(registerSubmit, true, 'Crear cuenta');
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name, email, phone, address, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(registerError, data.error || 'No pudimos crear la cuenta.');
      setBusy(registerSubmit, false, 'Crear cuenta');
      return;
    }

    // El registro no entrega token -- iniciamos sesión con las mismas
    // credenciales para que la experiencia sea "registro -> ya adentro".
    const loginResult = await doLogin(phone, password);
    setBusy(registerSubmit, false, 'Crear cuenta');

    if (loginResult.ok) {
      redirectAfterAuth();
      return;
    }

    registerSuccess.hidden = false;
    registerSuccess.textContent = data.message || 'Cuenta creada. Ya podés iniciar sesión.';
    registerForm.reset();
    setTimeout(() => showPanel('login'), 1200);
  } catch {
    showError(registerError, 'No pudimos conectar con el servidor. Probá de nuevo.');
    setBusy(registerSubmit, false, 'Crear cuenta');
  }
});

// ── Olvidé mi contraseña (OTP por correo) ───────────────────
const forgotRequestError = document.getElementById('forgot-request-error') as HTMLElement;
const forgotRequestSuccess = document.getElementById('forgot-request-success') as HTMLElement;
const forgotRequestSubmit = document.getElementById('forgot-request-submit') as HTMLButtonElement;
const forgotResetError = document.getElementById('forgot-reset-error') as HTMLElement;
const forgotResetSuccess = document.getElementById('forgot-reset-success') as HTMLElement;
const forgotResetSubmit = document.getElementById('forgot-reset-submit') as HTMLButtonElement;

let forgotEmail = '';

forgotRequestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(forgotRequestError);
  forgotRequestSuccess.hidden = true;

  const fd = new FormData(forgotRequestForm);
  const email = String(fd.get('email') || '').trim();
  if (!email) {
    showError(forgotRequestError, 'Ingresá tu correo.');
    return;
  }

  setBusy(forgotRequestSubmit, true, 'Enviar código');
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(forgotRequestSubmit, false, 'Enviar código');
    if (!res.ok) {
      showError(forgotRequestError, data.error || 'No pudimos procesar la solicitud.');
      return;
    }
    forgotEmail = email;
    forgotRequestSuccess.hidden = false;
    forgotRequestSuccess.textContent = data.message || 'Si el correo está registrado, recibirás un código.';
    forgotRequestForm.hidden = true;
    forgotResetForm.hidden = false;
  } catch {
    setBusy(forgotRequestSubmit, false, 'Enviar código');
    showError(forgotRequestError, 'No pudimos conectar con el servidor. Probá de nuevo.');
  }
});

forgotResetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError(forgotResetError);
  forgotResetSuccess.hidden = true;

  const fd = new FormData(forgotResetForm);
  const code = String(fd.get('code') || '').trim();
  const new_password = String(fd.get('new_password') || '');

  if (!/^\d{6}$/.test(code)) {
    showError(forgotResetError, 'El código tiene 6 dígitos.');
    return;
  }
  if (new_password.length < 8) {
    showError(forgotResetError, 'La contraseña debe tener mínimo 8 caracteres.');
    return;
  }

  setBusy(forgotResetSubmit, true, 'Restablecer contraseña');
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail, code, new_password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(forgotResetSubmit, false, 'Restablecer contraseña');
    if (!res.ok) {
      showError(forgotResetError, data.error || 'Código inválido o vencido.');
      return;
    }
    forgotResetSuccess.hidden = false;
    forgotResetSuccess.textContent = data.message || 'Contraseña actualizada.';
    forgotResetForm.reset();
    setTimeout(() => {
      forgotRequestForm.hidden = false;
      forgotResetForm.hidden = true;
      showPanel('login');
    }, 1200);
  } catch {
    showError(forgotResetError, 'No pudimos conectar con el servidor. Probá de nuevo.');
  }
});

// ── Perfil + historial (con sesión) ─────────────────────────
interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
}

interface Order {
  id: number;
  status: string;
  requested_at: string;
  items: OrderItem[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  claimed: 'Asignado',
  en_camino: 'En camino',
  entregado: 'Entregado',
  delivered: 'Entregado',
  cancelado: 'Cancelado',
  cancelled: 'Cancelado',
};

function statusBadgeClass(status: string): string {
  return `badge badge--${status}`;
}

const dateFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

function renderOrders(orders: Order[]): void {
  const list = document.getElementById('orders-list') as HTMLElement;
  const emptyEl = document.getElementById('orders-empty') as HTMLElement;
  list.innerHTML = '';

  if (!orders.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  orders.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'order-card';

    const head = document.createElement('div');
    head.className = 'order-card__head';

    const id = document.createElement('span');
    id.className = 'order-card__id';
    id.textContent = `Pedido #${order.id}`;

    const badge = document.createElement('span');
    badge.className = statusBadgeClass(order.status);
    badge.textContent = STATUS_LABEL[order.status] || order.status;

    head.appendChild(id);
    head.appendChild(badge);

    const date = document.createElement('span');
    date.className = 'order-card__date';
    try {
      date.textContent = dateFmt.format(new Date(order.requested_at));
    } catch {
      date.textContent = order.requested_at;
    }

    const itemsList = document.createElement('ul');
    itemsList.className = 'order-card__items';
    (order.items || []).forEach((it) => {
      const li = document.createElement('li');
      li.textContent = `${it.quantity}x ${it.product_name}`;
      itemsList.appendChild(li);
    });

    const track = document.createElement('a');
    track.className = 'order-card__track';
    track.href = `/producto.html`;
    track.textContent = 'Ver estado del pedido';
    track.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        const res = await authFetch(`/api/orders/${order.id}/track`);
        const data = await res.json().catch(() => ({}));
        alert(data.message || `Estado: ${STATUS_LABEL[data.status] || data.status}`);
      } catch {
        alert('No pudimos consultar el estado del pedido.');
      }
    });

    card.appendChild(head);
    card.appendChild(date);
    card.appendChild(itemsList);
    card.appendChild(track);
    list.appendChild(card);
  });
}

async function loadProfile(): Promise<boolean> {
  try {
    const meRes = await authFetch('/api/users/me');
    if (!meRes.ok) return false;
    const { user } = await meRes.json();

    (document.getElementById('profile-name') as HTMLElement).textContent = user.display_name || user.username;
    (document.getElementById('profile-email') as HTMLElement).textContent = user.email || '—';
    (document.getElementById('profile-phone') as HTMLElement).textContent = user.phone || '—';

    const ordersError = document.getElementById('orders-error') as HTMLElement;
    try {
      const ordersRes = await authFetch('/api/orders/mine');
      if (!ordersRes.ok) throw new Error('bad status');
      const orders: Order[] = await ordersRes.json();
      renderOrders(Array.isArray(orders) ? orders : []);
    } catch {
      ordersError.hidden = false;
    }

    return true;
  } catch {
    return false;
  }
}

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // el logout del backend es best-effort -- el token igual se borra local
  }
  clearToken();
  location.reload();
});

async function init(): Promise<void> {
  if (!getToken()) {
    authSection.hidden = false;
    profileSection.hidden = true;
    return;
  }

  const ok = await loadProfile();
  if (ok) {
    authSection.hidden = true;
    profileSection.hidden = false;
  } else {
    clearToken();
    authSection.hidden = false;
    profileSection.hidden = true;
  }
}

void init();
