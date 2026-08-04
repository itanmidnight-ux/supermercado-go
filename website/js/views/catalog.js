/* website/js/views/catalog.js — Home, Productos, Detalle de producto */
(function () {
  'use strict';

  // Nota: no se desestructura `window.App` aquí arriba porque este script se
  // carga ANTES que app.js (que es quien crea window.App) — a esta altura
  // `window.App` todavía no existe. Las funciones de abajo solo se invocan
  // más tarde (tras DOMContentLoaded), momento en el que `App` ya se resolvió
  // como global, así que referenciarlo como `App.xxx` dentro de los cuerpos
  // de función (enlace tardío) es seguro; capturarlo en una const aquí no lo
  // sería.

  // Estado local de esta vista (cache entre renderHome/renderProducts, no
  // compartido con app.js: nada fuera de este archivo lo consulta).
  let categories = [];
  let featuredProducts = [];
  let banners = [];

  // ═══════════════════════════════════════════════════════════════════
  //  HOME VIEW
  // ═══════════════════════════════════════════════════════════════════

  async function renderHome(container) {
    const fee = App.settings ? App.settings.delivery_fee : 4900;
    const freeMin = App.settings ? App.settings.free_delivery_min : 50000;
    const zone = App.settings ? App.settings.operating_zone : 'Cuca';

    // Load banners
    let bannerHTML = '';
    try {
      const bRes = await App.api('/api/banners');
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
      const cRes = await App.api('/api/categories');
      categories = cRes.data || [];
    } catch {
      categories = [];
    }

    // Load featured products (offers first, then some products)
    let productsHTML = '';
    try {
      const pRes = await App.api('/api/products?limit=10&offer=true');
      featuredProducts = pRes.data || [];
      if (featuredProducts.length === 0) {
        const pRes2 = await App.api('/api/products?limit=10');
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
            <div class="hero-badge"><i class="fas fa-bolt"></i> Envio gratis en pedidos +${App.money(freeMin)}</div>
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
            const ic = App.getCategoryIcon(c.name);
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
            <p>Domicilio a toda la ciudad. <strong>Envio gratis</strong> en pedidos mayores a ${App.money(freeMin)}.</p>
            <p style="font-size:13px; color:var(--gray-500);">Tarifa de envio: ${App.money(fee)} | Horario: ${App.settings ? App.settings.business_hours : '6:00 AM - 6:00 PM'}</p>
            <a href="#/zona-entrega" class="btn btn-primary btn-sm mt-2" style="border-radius:var(--radius-full);"><i class="fas fa-map"></i> Ver Zona de Entrega</a>
          </div>
        </div>
      </section>
    `;

    // Bind add-to-cart buttons
    bindAddToCartButtons(container);
    bindFavoriteButtons(container);
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
          ${App.productImgHTML(p.image)}
          ${hasOffer ? `<span class="product-offer-badge">OFERTA</span>` : ''}
          ${Auth.isLogged() && Auth.getUser().role === 'client' ? `
            <button class="favorite-btn ${Favorites.isFavorite(p.id) ? 'active' : ''}" data-product-id="${p.id}" onclick="event.stopPropagation();" title="${Favorites.isFavorite(p.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
              <i class="${Favorites.isFavorite(p.id) ? 'fas' : 'far'} fa-heart"></i>
            </button>
          ` : ''}
        </div>
        <div class="product-card-body">
          ${p.brand ? `<div class="product-card-brand">${p.brand}</div>` : ''}
          ${stockWarning && !outOfStock ? `<div class="product-stock-badge"><i class="fas fa-exclamation-triangle"></i> Pocas unidades</div>` : ''}
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-footer">
            <div class="product-price-group">
              <span class="product-price">${App.money(displayPrice)}</span>
              ${hasOffer ? `<span class="product-price-old">${App.money(p.price)}</span>` : ''}
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
          const res = await App.api('/api/products/' + pid);
          const product = res.data;
          Cart.addItem(product, 1);
          App.toast(`${product.name} agregado al carrito`);
          // Update button visual
          this.style.background = 'var(--orange)';
          this.innerHTML = '<i class="fas fa-check"></i>';
        } catch (err) {
          App.toast(err.message, 'error');
        }
      });
    });
  }

  // ─── Bind Favorite Buttons ─────────────────────────────────────────
  function bindFavoriteButtons(container) {
    container.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const pid = this.dataset.productId;
        await Favorites.toggle(pid);
        const nowFav = Favorites.isFavorite(pid);
        this.classList.toggle('active', nowFav);
        this.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
        this.title = nowFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
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
        const cRes = await App.api('/api/categories');
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

        const res = await App.api(url);
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
        bindFavoriteButtons(grid);

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
      const res = await App.api('/api/products/' + productId);
      const p = res.data;
      if (!p) throw new Error('Producto no encontrado');

      const hasOffer = p.is_offer && p.offer_price;
      const displayPrice = hasOffer ? p.offer_price : p.price;
      const outOfStock = p.stock !== null && p.stock !== undefined && p.stock <= 0;
      const lowStock = p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= 5;
      const inCart = Cart.hasItem(p.id);
      const cartQty = Cart.getQty(p.id);

      let stockClass = 'in-stock';
      let stockText = `Disponible: ${p.stock} ${App.unitLabel(p.unit)}s`;
      let stockIcon = 'fa-check-circle';
      if (outOfStock) { stockClass = 'out-of-stock'; stockText = 'Agotado'; stockIcon = 'fa-times-circle'; }
      else if (lowStock) { stockClass = 'low-stock'; stockText = `Pocas unidades: ${p.stock} ${App.unitLabel(p.unit)}s`; stockIcon = 'fa-exclamation-triangle'; }
      else if (p.stock === null || p.stock === undefined) { stockText = 'Disponible'; }

      container.innerHTML = `
        <div class="product-detail">
          <a class="product-detail-back" onclick="history.back()"><i class="fas fa-arrow-left"></i> Volver</a>
          <div class="product-detail-grid">
            <div class="product-detail-image">
              ${App.productImgHTML(p.image, 'detail')}
            </div>
            <div class="product-detail-info">
              ${p.category_name ? `<span style="font-size:13px;color:var(--green);font-weight:600;"><i class="fas fa-tag"></i> ${p.category_name}</span><br>` : ''}
              <h1>${p.name}</h1>
              ${p.brand ? `<div class="brand-name">Marca: ${p.brand}</div>` : ''}
              ${hasOffer ? `<div class="detail-price-old">Antes: ${App.money(p.price)}</div>` : ''}
              <div class="detail-price">${App.money(displayPrice)} <small style="font-size:14px;font-weight:400;color:var(--gray-400);">/ ${App.unitLabel(p.unit)}</small></div>
              <div class="detail-unit">${p.description ? p.description : 'Producto de calidad'}</div>
              <div class="detail-stock ${stockClass}"><i class="fas ${stockIcon}"></i> ${stockText}</div>
              <p>${p.sku ? `Codigo: ${p.sku}` : ''} ${p.barcode ? `| Barras: ${p.barcode}` : ''}</p>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div class="quantity-selector" id="detailQtySelector">
                  <button class="qty-btn" id="detailQtyMinus"><i class="fas fa-minus"></i></button>
                  <input type="number" class="qty-input" id="detailQtyInput" value="${inCart ? cartQty : 1}" min="1" ${p.stock ? `max="${p.stock}"` : ''}>
                  <button class="qty-btn" id="detailQtyPlus"><i class="fas fa-plus"></i></button>
                </div>
                <span style="font-size:14px;color:var(--gray-500);" id="detailSubtotal">Subtotal: ${App.money(displayPrice * (inCart ? cartQty : 1))}</span>
              </div>
              <div class="detail-actions">
                ${Auth.isLogged() && Auth.getUser().role === 'client' ? `
                  <button class="btn btn-outline btn-lg favorite-btn-detail ${Favorites.isFavorite(p.id) ? 'active' : ''}" id="detailFavoriteBtn" title="${Favorites.isFavorite(p.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                    <i class="${Favorites.isFavorite(p.id) ? 'fas' : 'far'} fa-heart"></i>
                  </button>
                ` : ''}
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
        subtotal.textContent = `Subtotal: ${App.money(displayPrice * val)}`;
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
          App.toast(`${p.name} agregado al carrito`);
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
          App.toast(`Cantidad actualizada a ${qty}`);
          updateBtn.innerHTML = `<i class="fas fa-cart-plus"></i> Actualizar Carrito (${qty})`;
        });
      }

      const favBtn = document.getElementById('detailFavoriteBtn');
      if (favBtn) {
        favBtn.addEventListener('click', async () => {
          await Favorites.toggle(p.id);
          const nowFav = Favorites.isFavorite(p.id);
          favBtn.classList.toggle('active', nowFav);
          favBtn.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
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

  window.Views = window.Views || {};
  window.Views.renderHome = renderHome;
  window.Views.renderProducts = renderProducts;
  window.Views.renderProductDetail = renderProductDetail;

  // Reexponer en App para que otras vistas (favoritos, etc.) puedan reusar
  // la misma card sin duplicar el HTML. Diferido: este script se carga ANTES
  // que app.js, así que `window.App` todavía no existe en este punto —
  // esperamos a que app.js termine de correr (DOMContentLoaded, o de una vez
  // si el documento ya cargó) antes de escribir sobre él.
  function exposeOnApp() {
    window.App.productCardHTML = productCardHTML;
    window.App.bindAddToCartButtons = bindAddToCartButtons;
    window.App.bindFavoriteButtons = bindFavoriteButtons;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', exposeOnApp);
  } else {
    exposeOnApp();
  }
})();
