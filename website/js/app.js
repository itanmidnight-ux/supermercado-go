/* ════════════════════════════════════════════════════════════════════════════════
   Supermercados Go — Main Application
   SPA Router, API integration, all view renderers
   ════════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── App State ─────────────────────────────────────────────────────
  let settings = null;
  let categories = [];
  let featuredProducts = [];
  let banners = [];
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
      renderHome(app);
    } else if (hash.startsWith('#/productos')) {
      renderProducts(app);
    } else if (hash.startsWith('#/producto/')) {
      const id = hash.replace('#/producto/', '');
      renderProductDetail(app, id);
    } else if (hash === '#/carrito') {
      renderCart(app);
    } else if (hash === '#/checkout') {
      renderCheckout(app);
    } else if (hash === '#/ingresar' || hash === '#/registro') {
      renderAuthPage(app);
    } else if (hash === '#/mis-pedidos') {
      renderOrders(app);
    } else if (hash === '#/ayuda') {
      renderHelp(app);
    } else if (hash === '#/zona-entrega') {
      renderDeliveryZone(app);
    } else if (hash === '#/acerca') {
      renderAbout(app);
    } else {
      renderHome(app);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HOME VIEW
  // ═══════════════════════════════════════════════════════════════════

  async function renderHome(container) {
    const fee = settings ? settings.delivery_fee : 4900;
    const freeMin = settings ? settings.free_delivery_min : 50000;
    const zone = settings ? settings.operating_zone : 'Cuca';

    // Load banners
    let bannerHTML = '';
    try {
      const bRes = await api('/api/banners');
      banners = bRes.banners || [];
      if (banners.length > 0) {
        bannerHTML = `
          <div class="banners-section">
            <div class="banners-carousel">
              ${banners.map(b => `
                <div class="banner-card" style="background:${b.bg_color || '#00B860'}; color:${b.text_color || '#FFF'};"
                     ${b.link_type === 'category' && b.link_value ? `onclick="window.location.hash='#/productos?categoria=${b.link_value}'"` : ''}
                     ${b.link_type === 'url' && b.link_value ? `onclick="window.open('${b.link_value}','_blank')"` : ''}>
                  <div>
                    <div class="banner-title">${b.title || ''}</div>
                    ${b.subtitle ? `<div class="banner-subtitle">${b.subtitle}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    } catch { /* banners optional */ }

    // Load categories
    try {
      const cRes = await api('/api/categories');
      categories = cRes.data || [];
    } catch {
      categories = [];
    }

    // Load featured products (offers first, then some products)
    let productsHTML = '';
    try {
      const pRes = await api('/api/products?limit=10&offer=true');
      featuredProducts = pRes.data || [];
      if (featuredProducts.length === 0) {
        const pRes2 = await api('/api/products?limit=10');
        featuredProducts = pRes2.data || [];
      }
      if (featuredProducts.length > 0) {
        productsHTML = `
          <section class="section">
            <div class="section-header">
              <h2 class="section-title">${featuredProducts[0].is_offer ? 'Ofertas Especiales' : 'Productos Destacados'}</h2>
              <a href="#/productos" class="section-link">Ver todos <i class="fas fa-arrow-right"></i></a>
            </div>
            <div class="products-grid">
              ${featuredProducts.map(p => productCardHTML(p)).join('')}
            </div>
          </section>
        `;
      }
    } catch { /* products optional */ }

    container.innerHTML = `
      <!-- Hero -->
      <section class="hero">
        <div class="container">
          <div>
            <div class="hero-badge"><i class="fas fa-bolt"></i> Envio gratis en pedidos +${money(freeMin)}</div>
            <h1>Tu supermercado,<br>donde vayas</h1>
            <p>Compra productos frescos y de calidad desde tu celular. Recibelo en la puerta de tu casa en ${zone}.</p>
            <div class="hero-actions">
              <a href="#/productos" class="btn btn-hero-primary"><i class="fas fa-shopping-bag"></i> Comprar Ahora</a>
              <a href="#/zona-entrega" class="btn btn-hero-secondary"><i class="fas fa-map-marker-alt"></i> Ver Zona</a>
            </div>
          </div>
          <div class="hero-visual">
            <i class="fas fa-shopping-basket"></i>
          </div>
        </div>
      </section>

      ${bannerHTML}

      <!-- Categories -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title"><i class="fas fa-th-large" style="color:var(--orange);margin-right:8px;"></i>Categorias</h2>
          <a href="#/productos" class="section-link">Explorar <i class="fas fa-arrow-right"></i></a>
        </div>
        <div class="categories-grid">
          ${categories.map(c => {
            const ic = getCategoryIcon(c.name);
            return `
              <div class="category-card" onclick="window.location.hash='#/productos?categoria=${c.id}'">
                <div class="category-icon" style="background:${ic.bg}; color:${ic.color};">
                  <i class="fas ${ic.icon}"></i>
                </div>
                <span class="cat-name">${c.name}</span>
                ${c.product_count ? `<span class="cat-count">${c.product_count} productos</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </section>

      ${productsHTML}

      <!-- How to Buy -->
      <section class="steps-section">
        <div class="container">
          <div class="section-header" style="padding:0;margin-bottom:24px;">
            <h2 class="section-title"><i class="fas fa-list-ol" style="color:var(--green);margin-right:8px;"></i>Como Comprar</h2>
          </div>
          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>Elige Productos</h3>
                <p>Explora nuestras categorias y agrega los productos que necesites a tu carrito.</p>
              </div>
            </div>
            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>Completa tu Pedido</h3>
                <p>Revisa tu carrito, elige tipo de entrega y metodo de pago.</p>
              </div>
            </div>
            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>Recibe en Casa</h3>
                <p>Preparamos tu pedido y te lo llevamos hasta la puerta de tu hogar.</p>
              </div>
            </div>
            <div class="step-card">
              <div class="step-number">4</div>
              <div class="step-content">
                <h3>Disfruta</h3>
                <p>Productos frescos, entrega rapida y la mejor atencion en ${zone}.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Delivery Zone Banner -->
      <section class="section">
        <div class="container">
          <div class="zone-info-card">
            <i class="fas fa-truck"></i>
            <h3>Entregamos en ${zone}</h3>
            <p>Domicilio a toda la ciudad. <strong>Envio gratis</strong> en pedidos mayores a ${money(freeMin)}.</p>
            <p style="font-size:13px; color:var(--gray-500);">Tarifa de envio: ${money(fee)} | Horario: ${settings ? settings.business_hours : '6:00 AM - 6:00 PM'}</p>
            <a href="#/zona-entrega" class="btn btn-primary btn-sm mt-2" style="border-radius:var(--radius-full);"><i class="fas fa-map"></i> Ver Zona de Entrega</a>
          </div>
        </div>
      </section>
    `;

    // Bind add-to-cart buttons
    bindAddToCartButtons(container);
  }

  // ─── Product Card HTML ─────────────────────────────────────────────
  function productCardHTML(p) {
    const inCart = Cart.hasItem(p.id);
    const cartQty = Cart.getQty(p.id);
    const hasOffer = p.is_offer && p.offer_price;
    const displayPrice = hasOffer ? p.offer_price : p.price;
    const stockWarning = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 5;
    const outOfStock = p.stock !== null && p.stock !== undefined && p.stock <= 0;

    return `
      <div class="product-card" data-product-id="${p.id}" onclick="window.location.hash='#/producto/${p.id}'">
        <div class="product-card-img">
          ${productImgHTML(p.image)}
          ${hasOffer ? `<span class="product-offer-badge">OFERTA</span>` : ''}
        </div>
        <div class="product-card-body">
          ${p.brand ? `<div class="product-card-brand">${p.brand}</div>` : ''}
          ${stockWarning && !outOfStock ? `<div class="product-stock-badge"><i class="fas fa-exclamation-triangle"></i> Pocas unidades</div>` : ''}
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-footer">
            <div class="product-price-group">
              <span class="product-price">${money(displayPrice)}</span>
              ${hasOffer ? `<span class="product-price-old">${money(p.price)}</span>` : ''}
            </div>
            ${outOfStock
              ? `<span style="font-size:11px;color:var(--red);font-weight:600;">Agotado</span>`
              : inCart
                ? `<button class="product-add-btn" style="background:var(--orange);" onclick="event.stopPropagation(); App.redirectToProduct('${p.id}')" title="Ir al producto"><i class="fas fa-check"></i></button>`
                : `<button class="product-add-btn add-to-cart-btn" data-product-id="${p.id}" onclick="event.stopPropagation();" title="Agregar al carrito"><i class="fas fa-plus"></i></button>`
            }
          </div>
        </div>
      </div>
    `;
  }

  // ─── Bind Add to Cart Buttons ──────────────────────────────────────
  function bindAddToCartButtons(container) {
    container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const pid = this.dataset.productId;
        try {
          const res = await api('/api/products/' + pid);
          const product = res.data;
          Cart.addItem(product, 1);
          toast(`${product.name} agregado al carrito`);
          // Update button visual
          this.style.background = 'var(--orange)';
          this.innerHTML = '<i class="fas fa-check"></i>';
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PRODUCTS VIEW
  // ═══════════════════════════════════════════════════════════════════

  async function renderProducts(container) {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const categoryId = params.get('categoria') || '';
    const searchQuery = params.get('q') || '';

    // Load categories if not already
    if (categories.length === 0) {
      try {
        const cRes = await api('/api/categories');
        categories = cRes.data || [];
      } catch { /* continue */ }
    }

    container.innerHTML = `
      <div class="page-title-bar">
        <h1>Productos</h1>
        <p>Encuentra todo lo que necesitas para tu hogar</p>
      </div>
      <div class="filters-bar" id="filtersBar">
        <button class="filter-chip ${!categoryId ? 'active' : ''}" data-category="">Todos</button>
        ${categories.map(c => `
          <button class="filter-chip ${categoryId === c.id ? 'active' : ''}" data-category="${c.id}">${c.name}</button>
        `).join('')}
      </div>
      <div class="products-grid" id="productsGrid" style="margin-top:16px;">
        <div style="grid-column:1/-1;text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
      <div id="productsPagination" style="text-align:center;padding:20px;"></div>
    `;

    // Fetch products
    let currentCategory = categoryId;
    let currentPage = 1;
    let currentSearch = searchQuery;
    let totalPages = 1;

    async function fetchProducts() {
      const grid = document.getElementById('productsGrid');
      const pagination = document.getElementById('productsPagination');
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><span class="spinner"></span></div>';
      pagination.innerHTML = '';

      try {
        let url = `/api/products?page=${currentPage}&limit=30`;
        if (currentCategory) url += `&category_id=${currentCategory}`;
        if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

        const res = await api(url);
        const products = res.data || [];
        const pag = res.pagination || {};
        totalPages = pag.pages || 1;

        if (products.length === 0) {
          grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
              <i class="fas fa-search"></i>
              <h2>No se encontraron productos</h2>
              <p>${currentSearch ? 'Intenta con otra busqueda' : 'No hay productos en esta categoria'}</p>
              <a href="#/productos" class="btn btn-outline btn-sm">Ver todos los productos</a>
            </div>
          `;
          return;
        }

        grid.innerHTML = products.map(p => productCardHTML(p)).join('');
        bindAddToCartButtons(grid);

        // Pagination
        if (totalPages > 1) {
          let pagHTML = '<div style="display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;">';
          if (currentPage > 1) {
            pagHTML += `<button class="btn btn-outline btn-sm" id="pagPrev"><i class="fas fa-chevron-left"></i></button>`;
          }
          pagHTML += `<span style="font-size:14px;color:var(--gray-500);">Pagina ${currentPage} de ${totalPages}</span>`;
          if (currentPage < totalPages) {
            pagHTML += `<button class="btn btn-outline btn-sm" id="pagNext"><i class="fas fa-chevron-right"></i></button>`;
          }
          pagHTML += '</div>';
          pagination.innerHTML = pagHTML;

          const prevBtn = document.getElementById('pagPrev');
          const nextBtn = document.getElementById('pagNext');
          if (prevBtn) prevBtn.onclick = () => { currentPage--; fetchProducts(); window.scrollTo({ top: 200, behavior: 'smooth' }); };
          if (nextBtn) nextBtn.onclick = () => { currentPage++; fetchProducts(); window.scrollTo({ top: 200, behavior: 'smooth' }); };
        }
      } catch (err) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;">
            <i class="fas fa-exclamation-triangle"></i>
            <h2>Error al cargar productos</h2>
            <p>${err.message}</p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()"><i class="fas fa-redo"></i> Reintentar</button>
          </div>
        `;
      }
    }

    fetchProducts();

    // Category filter clicks
    document.getElementById('filtersBar').addEventListener('click', function (e) {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      this.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      currentPage = 1;
      fetchProducts();
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PRODUCT DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════

  async function renderProductDetail(container, productId) {
    container.innerHTML = '<div style="text-align:center;padding:60px;"><span class="spinner" style="width:40px;height:40px;border-width:4px;"></span></div>';

    try {
      const res = await api('/api/products/' + productId);
      const p = res.data;
      if (!p) throw new Error('Producto no encontrado');

      const hasOffer = p.is_offer && p.offer_price;
      const displayPrice = hasOffer ? p.offer_price : p.price;
      const outOfStock = p.stock !== null && p.stock !== undefined && p.stock <= 0;
      const lowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 5;
      const inCart = Cart.hasItem(p.id);
      const cartQty = Cart.getQty(p.id);

      let stockClass = 'in-stock';
      let stockText = `Disponible: ${p.stock} ${unitLabel(p.unit)}s`;
      let stockIcon = 'fa-check-circle';
      if (outOfStock) { stockClass = 'out-of-stock'; stockText = 'Agotado'; stockIcon = 'fa-times-circle'; }
      else if (lowStock) { stockClass = 'low-stock'; stockText = `Pocas unidades: ${p.stock} ${unitLabel(p.unit)}s`; stockIcon = 'fa-exclamation-triangle'; }
      else if (p.stock === null || p.stock === undefined) { stockText = 'Disponible'; }

      container.innerHTML = `
        <div class="product-detail">
          <a class="product-detail-back" onclick="history.back()"><i class="fas fa-arrow-left"></i> Volver</a>
          <div class="product-detail-grid">
            <div class="product-detail-image">
              ${productImgHTML(p.image, 'detail')}
            </div>
            <div class="product-detail-info">
              ${p.category_name ? `<span style="font-size:13px;color:var(--green);font-weight:600;"><i class="fas fa-tag"></i> ${p.category_name}</span><br>` : ''}
              <h1>${p.name}</h1>
              ${p.brand ? `<div class="brand-name">Marca: ${p.brand}</div>` : ''}
              ${hasOffer ? `<div class="detail-price-old">Antes: ${money(p.price)}</div>` : ''}
              <div class="detail-price">${money(displayPrice)} <small style="font-size:14px;font-weight:400;color:var(--gray-400);">/ ${unitLabel(p.unit)}</small></div>
              <div class="detail-unit">${p.description ? p.description : 'Producto de calidad'}</div>
              <div class="detail-stock ${stockClass}"><i class="fas ${stockIcon}"></i> ${stockText}</div>
              <p>${p.sku ? `Codigo: ${p.sku}` : ''} ${p.barcode ? `| Barras: ${p.barcode}` : ''}</p>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div class="quantity-selector" id="detailQtySelector">
                  <button class="qty-btn" id="detailQtyMinus"><i class="fas fa-minus"></i></button>
                  <input type="number" class="qty-input" id="detailQtyInput" value="${inCart ? cartQty : 1}" min="1" ${p.stock ? `max="${p.stock}"` : ''}>
                  <button class="qty-btn" id="detailQtyPlus"><i class="fas fa-plus"></i></button>
                </div>
                <span style="font-size:14px;color:var(--gray-500);" id="detailSubtotal">Subtotal: ${money(displayPrice * (inCart ? cartQty : 1))}</span>
              </div>
              <div class="detail-actions">
                ${outOfStock
                  ? `<button class="btn btn-outline btn-lg btn-block" disabled><i class="fas fa-ban"></i> Producto Agotado</button>`
                  : inCart
                    ? `<button class="btn btn-orange btn-lg" id="detailUpdateCart" style="flex:2;"><i class="fas fa-cart-plus"></i> Actualizar Carrito (${cartQty})</button>`
                    : `<button class="btn btn-primary btn-lg" id="detailAddCart" style="flex:2;"><i class="fas fa-cart-plus"></i> Agregar al Carrito</button>`
                }
                <a href="#/carrito" class="btn btn-outline btn-lg" id="detailGoCart" ${!inCart ? 'style="display:none;"' : ''}><i class="fas fa-shopping-cart"></i></a>
              </div>
            </div>
          </div>
        </div>
      `;

      // Quantity controls
      const qtyInput = document.getElementById('detailQtyInput');
      const qtyMinus = document.getElementById('detailQtyMinus');
      const qtyPlus = document.getElementById('detailQtyPlus');
      const subtotal = document.getElementById('detailSubtotal');

      function updateDetailQty() {
        let val = parseInt(qtyInput.value) || 1;
        if (p.stock && val > p.stock) val = p.stock;
        if (val < 1) val = 1;
        qtyInput.value = val;
        subtotal.textContent = `Subtotal: ${money(displayPrice * val)}`;
      }

      qtyInput.addEventListener('input', updateDetailQty);
      qtyMinus.addEventListener('click', () => { qtyInput.value = (parseInt(qtyInput.value) || 1) - 1; updateDetailQty(); });
      qtyPlus.addEventListener('click', () => { qtyInput.value = (parseInt(qtyInput.value) || 1) + 1; updateDetailQty(); });

      // Add to cart
      const addBtn = document.getElementById('detailAddCart');
      const updateBtn = document.getElementById('detailUpdateCart');

      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const qty = parseInt(qtyInput.value) || 1;
          Cart.addItem(p, qty);
          toast(`${p.name} agregado al carrito`);
          addBtn.style.display = 'none';
          updateBtn.style.display = 'flex';
          updateBtn.innerHTML = `<i class="fas fa-cart-plus"></i> Actualizar Carrito (${qty})`;
          document.getElementById('detailGoCart').style.display = 'flex';
        });
      }

      if (updateBtn) {
        updateBtn.addEventListener('click', () => {
          const qty = parseInt(qtyInput.value) || 1;
          Cart.setQty(p.id, qty);
          toast(`Cantidad actualizada a ${qty}`);
          updateBtn.innerHTML = `<i class="fas fa-cart-plus"></i> Actualizar Carrito (${qty})`;
        });
      }

    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h2>Error</h2>
          <p>${err.message}</p>
          <a href="#/productos" class="btn btn-primary btn-sm"><i class="fas fa-arrow-left"></i> Volver a Productos</a>
        </div>
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CART VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderCart(container) {
    const items = Cart.getItems();
    const fee = settings ? settings.delivery_fee : 4900;
    const freeMin = settings ? settings.free_delivery_min : 50000;
    const subtotal = Cart.getSubtotal();
    const deliveryFee = Cart.getDeliveryFee(freeMin, fee);
    const total = subtotal + deliveryFee;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="cart-page">
          <div class="page-title-bar"><h1>Mi Carrito</h1></div>
          <div class="cart-empty">
            <i class="fas fa-shopping-cart"></i>
            <h2>Tu carrito esta vacio</h2>
            <p>Agrega productos para comenzar tu compra</p>
            <a href="#/productos" class="btn btn-primary btn-lg" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ir a Productos</a>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="cart-page">
        <div class="page-title-bar">
          <h1>Mi Carrito <span style="font-size:16px;color:var(--gray-400);font-weight:400;">(${Cart.getCount()} items)</span></h1>
        </div>
        <div class="cart-items-list" id="cartItemsList">
          ${items.map(item => `
            <div class="cart-item" data-cart-id="${item.product_id}">
              <div class="cart-item-img">
                ${productImgHTML(item.image)}
              </div>
              <div class="cart-item-info">
                <div class="cart-item-name" title="${item.name}">${item.name}</div>
                <div class="cart-item-unit">${item.brand ? item.brand + ' · ' : ''}${money(item.price)} / ${unitLabel(item.unit)}</div>
                <div class="cart-item-bottom">
                  <div class="cart-qty-selector">
                    <button class="cart-qty-btn cart-dec" data-id="${item.product_id}"><i class="fas fa-minus"></i></button>
                    <span class="cart-qty-val">${item.qty}</span>
                    <button class="cart-qty-btn cart-inc" data-id="${item.product_id}"><i class="fas fa-plus"></i></button>
                  </div>
                  <span class="cart-item-price">${money(item.price * item.qty)}</span>
                </div>
              </div>
              <button class="cart-item-remove" data-id="${item.product_id}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="cart-summary-bar" id="cartSummaryBar">
        <div class="cart-summary-inner">
          <div class="cart-summary-totals">
            <span class="cart-summary-subtotal">Subtotal: ${money(subtotal)} ${deliveryFee === 0 ? '<span class="status-chip delivered" style="font-size:10px;padding:1px 6px;margin-left:6px;">ENVIO GRATIS</span>' : `+ Envio: ${money(deliveryFee)}`}</span>
            <span class="cart-summary-total">${money(total)} <small>COP</small></span>
          </div>
          <a href="#/checkout" class="btn btn-primary btn-lg" style="border-radius:var(--radius-full);white-space:nowrap;"><i class="fas fa-lock"></i> Ir a Pagar</a>
        </div>
      </div>
    `;

    // Bind cart item buttons
    document.querySelectorAll('.cart-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        Cart.decrement(btn.dataset.id);
        renderCart(container);
      });
    });
    document.querySelectorAll('.cart-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        Cart.increment(btn.dataset.id);
        renderCart(container);
      });
    });
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        Cart.removeItem(btn.dataset.id);
        toast('Producto eliminado del carrito', 'warning');
        renderCart(container);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CHECKOUT VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderCheckout(container) {
    const items = Cart.getItems();
    if (items.length === 0) {
      window.location.hash = '#/carrito';
      return;
    }
    if (!Auth.requireAuth()) return;

    const fee = settings ? settings.delivery_fee : 4900;
    const freeMin = settings ? settings.free_delivery_min : 50000;
    const user = Auth.getUser();

    container.innerHTML = `
      <div class="checkout-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-lock" style="color:var(--green);"></i> Finalizar Compra</h1>
        </div>
        <div class="checkout-grid">
          <!-- Left Column -->
          <div>
            <!-- Delivery Type -->
            <div class="checkout-card mb-2">
              <h3><i class="fas fa-truck"></i> Tipo de Entrega</h3>
              <div class="option-grid" id="fulfillmentOptions">
                <label class="option-card selected" data-value="delivery">
                  <input type="radio" name="fulfillment_type" value="delivery" checked>
                  <i class="fas fa-motorcycle"></i>
                  <span class="option-label">Domicilio</span>
                </label>
                <label class="option-card" data-value="pickup">
                  <input type="radio" name="fulfillment_type" value="pickup">
                  <i class="fas fa-store"></i>
                  <span class="option-label">Recogida</span>
                </label>
              </div>
            </div>

            <!-- Address (for delivery) -->
            <div class="checkout-card mb-2" id="addressCard">
              <h3><i class="fas fa-map-marker-alt"></i> Direccion de Entrega</h3>
              <div class="form-group">
                <label class="form-label">Direccion completa *</label>
                <input type="text" class="form-input" id="checkoutAddress" placeholder="Ej: Cra 5 # 12-34, Barrio Centro" value="">
                <div class="form-error">La direccion es obligatoria</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                  <label class="form-label">Barrio</label>
                  <input type="text" class="form-input" id="checkoutNeighborhood" placeholder="Ej: Centro">
                </div>
                <div class="form-group">
                  <label class="form-label">Referencia</label>
                  <input type="text" class="form-input" id="checkoutRef" placeholder="Ej: Frente al parque">
                </div>
              </div>
            </div>

            <!-- Payment Method -->
            <div class="checkout-card mb-2">
              <h3><i class="fas fa-credit-card"></i> Metodo de Pago</h3>
              <div class="payment-grid" id="paymentOptions">
                <label class="payment-card selected" data-value="efectivo">
                  <input type="radio" name="payment_method" value="efectivo" checked>
                  <i class="fas fa-money-bill-wave" style="color:var(--green);"></i>
                  <span class="payment-label">Efectivo</span>
                </label>
                <label class="payment-card" data-value="nequi">
                  <input type="radio" name="payment_method" value="nequi">
                  <i class="fas fa-mobile-alt" style="color:#7B1FA2;"></i>
                  <span class="payment-label">Nequi</span>
                </label>
                <label class="payment-card" data-value="daviplata">
                  <input type="radio" name="payment_method" value="daviplata">
                  <i class="fas fa-wallet" style="color:#E53935;"></i>
                  <span class="payment-label">Daviplata</span>
                </label>
                <label class="payment-card" data-value="tarjeta">
                  <input type="radio" name="payment_method" value="tarjeta">
                  <i class="fas fa-credit-card" style="color:#1565C0;"></i>
                  <span class="payment-label">Tarjeta</span>
                </label>
              </div>
            </div>

            <!-- Notes -->
            <div class="checkout-card mb-2">
              <h3><i class="fas fa-sticky-note"></i> Notas del Pedido</h3>
              <textarea class="form-textarea" id="checkoutNotes" placeholder="Instrucciones especiales, productos a evitar, horario preferido de entrega..." rows="3"></textarea>
            </div>
          </div>

          <!-- Right Column: Summary -->
          <div>
            <div class="checkout-card" id="checkoutSummaryCard">
              <h3><i class="fas fa-receipt"></i> Resumen del Pedido</h3>
              <div class="summary-lines">
                <div class="summary-line">
                  <span>Productos (${Cart.getCount()})</span>
                  <span>${money(Cart.getSubtotal())}</span>
                </div>
                <div class="summary-line" id="checkoutDeliveryLine">
                  <span>Envio</span>
                  <span>${money(fee)}</span>
                </div>
                <div class="summary-line total" id="checkoutTotalLine">
                  <span>Total</span>
                  <span>${money(Cart.getSubtotal() + fee)}</span>
                </div>
              </div>
              ${Cart.getSubtotal() < freeMin ? `<p style="font-size:12px;color:var(--green);margin-top:12px;"><i class="fas fa-info-circle"></i> Agrega ${money(freeMin - Cart.getSubtotal())} mas para envio gratis</p>` : ''}
              <button class="btn btn-primary btn-lg btn-block mt-3" id="placeOrderBtn" style="border-radius:var(--radius-full);padding:16px;"><i class="fas fa-check-circle"></i> Confirmar Pedido</button>
              <p style="text-align:center;font-size:12px;color:var(--gray-400);margin-top:10px;"><i class="fas fa-lock"></i> Pago seguro al momento de la entrega</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // State
    let fulfillmentType = 'delivery';
    let paymentMethod = 'efectivo';

    function updateSummary() {
      const dFee = Cart.getDeliveryFee(freeMin, fee, fulfillmentType);
      const total = Cart.getSubtotal() + dFee;
      const deliveryLine = document.getElementById('checkoutDeliveryLine');
      if (deliveryLine) {
        if (dFee === 0) {
          deliveryLine.innerHTML = `<span>Envio</span><span><span class="free-badge">GRATIS</span></span>`;
        } else {
          deliveryLine.innerHTML = `<span>Envio</span><span>${money(dFee)}</span>`;
        }
      }
      const totalLine = document.getElementById('checkoutTotalLine');
      if (totalLine) totalLine.innerHTML = `<span>Total</span><span>${money(total)}</span>`;
    }

    // Fulfillment type selection
    document.getElementById('fulfillmentOptions').addEventListener('click', function (e) {
      const card = e.target.closest('.option-card');
      if (!card) return;
      this.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input').checked = true;
      fulfillmentType = card.dataset.value;
      document.getElementById('addressCard').style.display = fulfillmentType === 'pickup' ? 'none' : 'block';
      updateSummary();
    });

    // Payment method selection
    document.getElementById('paymentOptions').addEventListener('click', function (e) {
      const card = e.target.closest('.payment-card');
      if (!card) return;
      this.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input').checked = true;
      paymentMethod = card.dataset.value;
    });

    // Place order
    document.getElementById('placeOrderBtn').addEventListener('click', async function () {
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Procesando...';

      // Validate
      const address = document.getElementById('checkoutAddress').value.trim();
      if (fulfillmentType === 'delivery' && !address) {
        document.getElementById('checkoutAddress').closest('.form-group').classList.add('error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
        toast('La direccion de entrega es obligatoria', 'error');
        return;
      }

      const fullAddress = fulfillmentType === 'delivery'
        ? address + (document.getElementById('checkoutNeighborhood').value.trim() ? ', ' + document.getElementById('checkoutNeighborhood').value.trim() : '') + (document.getElementById('checkoutRef').value.trim() ? ' (' + document.getElementById('checkoutRef').value.trim() + ')' : '')
        : 'Recogida en tienda';

      const notes = document.getElementById('checkoutNotes').value.trim();
      const orderItems = Cart.toOrderItems();

      try {
        const res = await api('/api/orders', {
          method: 'POST',
          headers: Auth.getHeaders(),
          body: JSON.stringify({
            items: orderItems,
            delivery_address: fullAddress,
            fulfillment_type: fulfillmentType,
            payment_method: paymentMethod,
            notes: notes || null,
          }),
        });

        const order = res.data;
        Cart.clear();

        container.innerHTML = `
          <div class="order-success">
            <div class="success-icon"><i class="fas fa-check"></i></div>
            <h2>Pedido Creado Exitosamente</h2>
            <p>Tu pedido <strong>#${order.id.substring(0, 8).toUpperCase()}</strong> ha sido recibido. Te notificaremos cuando cambie el estado.</p>
            <div style="margin-bottom:24px;">${statusChip(order.status)}</div>
            <p style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:8px;">Total: ${money(order.total)}</p>
            <p style="font-size:14px;color:var(--gray-500);margin-bottom:24px;">Pago: ${paymentMethod} | Entrega: ${fulfillmentType === 'delivery' ? 'Domicilio' : 'Recogida'}</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
              <a href="#/mis-pedidos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-receipt"></i> Ver Mis Pedidos</a>
              <a href="#/productos" class="btn btn-outline" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Seguir Comprando</a>
            </div>
          </div>
        `;

        toast('Pedido creado exitosamente');
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
        toast(err.message, 'error');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AUTH PAGE (Full page, not modal)
  // ═══════════════════════════════════════════════════════════════════

  function renderAuthPage(container) {
    const isLogin = window.location.hash === '#/ingresar';

    container.innerHTML = `
      <div style="max-width:420px;margin:0 auto;padding:24px 16px 40px;">
        <div class="auth-header">
          <div class="logo-icon" style="margin:0 auto 12px;"><i class="fas fa-shopping-basket"></i></div>
          <h2>${isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}</h2>
          <p>${isLogin ? 'Ingresa a tu cuenta para hacer pedidos' : 'Registrate para comenzar a comprar'}</p>
        </div>
        <div class="checkout-card">
          <form id="authPageForm" novalidate>
            ${!isLogin ? `
              <div class="form-group">
                <label class="form-label">Nombre completo *</label>
                <input type="text" class="form-input" id="authName" placeholder="Tu nombre" required>
                <div class="form-error">El nombre es obligatorio</div>
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Correo electronico *</label>
              <input type="email" class="form-input" id="authEmail" placeholder="tu@correo.com" required>
              <div class="form-error">Ingresa un correo valido</div>
            </div>
            ${!isLogin ? `
              <div class="form-group">
                <label class="form-label">Telefono *</label>
                <input type="tel" class="form-input" id="authPhone" placeholder="+57 300 000 0000" required>
                <div class="form-error">El telefono es obligatorio</div>
              </div>
            ` : ''}
            <div class="form-group">
              <label class="form-label">Contrasena *</label>
              <input type="password" class="form-input" id="authPassword" placeholder="Minimo 6 caracteres" required>
              <div class="form-error">La contrasena debe tener al menos 6 caracteres</div>
            </div>
            <button type="submit" class="btn btn-primary btn-lg btn-block mt-2" id="authPageSubmit" style="border-radius:var(--radius-full);">
              <i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}
            </button>
          </form>
          <div class="auth-switch mt-2">
            ${isLogin
              ? 'No tienes cuenta? <a href="#/registro">Registrate aqui</a>'
              : 'Ya tienes cuenta? <a href="#/ingresar">Inicia sesion</a>'
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('authPageForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('authPageSubmit');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Procesando...';

      // Clear errors
      this.querySelectorAll('.form-group').forEach(g => g.classList.remove('error'));

      try {
        if (isLogin) {
          const email = document.getElementById('authEmail').value.trim();
          const password = document.getElementById('authPassword').value;
          if (!email || !password) throw new Error('Completa todos los campos');
          await Auth.login(email, password);
          toast('Bienvenido de vuelta');
          window.location.hash = '#/';
        } else {
          const name = document.getElementById('authName').value.trim();
          const email = document.getElementById('authEmail').value.trim();
          const phone = document.getElementById('authPhone').value.trim();
          const password = document.getElementById('authPassword').value;
          if (!name || !email || !phone || !password) throw new Error('Completa todos los campos');
          if (password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres');
          await Auth.register(name, email, phone, password);
          toast('Cuenta creada exitosamente. Bienvenido!');
          window.location.hash = '#/';
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}`;
        toast(err.message, 'error');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AUTH MODAL (from header)
  // ═══════════════════════════════════════════════════════════════════

  function openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    const body = document.getElementById('authModalBody');
    const isLogin = mode === 'login';

    body.innerHTML = `
      <div class="auth-header">
        <div class="logo-icon" style="margin:0 auto 12px;"><i class="fas fa-shopping-basket"></i></div>
        <h2>${isLogin ? 'Iniciar Sesion' : 'Crear Cuenta'}</h2>
        <p>${isLogin ? 'Ingresa a tu cuenta' : 'Registrate para comprar'}</p>
      </div>
      <form id="modalAuthForm" novalidate>
        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label">Nombre completo *</label>
            <input type="text" class="form-input" id="modalAuthName" placeholder="Tu nombre" required>
          </div>
        ` : ''}
        <div class="form-group">
          <label class="form-label">Correo electronico *</label>
          <input type="email" class="form-input" id="modalAuthEmail" placeholder="tu@correo.com" required>
        </div>
        ${!isLogin ? `
          <div class="form-group">
            <label class="form-label">Telefono *</label>
            <input type="tel" class="form-input" id="modalAuthPhone" placeholder="+57 300 000 0000" required>
          </div>
        ` : ''}
        <div class="form-group">
          <label class="form-label">Contrasena *</label>
          <input type="password" class="form-input" id="modalAuthPassword" placeholder="Minimo 6 caracteres" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" id="modalAuthSubmit" style="border-radius:var(--radius-full);">
          <i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}
        </button>
      </form>
      <div class="auth-switch mt-2">
        ${isLogin
          ? 'No tienes cuenta? <a href="#" id="modalSwitchToRegister">Registrate</a>'
          : 'Ya tienes cuenta? <a href="#" id="modalSwitchToLogin">Inicia sesion</a>'
        }
      </div>
    `;

    modal.classList.add('open');

    // Switch mode
    const switchLink = document.getElementById(isLogin ? 'modalSwitchToRegister' : 'modalSwitchToLogin');
    if (switchLink) {
      switchLink.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(isLogin ? 'register' : 'login');
      });
    }

    // Form submit
    document.getElementById('modalAuthForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('modalAuthSubmit');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Procesando...';

      try {
        if (isLogin) {
          const email = document.getElementById('modalAuthEmail').value.trim();
          const password = document.getElementById('modalAuthPassword').value;
          await Auth.login(email, password);
          toast('Bienvenido!');
        } else {
          const name = document.getElementById('modalAuthName').value.trim();
          const email = document.getElementById('modalAuthEmail').value.trim();
          const phone = document.getElementById('modalAuthPhone').value.trim();
          const password = document.getElementById('modalAuthPassword').value;
          await Auth.register(name, email, phone, password);
          toast('Cuenta creada exitosamente!');
        }
        modal.classList.remove('open');
        // Refresh current view
        router();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}`;
        toast(err.message, 'error');
      }
    });
  }

  function closeAuthModal() {
    document.getElementById('authModal').classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ORDERS VIEW
  // ═══════════════════════════════════════════════════════════════════

  async function renderOrders(container) {
    if (!Auth.requireAuth()) return;

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1>Mis Pedidos</h1>
          <p>Historial completo de tus pedidos</p>
        </div>
        <div id="ordersContainer" style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    `;

    try {
      const res = await api('/api/orders?limit=50');
      const orders = res.data || [];
      const ordersContainer = document.getElementById('ordersContainer');

      if (orders.length === 0) {
        ordersContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-receipt"></i>
            <h2>No tienes pedidos aun</h2>
            <p>Haz tu primer pedido y lo veras aqui</p>
            <a href="#/productos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ir a Comprar</a>
          </div>
        `;
        return;
      }

      ordersContainer.innerHTML = `
        <div class="orders-list">
          ${orders.map(o => `
            <div class="order-card" data-order-id="${o.id}">
              <div class="order-card-header">
                <span class="order-id">#${o.id.substring(0, 8).toUpperCase()}</span>
                ${statusChip(o.status)}
              </div>
              <div class="order-card-body">
                <div>
                  <div class="order-items-preview">${o.fulfillment_type === 'pickup' ? 'Recogida en tienda' : 'Domicilio'} · ${formatDate(o.created_at)}</div>
                  <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">${o.payment_method || 'efectivo'}</div>
                </div>
                <span class="order-total">${money(o.total)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Click to see detail
      ordersContainer.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => openOrderDetail(card.dataset.orderId));
      });

    } catch (err) {
      document.getElementById('ordersContainer').innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h2>Error al cargar pedidos</h2>
          <p>${err.message}</p>
          <button class="btn btn-primary btn-sm" onclick="location.reload()"><i class="fas fa-redo"></i> Reintentar</button>
        </div>
      `;
    }
  }

  // ─── Order Detail Modal ────────────────────────────────────────────
  async function openOrderDetail(orderId) {
    const modal = document.getElementById('orderModal');
    const body = document.getElementById('orderModalBody');

    body.innerHTML = '<div style="text-align:center;padding:40px;"><span class="spinner"></span></div>';
    modal.classList.add('open');

    try {
      const res = await api('/api/orders/' + orderId);
      const o = res.data;

      body.innerHTML = `
        <div class="order-detail-header">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div class="order-detail-id">Pedido #${o.id.substring(0, 8).toUpperCase()}</div>
            ${statusChip(o.status)}
          </div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:6px;">${formatDate(o.created_at)}</div>
          <div style="font-size:13px;color:var(--gray-500);">${o.fulfillment_type === 'pickup' ? 'Recogida en tienda' : 'Domicilio'}</div>
        </div>

        ${o.delivery_address ? `<div style="margin-bottom:16px;"><strong style="font-size:13px;color:var(--gray-600);">Direccion:</strong> <span style="font-size:13px;">${o.delivery_address}</span></div>` : ''}
        ${o.pickup_code ? `<div style="margin-bottom:16px;padding:12px;background:var(--gold-light);border-radius:var(--radius);text-align:center;"><strong style="font-size:14px;">Codigo de recogida:</strong> <span style="font-size:24px;font-weight:800;letter-spacing:4px;color:var(--orange);">${o.pickup_code}</span></div>` : ''}

        <h4 style="font-size:14px;font-weight:700;color:var(--gray-800);margin-bottom:12px;">Productos</h4>
        <div class="order-detail-items">
          ${(o.items || []).map(item => `
            <div class="order-detail-item">
              <div>
                <div class="odi-name">${item.product_name}</div>
                <div class="odi-qty">${item.qty} x ${money(item.unit_price)} ${item.unit ? '/ ' + unitLabel(item.unit) : ''}</div>
              </div>
              <span class="odi-price">${money(item.line_total)}</span>
            </div>
          `).join('')}
        </div>

        <div class="summary-lines" style="margin-top:16px;">
          <div class="summary-line"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
          <div class="summary-line"><span>Envio</span><span>${o.delivery_fee > 0 ? money(o.delivery_fee) : '<span class="free-badge">GRATIS</span>'}</span></div>
          ${o.discount > 0 ? `<div class="summary-line discount"><span>Descuento</span><span>-${money(o.discount)}</span></div>` : ''}
          ${o.tax_total > 0 ? `<div class="summary-line"><span>Impuestos</span><span>${money(o.tax_total)}</span></div>` : ''}
          <div class="summary-line total"><span>Total</span><span>${money(o.total)}</span></div>
        </div>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-200);">
          <div style="font-size:13px;color:var(--gray-500);"><strong>Pago:</strong> ${o.payment_method || 'Efectivo'}</div>
          ${o.notes ? `<div style="font-size:13px;color:var(--gray-500);margin-top:4px;"><strong>Notas:</strong> ${o.notes}</div>` : ''}
          ${o.worker_name ? `<div style="font-size:13px;color:var(--gray-500);margin-top:4px;"><strong>Repartidor:</strong> ${o.worker_name}</div>` : ''}
        </div>

        ${['pending', 'confirmed'].includes(o.status) ? `
          <button class="btn btn-danger btn-block mt-3" id="cancelOrderBtn"><i class="fas fa-times-circle"></i> Cancelar Pedido</button>
        ` : ''}
      `;

      // Cancel order
      const cancelBtn = document.getElementById('cancelOrderBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (!confirm('Estas seguro de cancelar este pedido?')) return;
          cancelBtn.disabled = true;
          cancelBtn.innerHTML = '<span class="spinner spinner-sm spinner-white"></span> Cancelando...';
          try {
            await api('/api/orders/' + orderId + '/cancel', {
              method: 'POST',
              headers: Auth.getHeaders(),
              body: JSON.stringify({ reason: 'Cancelado por el cliente desde la web' }),
            });
            toast('Pedido cancelado', 'warning');
            modal.classList.remove('open');
            router();
          } catch (err) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Pedido';
            toast(err.message, 'error');
          }
        });
      }

    } catch (err) {
      body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h2>Error</h2><p>${err.message}</p></div>`;
    }
  }

  function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('open');
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
        openAuthModal('login'); // Could show profile, but for now just show that they're logged in
        // Actually let's show a quick profile menu or just redirect to orders
        if (confirm(`Hola, ${Auth.getUser().name}. Deseas cerrar sesion?`)) {
          Auth.logout();
          toast('Sesion cerrada');
          router();
        }
      } else {
        openAuthModal('login');
      }
    });
  }

  // Modal close handlers
  function setupModals() {
    document.getElementById('authModalOverlay').addEventListener('click', closeAuthModal);
    document.getElementById('authModalClose').addEventListener('click', closeAuthModal);
    document.getElementById('orderModalOverlay').addEventListener('click', closeOrderModal);
    document.getElementById('orderModalClose').addEventListener('click', closeOrderModal);
  }

  // Mobile nav handlers
  function setupMobileNav() {
    document.getElementById('hamburgerBtn').addEventListener('click', openMobileNav);
    document.getElementById('mobileNavOverlay').addEventListener('click', closeMobileNav);
    document.getElementById('mobileNavClose').addEventListener('click', closeMobileNav);

    document.getElementById('mobileAuthBtn').addEventListener('click', () => {
      closeMobileNav();
      openAuthModal('login');
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
    productCardHTML,
    bindAddToCartButtons,
    get settings() { return settings; },
    get categories() { return categories; },
    get featuredProducts() { return featuredProducts; },
    get banners() { return banners; },
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
