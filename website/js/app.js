/* ════════════════════════════════════════════════════════════════════════════════
   Supermercados Go — Main Application
   SPA Router, API integration, all view renderers
   ════════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── App State ─────────────────────────────────────────────────────
  let settings = null;
  let currentRoute = '';

  // ─── Category Icon Map ─────────────────────────────────────────────
  const CATEGORY_ICONS = {
    'frutas': { icon: 'fa-apple-whole', bg: '#E8F5E9', color: '#2E7D32' },
    'verduras': { icon: 'fa-carrot', bg: '#E8F5E9', color: '#2E7D32' },
    'frutas y verduras': { icon: 'fa-apple-whole', bg: '#E8F5E9', color: '#2E7D32' },
    'carnes': { icon: 'fa-drumstick-bite', bg: '#FBE9E7', color: '#BF360C' },
    'pollo': { icon: 'fa-drumstick-bite', bg: '#FBE9E7', color: '#BF360C' },
    'carnes y pollo': { icon: 'fa-drumstick-bite', bg: '#FBE9E7', color: '#BF360C' },
    'lacteos': { icon: 'fa-cheese', bg: '#FFF8E1', color: '#F57F17' },
    'huevos': { icon: 'fa-egg', bg: '#FFF8E1', color: '#F57F17' },
    'lacteos y huevos': { icon: 'fa-cheese', bg: '#FFF8E1', color: '#F57F17' },
    'abarrotes': { icon: 'fa-box-open', bg: '#E3F2FD', color: '#1565C0' },
    'bebidas': { icon: 'fa-wine-bottle', bg: '#F3E5F5', color: '#7B1FA2' },
    'panaderia': { icon: 'fa-bread-slice', bg: '#FFF3E0', color: '#E65100' },
    'licores': { icon: 'fa-champagne-glasses', bg: '#FCE4EC', color: '#C62828' },
    'limpieza': { icon: 'fa-spray-can-sparkles', bg: '#E0F7FA', color: '#00838F' },
    'aseo personal': { icon: 'fa-pump-soap', bg: '#E0F7FA', color: '#00838F' },
    'cuidado personal': { icon: 'fa-pump-soap', bg: '#E0F7FA', color: '#00838F' },
    'mascotas': { icon: 'fa-paw', bg: '#F3E5F5', color: '#7B1FA2' },
    'snacks': { icon: 'fa-cookie-bite', bg: '#FFF8E1', color: '#FF8F00' },
    'despensa': { icon: 'fa-jar', bg: '#EFEBE9', color: '#4E342E' },
    'congelados': { icon: 'fa-snowflake', bg: '#E3F2FD', color: '#1565C0' },
  };

  function getCategoryIcon(name) {
    const key = (name || '').toLowerCase();
    return CATEGORY_ICONS[key] || { icon: 'fa-tag', bg: '#F3F4F6', color: '#4B5563' };
  }

  // ─── API Helper ────────────────────────────────────────────────────
  async function api(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (Auth.getToken()) {
      headers['Authorization'] = 'Bearer ' + Auth.getToken();
    }
    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error de servidor');
      }
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('No se pudo conectar al servidor. Verifica tu conexion.');
      }
      throw err;
    }
  }

  // ─── Toast System ──────────────────────────────────────────────────
  function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <i class="fas ${icons[type] || icons.success}"></i>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100px)';
      el.style.transition = 'all 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  // ─── Image Helper ──────────────────────────────────────────────────
  function productImgSrc(image) {
    if (image) {
      if (image.startsWith('http')) return image;
      return '/uploads/' + image;
    }
    return null;
  }

  function productImgHTML(image, size = 'card') {
    const src = productImgSrc(image);
    if (src) {
      return `<img src="${src}" alt="Producto" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'placeholder-img\'><i class=\'fas fa-image\'></i></div>'">`;
    }
    return `<div class="placeholder-img"><i class="fas fa-image"></i></div>`;
  }

  // ─── Money Formatter ───────────────────────────────────────────────
  function money(amount) {
    return '$' + Math.round(amount).toLocaleString('es-CO');
  }

  // ─── Date Formatter ────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ─── Status Labels ─────────────────────────────────────────────────
  const STATUS_LABELS = {
    pending: { label: 'Pendiente', icon: 'fa-clock' },
    confirmed: { label: 'Confirmado', icon: 'fa-check' },
    preparing: { label: 'Preparando', icon: 'fa-blender' },
    ready: { label: 'Listo', icon: 'fa-box' },
    assigned: { label: 'Asignado', icon: 'fa-motorcycle' },
    in_transit: { label: 'En camino', icon: 'fa-shipping-fast' },
    delivered: { label: 'Entregado', icon: 'fa-check-double' },
    picked_up: { label: 'Recogido', icon: 'fa-hand-holding' },
    cancelled: { label: 'Cancelado', icon: 'fa-times-circle' },
  };

  function statusChip(status) {
    const s = STATUS_LABELS[status] || { label: status, icon: 'fa-question' };
    return `<span class="status-chip ${status}"><i class="fas ${s.icon}"></i> ${s.label}</span>`;
  }

  // ─── Unit Labels ───────────────────────────────────────────────────
  function unitLabel(unit) {
    const map = { un: 'un', lb: 'lb', kg: 'kg', g: 'g', lt: 'lt', ml: 'ml', pz: 'pz', doc: 'doc' };
    return map[unit] || unit || 'un';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ROUTER
  // ═══════════════════════════════════════════════════════════════════

  function router() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');
    const loader = document.getElementById('initialLoader');
    if (loader) loader.remove();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Close mobile nav
    closeMobileNav();

    if (hash === '#/' || hash === '#' || hash === '') {
      Views.renderHome(app);
    } else if (hash.startsWith('#/productos')) {
      Views.renderProducts(app);
    } else if (hash.startsWith('#/producto/')) {
      const id = hash.replace('#/producto/', '');
      Views.renderProductDetail(app, id);
    } else if (hash === '#/carrito') {
      Views.renderCart(app);
    } else if (hash === '#/checkout') {
      Views.renderCheckout(app);
    } else if (hash === '#/ingresar' || hash === '#/registro') {
      Views.renderAuthPage(app);
    } else if (hash === '#/mis-pedidos') {
      Views.renderOrders(app);
    } else if (hash === '#/ayuda') {
      Views.renderHelp(app);
    } else if (hash === '#/zona-entrega') {
      Views.renderDeliveryZone(app);
    } else if (hash === '#/acerca') {
      Views.renderAbout(app);
    } else if (hash === '#/favoritos') {
      Views.renderFavorites(app);
    } else if (hash === '#/notificaciones') {
      Views.renderNotifications(app);
    } else {
      Views.renderHome(app);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI UTILITIES
  // ═══════════════════════════════════════════════════════════════════

  // Mobile Nav
  function openMobileNav() {
    document.getElementById('mobileNav').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileNav() {
    const nav = document.getElementById('mobileNav');
    if (nav) {
      nav.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Header scroll effect
  function setupHeaderScroll() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const header = document.getElementById('header');
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // Search form
  function setupSearch() {
    const form = document.getElementById('searchForm');
    const input = document.getElementById('searchInput');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        window.location.hash = '#/productos?q=' + encodeURIComponent(q);
      }
    });
  }

  // Cart toggle (mobile)
  function setupCartToggle() {
    document.getElementById('cartToggle').addEventListener('click', () => {
      window.location.hash = '#/carrito';
    });
  }

  // Auth toggle
  function setupAuthToggle() {
    document.getElementById('authToggle').addEventListener('click', () => {
      if (Auth.isLogged()) {
        Views.openAuthModal('login'); // Could show profile, but for now just show that they're logged in
        // Actually let's show a quick profile menu or just redirect to orders
        if (confirm(`Hola, ${Auth.getUser().name}. Deseas cerrar sesion?`)) {
          Auth.logout();
          toast('Sesion cerrada');
          router();
        }
      } else {
        Views.openAuthModal('login');
      }
    });
  }

  // Modal close handlers
  function setupModals() {
    document.getElementById('authModalOverlay').addEventListener('click', Views.closeAuthModal);
    document.getElementById('authModalClose').addEventListener('click', Views.closeAuthModal);
    document.getElementById('orderModalOverlay').addEventListener('click', Views.closeOrderModal);
    document.getElementById('orderModalClose').addEventListener('click', Views.closeOrderModal);
  }

  // Mobile nav handlers
  function setupMobileNav() {
    document.getElementById('hamburgerBtn').addEventListener('click', openMobileNav);
    document.getElementById('mobileNavOverlay').addEventListener('click', closeMobileNav);
    document.getElementById('mobileNavClose').addEventListener('click', closeMobileNav);

    document.getElementById('mobileAuthBtn').addEventListener('click', () => {
      closeMobileNav();
      Views.openAuthModal('login');
    });
    document.getElementById('mobileLogoutBtn').addEventListener('click', () => {
      Auth.logout();
      closeMobileNav();
      toast('Sesion cerrada');
      router();
    });

    // Close mobile nav on link click
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', closeMobileNav);
    });
  }

  // Footer year
  function setupFooter() {
    const yearEl = document.getElementById('footerYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Update footer with settings
    if (settings) {
      const phone = document.getElementById('footerPhone');
      const email = document.getElementById('footerEmail');
      const addr = document.getElementById('footerAddress');
      if (phone) phone.textContent = settings.business_phone || phone.textContent;
      if (email) email.textContent = settings.business_email || email.textContent;
      if (addr) addr.textContent = `${settings.business_city || 'Cucuta'}, ${settings.business_department || 'N. de Santander'}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PUBLIC API (for inline event handlers in HTML)
  // ═══════════════════════════════════════════════════════════════════
  window.App = {
    redirectToProduct(id) {
      window.location.hash = '#/producto/' + id;
    },
    api,
    toast,
    money,
    formatDate,
    statusChip,
    unitLabel,
    productImgHTML,
    getCategoryIcon,
    get settings() { return settings; },
    router,
  };

  // ═══════════════════════════════════════════════════════════════════
  //  INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  async function init() {
    // Load public settings
    try {
      const res = await api('/api/settings/public');
      settings = res.data || null;
      setupFooter();
    } catch {
      settings = null;
    }

    // Verify auth token
    if (Auth.isLogged()) {
      await Auth.fetchProfile();
    }

    await Favorites.load();
    Favorites.onChange(() => {
      // Re-renderizar la vista actual si el usuario está mirando el catálogo o favoritos,
      // para que el corazón se actualice en toda la página, no solo en el botón clickeado.
    });

    if (Auth.isLogged()) { Notifications.startPolling(); }
    Notifications.onChange(({ unreadCount }) => {
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }
    });

    // Setup UI
    setupHeaderScroll();
    setupSearch();
    setupCartToggle();
    setupAuthToggle();
    setupModals();
    setupMobileNav();
    Cart.onChange(() => updateBadges());
    Auth.onChange(() => {
      if (Auth.isLogged()) { Notifications.startPolling(); } else { Notifications.stopPolling(); }
      router();
    });

    // Initial route
    router();

    // Listen for hash changes
    window.addEventListener('hashchange', router);
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Make Cart formatPrice available
  function updateBadges() {
    const count = Cart.getCount();
    const badge = document.getElementById('cartBadge');
    const floatingCart = document.getElementById('floatingCart');
    const floatingCount = document.getElementById('floatingCartCount');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    if (floatingCart) floatingCart.style.display = count > 0 ? 'block' : 'none';
    if (floatingCount) floatingCount.textContent = count;
  }

})();
