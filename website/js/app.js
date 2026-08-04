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
      renderHelp(app);
    } else if (hash === '#/zona-entrega') {
      renderDeliveryZone(app);
    } else if (hash === '#/acerca') {
      renderAbout(app);
    } else {
      Views.renderHome(app);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELP VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderHelp(container) {
    const phone = settings ? settings.business_phone : '+573044016277';
    const email = settings ? settings.business_email : 'carrierjawerly@gmail.com';
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const address = settings ? settings.business_address : 'Cucuta, N. de Santander';

    const faqs = [
      { q: 'Como hago un pedido?', a: 'Explora nuestros productos, agrega los que necesites al carrito y finaliza tu compra eligiendo tipo de entrega y metodo de pago.' },
      { q: 'Cual es la tarifa de envio?', a: `La tarifa de envio es de ${money(settings ? settings.delivery_fee : 4900)}. En pedidos mayores a ${money(settings ? settings.free_delivery_min : 50000)} el envio es completamente gratis.` },
      { q: 'En que zona hacen entregas?', a: 'Realizamos entregas en toda la ciudad de Cucuta y zona metropolitana. Consulta nuestra zona de entrega para mas detalles.' },
      { q: 'Cuales son los metodos de pago?', a: 'Aceptamos efectivo, Nequi, Daviplata y tarjeta. El pago se realiza al momento de la entrega o recogida.' },
      { q: 'Puedo recoger mi pedido?', a: 'Si! Puedes elegir la opcion de recogida en tienda. Recibiras un codigo que debes presentar al llegar.' },
      { q: 'Como cancelo un pedido?', a: 'Puedes cancelar tu pedido desde la seccion "Mis Pedidos" siempre que este en estado pendiente o confirmado. El stock se restituye automaticamente.' },
      { q: 'Que horario tienen?', a: `Nuestro horario de atencion es ${hours}. Los pedidos se procesan dentro de este horario.` },
      { q: 'Los productos pesados como se venden?', a: 'Los productos pesados (frutas, verduras, carnes) se venden por libra (lb). El precio que ves es por cada libra.' },
    ];

    container.innerHTML = `
      <div class="help-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-life-ring" style="color:var(--green);"></i> Centro de Ayuda</h1>
          <p>Encuentra respuestas a las preguntas mas frecuentes</p>
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:16px;">Preguntas Frecuentes</h3>
        <div id="faqContainer">
          ${faqs.map((faq, i) => `
            <div class="faq-item" data-faq="${i}">
              <button class="faq-question" onclick="this.closest('.faq-item').classList.toggle('open')">
                <span>${faq.q}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div class="faq-answer"><p>${faq.a}</p></div>
            </div>
          `).join('')}
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-top:32px;margin-bottom:16px;">Contacto</h3>
        <div class="contact-cards">
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--green-light);color:var(--green);"><i class="fab fa-whatsapp"></i></div>
            <div class="contact-card-info">
              <h4>WhatsApp</h4>
              <p>${phone}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--orange-light);color:var(--orange);"><i class="fas fa-phone"></i></div>
            <div class="contact-card-info">
              <h4>Telefono</h4>
              <p>${phone}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--blue-light);color:var(--blue);"><i class="fas fa-envelope"></i></div>
            <div class="contact-card-info">
              <h4>Correo Electronico</h4>
              <p>${email}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--gray-100);color:var(--gray-600);"><i class="fas fa-map-marker-alt"></i></div>
            <div class="contact-card-info">
              <h4>Direccion</h4>
              <p>${address}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELIVERY ZONE VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderDeliveryZone(container) {
    const zone = settings ? settings.operating_zone : 'Cucuta';
    const fee = settings ? settings.delivery_fee : 4900;
    const freeMin = settings ? settings.free_delivery_min : 50000;
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const address = settings ? settings.business_address : 'KDX 1-2B Los Mangos';

    const neighborhoods = [
      'Centro', 'El Bosque', 'Los Mangos', 'La Playa', 'San Luis',
      'Colombia', 'Garcia Rovira', 'Villa del Rosario', 'Alto de Caicedo',
      'Santa Rosa', 'Sur Occidente', 'Norte', 'Oriental',
      'La Esmeralda', 'El Progreso', '7 de Agosto', 'San Jose',
    ];

    container.innerHTML = `
      <div class="zone-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-map-marker-alt" style="color:var(--orange);"></i> Zona de Entrega</h1>
          <p>Cobrimos toda la ciudad de ${zone}</p>
        </div>

        <div class="zone-map-container">
          <i class="fas fa-map-marked-alt"></i>
          <span style="font-weight:600;">Mapa de cobertura - ${zone}</span>
          <span style="font-size:13px;">Entregamos a toda la ciudad y zona metropolitana</span>
        </div>

        <div class="zone-info-card mb-3">
          <h3><i class="fas fa-truck" style="margin-right:8px;"></i>Informacion de Entrega</h3>
          <div style="text-align:left;margin-top:16px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Ciudad</span>
              <strong>${zone}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Tarifa de envio</span>
              <strong>${money(fee)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Envio gratis desde</span>
              <strong style="color:var(--green);">${money(freeMin)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Horario</span>
              <strong>${hours}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;">
              <span style="color:var(--gray-600);">Tiempo estimado</span>
              <strong>30-60 minutos</strong>
            </div>
          </div>
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:16px;">Barrios que Cubrimos</h3>
        <div class="zone-neighborhoods">
          ${neighborhoods.map(n => `
            <div class="zone-neighborhood"><i class="fas fa-check-circle"></i> ${n}</div>
          `).join('')}
        </div>

        <div class="about-card mt-3">
          <h3><i class="fas fa-store"></i> Punto de Recogida</h3>
          <p><i class="fas fa-map-marker-alt" style="color:var(--orange);margin-right:6px;"></i> ${address}</p>
          <p style="margin-top:8px;">Si prefieres recoger tu pedido, puedes pasar por nuestra tienda en el horario de atencion.</p>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="#/productos" class="btn btn-primary btn-lg" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Hacer un Pedido</a>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ABOUT VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderAbout(container) {
    const name = settings ? settings.business_name : 'Supermercados Go';
    const phone = settings ? settings.business_phone : '+573044016277';
    const email = settings ? settings.business_email : 'carrierjawerly@gmail.com';
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const city = settings ? settings.business_city : 'Cucuta';
    const dept = settings ? settings.business_department : 'Norte de Santander';
    const address = settings ? settings.business_address : 'KDX 1-2B Los Mangos';

    container.innerHTML = `
      <div class="about-page">
        <div class="about-hero">
          <i class="fas fa-shopping-basket"></i>
          <h1>${name}</h1>
          <p>Tu supermercado de confianza en ${city}, ${dept}</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-heart"></i> Nuestra Mision</h3>
          <p>Llevar los mejores productos de supermercado hasta la puerta de tu hogar, con la mayor facilidad, rapidez y al mejor precio. Queremos que comprar los alimentos de tu familia sea una experiencia comoda y placentera.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-clock"></i> Horario de Atencion</h3>
          <p><strong>${hours}</strong> - Lunes a Sabado</p>
          <p style="margin-top:4px;">Realizamos entregas dentro de este horario. Los pedidos realizados fuera de horario se procesaran el siguiente dia habil.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-truck"></i> Servicio de Domicilios</h3>
          <p>Ofrecemos servicio de entrega a domicilio en toda la ciudad de ${city}. Contamos con repartidores confiables que llevan tus productos con cuidado y en el menor tiempo posible. Tambien ofrecemos la opcion de recogida en tienda para quienes prefieren pasar a buscar su pedido.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-shield-alt"></i> Calidad Garantizada</h3>
          <p>Seleccionamos cuidadosamente cada producto que ofrecemos. Trabajamos con proveedores de confianza para asegurar la frescura y calidad de frutas, verduras, carnes y todos los productos de nuestra tienda. Si no estas satisfecho, comunicate con nosotros.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-map-marker-alt"></i> Ubicacion</h3>
          <p>${address}<br>${city}, ${dept}</p>
          <div style="margin-top:12px;">
            <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="btn btn-primary btn-sm" style="border-radius:var(--radius-full);margin-right:8px;"><i class="fas fa-phone"></i> Llamar</a>
            <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline btn-sm" style="border-radius:var(--radius-full);color:var(--green);border-color:var(--green);"><i class="fab fa-whatsapp"></i> WhatsApp</a>
          </div>
        </div>
      </div>
    `;
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

    // Setup UI
    setupHeaderScroll();
    setupSearch();
    setupCartToggle();
    setupAuthToggle();
    setupModals();
    setupMobileNav();
    Cart.onChange(() => updateBadges());

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
