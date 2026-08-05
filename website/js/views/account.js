/* website/js/views/account.js — Autenticacion y Pedidos */
(function () {
  'use strict';

  // Nota: no se desestructura `window.App` aquí arriba porque este script se
  // carga ANTES que app.js (que es quien crea window.App) — a esta altura
  // `window.App` todavía no existe. Las funciones de abajo solo se invocan
  // más tarde (tras DOMContentLoaded), momento en el que `App` ya se resolvió
  // como global, así que referenciarlo como `App.xxx` dentro de los cuerpos
  // de función (enlace tardío) es seguro; capturarlo en una const aquí no lo
  // sería.

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
          App.toast('Bienvenido de vuelta');
          window.location.hash = '#/';
        } else {
          const name = document.getElementById('authName').value.trim();
          const email = document.getElementById('authEmail').value.trim();
          const phone = document.getElementById('authPhone').value.trim();
          const password = document.getElementById('authPassword').value;
          if (!name || !email || !phone || !password) throw new Error('Completa todos los campos');
          if (password.length < 6) throw new Error('La contrasena debe tener al menos 6 caracteres');
          await Auth.register(name, email, phone, password);
          App.toast('Cuenta creada exitosamente. Bienvenido!');
          window.location.hash = '#/';
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}`;
        App.toast(err.message, 'error');
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
          App.toast('Bienvenido!');
        } else {
          const name = document.getElementById('modalAuthName').value.trim();
          const email = document.getElementById('modalAuthEmail').value.trim();
          const phone = document.getElementById('modalAuthPhone').value.trim();
          const password = document.getElementById('modalAuthPassword').value;
          await Auth.register(name, email, phone, password);
          App.toast('Cuenta creada exitosamente!');
        }
        modal.classList.remove('open');
        // Refresh current view
        App.router();
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas ${isLogin ? 'fa-sign-in-alt' : 'fa-user-plus'}"></i> ${isLogin ? 'Ingresar' : 'Crear Cuenta'}`;
        App.toast(err.message, 'error');
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
      const res = await App.api('/api/orders?limit=50');
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
                ${App.statusChip(o.status)}
              </div>
              <div class="order-card-body">
                <div>
                  <div class="order-items-preview">${o.fulfillment_type === 'pickup' ? 'Recogida en tienda' : 'Domicilio'} · ${App.formatDate(o.created_at)}</div>
                  <div style="font-size:12px;color:var(--gray-400);margin-top:4px;">${o.payment_method || 'efectivo'}</div>
                </div>
                <span class="order-total">${App.money(o.total)}</span>
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
      const res = await App.api('/api/orders/' + orderId);
      const o = res.data;

      body.innerHTML = `
        <div class="order-detail-header">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div class="order-detail-id">Pedido #${o.id.substring(0, 8).toUpperCase()}</div>
            ${App.statusChip(o.status)}
          </div>
          <div style="font-size:13px;color:var(--gray-500);margin-top:6px;">${App.formatDate(o.created_at)}</div>
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
                <div class="odi-qty">${item.qty} x ${App.money(item.unit_price)} ${item.unit ? '/ ' + App.unitLabel(item.unit) : ''}</div>
              </div>
              <span class="odi-price">${App.money(item.line_total)}</span>
            </div>
          `).join('')}
        </div>

        <div class="summary-lines" style="margin-top:16px;">
          <div class="summary-line"><span>Subtotal</span><span>${App.money(o.subtotal)}</span></div>
          <div class="summary-line"><span>Envio</span><span>${o.delivery_fee > 0 ? App.money(o.delivery_fee) : '<span class="free-badge">GRATIS</span>'}</span></div>
          ${o.discount > 0 ? `<div class="summary-line discount"><span>Descuento</span><span>-${App.money(o.discount)}</span></div>` : ''}
          ${o.tax_total > 0 ? `<div class="summary-line"><span>Impuestos</span><span>${App.money(o.tax_total)}</span></div>` : ''}
          <div class="summary-line total"><span>Total</span><span>${App.money(o.total)}</span></div>
        </div>

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-200);">
          <div style="font-size:13px;color:var(--gray-500);"><strong>Pago:</strong> ${o.payment_method || 'Efectivo'}</div>
          ${o.notes ? `<div style="font-size:13px;color:var(--gray-500);margin-top:4px;"><strong>Notas:</strong> ${o.notes}</div>` : ''}
          ${o.worker_name ? `<div style="font-size:13px;color:var(--gray-500);margin-top:4px;"><strong>Repartidor:</strong> ${o.worker_name}</div>` : ''}
        </div>

        ${['pending', 'confirmed'].includes(o.status) ? `
          <button class="btn btn-danger btn-block mt-3" id="cancelOrderBtn"><i class="fas fa-times-circle"></i> Cancelar Pedido</button>
        ` : ''}

        ${['delivered', 'picked_up'].includes(o.status) && !o.rating ? `
          <div class="checkout-card mt-3" id="rateOrderBlock">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:8px;">¿Cómo estuvo tu pedido?</h4>
            <div class="rating-stars" id="ratingStars">
              ${[1, 2, 3, 4, 5].map(n => `<i class="far fa-star" data-star="${n}"></i>`).join('')}
            </div>
            <textarea class="form-textarea mt-2" id="ratingComment" placeholder="Comentario (opcional)" rows="2"></textarea>
            <button class="btn btn-primary btn-block mt-2" id="submitRatingBtn" disabled>Enviar Calificación</button>
          </div>
        ` : o.rating ? `
          <div class="checkout-card mt-3">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:8px;">Tu calificación</h4>
            <div class="rating-stars readonly">
              ${[1, 2, 3, 4, 5].map(n => `<i class="${n <= o.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
            </div>
            ${o.rating_comment ? `<p style="font-size:13px;color:var(--gray-600);margin-top:6px;">${o.rating_comment}</p>` : ''}
          </div>
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
            await App.api('/api/orders/' + orderId + '/cancel', {
              method: 'POST',
              headers: Auth.getHeaders(),
              body: JSON.stringify({ reason: 'Cancelado por el cliente desde la web' }),
            });
            App.toast('Pedido cancelado', 'warning');
            modal.classList.remove('open');
            App.router();
          } catch (err) {
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Pedido';
            App.toast(err.message, 'error');
          }
        });
      }

      // Rating
      let selectedRating = 0;
      const starsEl = document.getElementById('ratingStars');
      if (starsEl) {
        const submitBtn = document.getElementById('submitRatingBtn');
        starsEl.querySelectorAll('[data-star]').forEach(star => {
          star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.star);
            starsEl.querySelectorAll('[data-star]').forEach(s => {
              s.className = parseInt(s.dataset.star) <= selectedRating ? 'fas fa-star' : 'far fa-star';
            });
            submitBtn.disabled = false;
          });
        });
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';
          try {
            await App.api('/api/orders/' + orderId + '/rate', {
              method: 'POST',
              headers: Auth.getHeaders(),
              body: JSON.stringify({ rating: selectedRating, comment: document.getElementById('ratingComment').value.trim() || undefined }),
            });
            App.toast('¡Gracias por tu calificación!');
            openOrderDetail(orderId); // re-render to show the read-only stars
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Calificación';
            App.toast(err.message, 'error');
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

  window.Views = window.Views || {};
  window.Views.renderAuthPage = renderAuthPage;
  window.Views.renderOrders = renderOrders;
  window.Views.openOrderDetail = openOrderDetail;
  window.Views.openAuthModal = openAuthModal;
  window.Views.closeAuthModal = closeAuthModal;
  window.Views.closeOrderModal = closeOrderModal;
})();
