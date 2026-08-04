/* website/js/views/shopping.js — Carrito y Checkout */
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
  //  CART VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderCart(container) {
    const items = Cart.getItems();
    const fee = App.settings ? App.settings.delivery_fee : 4900;
    const freeMin = App.settings ? App.settings.free_delivery_min : 50000;
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
                ${App.productImgHTML(item.image)}
              </div>
              <div class="cart-item-info">
                <div class="cart-item-name" title="${item.name}">${item.name}</div>
                <div class="cart-item-unit">${item.brand ? item.brand + ' · ' : ''}${App.money(item.price)} / ${App.unitLabel(item.unit)}</div>
                <div class="cart-item-bottom">
                  <div class="cart-qty-selector">
                    <button class="cart-qty-btn cart-dec" data-id="${item.product_id}"><i class="fas fa-minus"></i></button>
                    <span class="cart-qty-val">${item.qty}</span>
                    <button class="cart-qty-btn cart-inc" data-id="${item.product_id}"><i class="fas fa-plus"></i></button>
                  </div>
                  <span class="cart-item-price">${App.money(item.price * item.qty)}</span>
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
            <span class="cart-summary-subtotal">Subtotal: ${App.money(subtotal)} ${deliveryFee === 0 ? '<span class="status-chip delivered" style="font-size:10px;padding:1px 6px;margin-left:6px;">ENVIO GRATIS</span>' : `+ Envio: ${App.money(deliveryFee)}`}</span>
            <span class="cart-summary-total">${App.money(total)} <small>COP</small></span>
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
        App.toast('Producto eliminado del carrito', 'warning');
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

    const fee = App.settings ? App.settings.delivery_fee : 4900;
    const freeMin = App.settings ? App.settings.free_delivery_min : 50000;
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
              <div id="checkoutAddressSelector"></div>
              <a href="#/direcciones" style="font-size:13px;color:var(--green);display:inline-block;margin-top:8px;"><i class="fas fa-plus"></i> Agregar nueva dirección</a>
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
                  <span>${App.money(Cart.getSubtotal())}</span>
                </div>
                <div class="summary-line" id="checkoutDeliveryLine">
                  <span>Envio</span>
                  <span>${App.money(fee)}</span>
                </div>
                <div class="summary-line total" id="checkoutTotalLine">
                  <span>Total</span>
                  <span>${App.money(Cart.getSubtotal() + fee)}</span>
                </div>
              </div>
              ${Cart.getSubtotal() < freeMin ? `<p style="font-size:12px;color:var(--green);margin-top:12px;"><i class="fas fa-info-circle"></i> Agrega ${App.money(freeMin - Cart.getSubtotal())} mas para envio gratis</p>` : ''}
              <button class="btn btn-primary btn-lg btn-block mt-3" id="placeOrderBtn" style="border-radius:var(--radius-full);padding:16px;"><i class="fas fa-check-circle"></i> Confirmar Pedido</button>
              <p style="text-align:center;font-size:12px;color:var(--gray-400);margin-top:10px;"><i class="fas fa-lock"></i> Pago seguro al momento de la entrega</p>
            </div>
          </div>
        </div>
      </div>
    `;

    (async () => {
      await Addresses.load();
      const addrs = Addresses.getAll();
      const selector = document.getElementById('checkoutAddressSelector');
      if (addrs.length === 0) {
        selector.innerHTML = `<p style="font-size:13px;color:var(--gray-500);">No tienes direcciones guardadas. <a href="#/direcciones" style="color:var(--green);">Agrega una</a> o usa el campo de abajo.</p>
          <div class="form-group mt-2"><input type="text" class="form-input" id="checkoutAddress" placeholder="Ej: Cra 5 # 12-34, Barrio Centro"></div>`;
        return;
      }
      selector.innerHTML = addrs.map((a, i) => `
        <label class="option-card ${i === 0 ? 'selected' : ''}" data-address-id="${a.id}" style="display:block;text-align:left;">
          <input type="radio" name="checkout_address" value="${a.id}" ${i === 0 ? 'checked' : ''} style="margin-right:8px;">
          <strong>${a.label || 'Dirección'}</strong><br>
          <span style="font-size:12px;color:var(--gray-500);">${a.address}${a.neighborhood ? ', ' + a.neighborhood : ''}</span>
        </label>
      `).join('') + `<a href="#/direcciones" style="font-size:12px;color:var(--green);display:inline-block;margin-top:8px;">+ Usar una dirección nueva</a>`;
    })();

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
          deliveryLine.innerHTML = `<span>Envio</span><span>${App.money(dFee)}</span>`;
        }
      }
      const totalLine = document.getElementById('checkoutTotalLine');
      if (totalLine) totalLine.innerHTML = `<span>Total</span><span>${App.money(total)}</span>`;
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

      // Validate / resolve address
      let fullAddress = 'Recogida en tienda';
      if (fulfillmentType === 'delivery') {
        const selectedRadio = document.querySelector('input[name="checkout_address"]:checked');
        if (selectedRadio) {
          const addr = Addresses.getAll().find(a => a.id === selectedRadio.value);
          fullAddress = addr.address + (addr.neighborhood ? ', ' + addr.neighborhood : '') + (addr.detail ? ' (' + addr.detail + ')' : '');
        } else {
          const freeText = document.getElementById('checkoutAddress');
          if (!freeText || !freeText.value.trim()) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
            App.toast('La dirección de entrega es obligatoria', 'error');
            return;
          }
          fullAddress = freeText.value.trim();
        }
      }

      const notes = document.getElementById('checkoutNotes').value.trim();
      const orderItems = Cart.toOrderItems();

      try {
        const res = await App.api('/api/orders', {
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
            <div style="margin-bottom:24px;">${App.statusChip(order.status)}</div>
            <p style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:8px;">Total: ${App.money(order.total)}</p>
            <p style="font-size:14px;color:var(--gray-500);margin-bottom:24px;">Pago: ${paymentMethod} | Entrega: ${fulfillmentType === 'delivery' ? 'Domicilio' : 'Recogida'}</p>
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
              <a href="#/mis-pedidos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-receipt"></i> Ver Mis Pedidos</a>
              <a href="#/productos" class="btn btn-outline" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Seguir Comprando</a>
            </div>
          </div>
        `;

        App.toast('Pedido creado exitosamente');
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
        App.toast(err.message, 'error');
      }
    });
  }

  window.Views = window.Views || {};
  window.Views.renderCart = renderCart;
  window.Views.renderCheckout = renderCheckout;
})();
