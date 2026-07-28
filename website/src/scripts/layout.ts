/**
 * PATRÓN DE LAYOUT COMPARTIDO — leer antes de crear una página nueva.
 * ────────────────────────────────────────────────────────────────
 * Vite no tiene includes nativos para HTML puro. En vez de hacer fetch()
 * en runtime (request extra + parpadeo de layout + rutas relativas frágiles
 * en build estático), los partials de header/footer se importan como texto
 * crudo AL BUILDEAR usando el sufijo `?raw` de Vite (soportado out-of-the-box,
 * sin plugins). Quedan embebidos en el JS de cada página, sin request HTTP
 * adicional ni problemas de path al servir el sitio bajo un subdirectorio.
 *
 * Cómo replicarlo en una página nueva (ej. catalogo.html / catalogo.ts):
 *
 *   1. En el HTML de la página, dejar dos contenedores vacíos:
 *        <div id="site-header"></div>
 *        ...contenido de la página...
 *        <div id="site-footer"></div>
 *
 *   2. En el script de entrada de esa página (ej. src/scripts/catalogo.ts):
 *        import '../styles/tokens.css';
 *        import '../styles/components.css';
 *        import { mountLayout } from './layout';
 *        mountLayout();
 *
 *   3. mountLayout() inyecta header/footer, pinta el año, trae el contacto
 *      desde /api/settings/public, sincroniza el contador del carrito
 *      (localStorage, clave 'sg_cart') e inicializa scroll suave + reveal.
 *      No hay que repetir nada de esto en cada página.
 */
import headerHtml from '../partials/header.html?raw';
import footerHtml from '../partials/footer.html?raw';
import { initSmoothScroll, initScrollReveal, fadeInUp } from './animations';
import { icon, mountIcons } from './icons';

const CART_KEY = 'sg_cart';
const TOKEN_KEY = 'sg_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * fetch() autenticado compartido -- agrega el Bearer token si hay sesión, y
 * limpia sg_token automáticamente en cualquier 401 (token vencido/revocado).
 * Antes cada página manejaba el 401 a su manera: cuenta.ts limpiaba el
 * token, carrito.ts/producto.ts no -- quedaban con un token inválido
 * persistido hasta que el usuario visitara cuenta.html. Centralizado acá
 * para que las 3 páginas se comporten igual.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) clearToken();
  return res;
}

function mountPartials(): void {
  const headerMount = document.getElementById('site-header');
  const footerMount = document.getElementById('site-footer');

  if (headerMount) headerMount.innerHTML = headerHtml;
  if (footerMount) footerMount.innerHTML = footerHtml;
}

function markActiveLink(): void {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll<HTMLAnchorElement>('.site-header__link').forEach((link) => {
    const href = link.getAttribute('href')?.split('/').pop();
    if (href === path) link.classList.add('is-active');
  });
}

function initMobileMenu(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = document.querySelector<HTMLElement>('.site-header__nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

/**
 * Mega-menu de "Catálogo": en desktop se abre con hover/focus (puro CSS,
 * ver layout.css). En mobile no hay hover, así que el chevron actúa como
 * toggle propio -- separado del link para que tocar el texto siga
 * navegando a catalogo.html normalmente.
 */
function initMegaMenu(): void {
  const wrapper = document.querySelector<HTMLElement>('[data-mega-toggle]');
  const chevron = wrapper?.querySelector<HTMLElement>('[data-mega-chevron]');
  if (!wrapper || !chevron) return;

  chevron.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = wrapper.classList.toggle('is-open');
    chevron.closest('a')?.setAttribute('aria-expanded', String(isOpen));
  });
}

function updateCartCount(): void {
  const el = document.querySelector<HTMLElement>('[data-cart-count]');
  if (!el) return;
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const count = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.qty || 1), 0) : 0;
    el.textContent = String(count);
  } catch {
    el.textContent = '0';
  }
}

function setFooterYear(): void {
  const el = document.querySelector<HTMLElement>('[data-footer-year]');
  if (el) el.textContent = String(new Date().getFullYear());
}

/** Arma el link de WhatsApp desde el teléfono público. Duplica la lógica
 * mínima que ya usa contacto.ts (misma función `waLink`) -- no se importa
 * desde ahí para no acoplar el layout compartido al entry point de una
 * sola página, y es demasiado poco código para justificar un módulo aparte. */
function waLink(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  return `https://wa.me/${digits}`;
}

interface PublicSettings {
  theme_name?: string;
  contact_instagram?: string;
  contact_facebook?: string;
  contact_phone?: string;
}

function fillFooterSocial(settings: PublicSettings): void {
  const el = document.querySelector<HTMLElement>('[data-footer-social]');
  if (!el) return;

  const links: Array<[string, string]> = [];
  if (settings.contact_instagram) links.push(['instagram', settings.contact_instagram]);
  if (settings.contact_facebook) links.push(['facebook', settings.contact_facebook]);
  if (settings.contact_phone) links.push(['whatsapp', waLink(settings.contact_phone)]);

  el.innerHTML = links
    .map(
      ([name, url]) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="site-footer__social-link" aria-label="${name}">${icon(name, 18)}</a>`
    )
    .join('');
}

async function fillFooterContact(): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-footer-contact]');
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings }: { settings: PublicSettings } = await res.json();
    if (el && settings?.theme_name) {
      el.textContent = settings.theme_name;
    }
    fillFooterSocial(settings || {});
  } catch {
    // sin conexión al backend: el footer queda sin línea de contacto ni redes, no rompe la página
  }
}

/** Punto de entrada único: llamar una vez por página, apenas cargue el script. */
export function mountLayout(): void {
  mountPartials();
  mountIcons();
  markActiveLink();
  initMobileMenu();
  initMegaMenu();
  updateCartCount();
  setFooterYear();
  void fillFooterContact();

  initSmoothScroll();

  const header = document.querySelector('.site-header');
  if (header) fadeInUp(header, { y: -20, duration: 0.6 });

  // El resto de los reveals (data-reveal en el contenido de la página)
  // se procesan después de que el DOM esté completo.
  requestAnimationFrame(() => initScrollReveal());

  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) updateCartCount();
  });
}
