/* ═══════════════════════════════════════════════════════════════
   Worker Panel — SupermercadosGo
   Flujo completo: Seleccionar → Recoger → Entregar → Verificar
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '-';
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }) : '-';
  // XSS protection: escape HTML entities
  const esc = (s) => { if (s == null) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };

  function toast(msg, type='success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'exclamation-triangle'}"></i><span>${esc(msg)}</span>`;
    $('#toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  function openModal(title, body, footer='') {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalFooter').innerHTML = footer;
    $('#modalOverlay').style.display = 'flex';
  }
  function closeModal() { $('#modalOverlay').style.display = 'none'; }

  // ─── Auth ─────────────────────────────────────────────────
  // Set up 401 auto-recovery
  API.onAuthError = (msg) => {
    $('#workerPanel').style.display = 'none';
    $('#loginScreen').style.display = 'flex';
    const errEl = $('#loginError');
    errEl.textContent = msg || 'La sesión ha expirado. Inicie sesión nuevamente.';
    errEl.style.display = 'block';
    if (typeof gpsWatchId !== 'undefined' && gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  };

  if (API.isLogged && API.user && API.user.role === 'worker') {
    API.validateToken().then(valid => {
      if (valid) {
        showWorker();
      } else {
        API.logout();
        const errEl = $('#loginError');
        errEl.textContent = 'La sesión ha expirado. Inicie sesión nuevamente.';
        errEl.style.display = 'block';
      }
    });
  }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn'), errEl = $('#loginError');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    errEl.style.display = 'none';
    try {
      const user = await API.login($('#loginEmail').value.trim(), $('#loginPassword').value);
      if (user.role !== 'worker') throw new Error('Esta cuenta no tiene permisos de repartidor');
      showWorker();
    } catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión'; }
  });
  $('#logoutBtn').addEventListener('click', () => { API.logout(); location.reload(); });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  function showWorker() {
    $('#loginScreen').style.display = 'none';
    $('#workerPanel').style.display = 'block';
    $('#workerUser').textContent = API.user.name;
    initTabs();
    loadAvailable();
    
    // Restart GPS if there's an active delivery
    restartGPSIfNeeded();
  }
  
  async function restartGPSIfNeeded() {
    try {
      const res = await API.get('/orders?limit=200');
      const activeOrders = (res.data || res.orders || []).filter(o =>
        o.worker_id === API.user.id && ['in_transit', 'delivering'].includes(o.status)
      );
      if (activeOrders.length > 0) {
        currentOrder = activeOrders[0];
        startGPS(currentOrder.id);
      }
    } catch (err) {
      console.error('Error checking active delivery:', err.message);
    }
  }

  // ─── Tabs ─────────────────────────────────────────────────
  function initTabs() {
    $$('.worker-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.worker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        $$('.worker-tab-content').forEach(c => c.classList.remove('active'));
        $(`#tab-${tab.dataset.tab}`).classList.add('active');
        const loaders = { available: loadAvailable, delivery: loadDelivery, history: loadHistory };
        if (loaders[tab.dataset.tab]) loaders[tab.dataset.tab]();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AVAILABLE ORDERS — El worker selecciona un pedido
  // Al reclamarlo, desaparece de la lista de otros workers
  // ═══════════════════════════════════════════════════════════
  async function loadAvailable() {
    const el = $('#tab-available');
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/orders?limit=200');
      const orders = (res.data || res.orders || []).filter(o => ['confirmed','ready'].includes(o.status));
      if (orders.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>Sin pedidos disponibles</h3><p>Cuando haya pedidos confirmados aparecerán aquí</p></div>`;
        return;
      }
      el.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="order-card-header">
            <h4><i class="fas fa-receipt" style="color:var(--primary);margin-right:6px;"></i> Pedido ${(o.id||'').slice(0,8)}</h4>
            <span class="chip chip-${o.status}">${o.status === 'confirmed' ? 'Confirmado' : 'Listo'}</span>
          </div>
          <div class="order-card-body">
            <p><i class="fas fa-user" style="width:16px;"></i> ${o.client_name || 'Cliente'}</p>
            <p><i class="fas fa-map-marker-alt" style="width:16px;color:var(--danger);"></i> ${o.delivery_address || 'Sin dirección'}</p>
            <p><i class="fas fa-dollar-sign" style="width:16px;color:var(--primary);"></i> ${money(o.total)}</p>
            ${o.notes ? `<p><i class="fas fa-comment" style="width:16px;color:var(--gray-400);"></i> ${o.notes}</p>` : ''}
          </div>
          <div class="order-card-footer">
            <button class="btn btn-primary btn-block claim-order" data-id="${o.id}">
              <i class="fas fa-hand-pointer"></i> Reclamar Pedido
            </button>
          </div>
        </div>
      `).join('');

      $$('.claim-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reclamando...';
          try {
            // El worker toma el pedido (status → preparing)
            await API.put('/orders/' + btn.dataset.id + '/status', { status: 'preparing' });
            toast('¡Pedido reclamado! Ve al supermercado a recogerlo.');
            loadAvailable();
            // Auto-switch to delivery tab
            $$('.worker-tab').forEach(t => t.classList.remove('active'));
            $$('.worker-tab-content').forEach(c => c.classList.remove('active'));
            $$('.worker-tab')[1].classList.add('active');
            $('#tab-delivery').classList.add('active');
            loadDelivery();
          } catch (err) {
            toast(err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-hand-pointer"></i> Reclamar Pedido';
          }
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIVE DELIVERY — Flujo completo
  // 1. Preparando (recoger en supermercado)
  // 2. Botón "Ya recogí el pedido" → alerta al cliente + inicia GPS
  // 3. Entregando con GPS activo
  // 4. Ingresar código de verificación → detener GPS → completar
  // ═══════════════════════════════════════════════════════════
  let gpsWatchId = null;
  let currentOrder = null;

  async function loadDelivery() {
    const el = $('#tab-delivery');
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/orders?limit=200');
      const myOrders = (res.data || res.orders || []).filter(o =>
        o.worker_id === API.user.id && ['preparing','in_transit','delivering'].includes(o.status)
      );
      if (myOrders.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-truck"></i><h3>Sin entrega activa</h3><p>Selecciona un pedido en la pestaña "Disponibles"</p></div>`;
        return;
      }
      currentOrder = myOrders[0];
      renderDeliveryFlow(el, currentOrder);
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  function renderDeliveryFlow(el, order) {
    const isPreparing = order.status === 'preparing';
    const isDelivering = ['in_transit', 'delivering'].includes(order.status);
    const verificationCode = order.verification_code || generateCode();

    el.innerHTML = `
      <div class="delivery-status">
        <h3>${isPreparing ? '📦 Ve al supermercado a recoger el pedido' : '🛵 En camino al cliente'}</h3>
        <div class="status-icon">${isPreparing ? '🏪' : '📍'}</div>
        <span class="chip chip-${order.status}">${isPreparing ? 'Preparando' : 'Entregando'}</span>
      </div>

      <div class="order-card">
        <div class="order-card-header">
          <h4>Pedido ${(order.id||'').slice(0,8)}</h4>
        </div>
        <div class="order-card-body">
          <p><strong>Cliente:</strong> ${order.client_name || '-'}</p>
          <p><strong>Teléfono:</strong> ${order.client_phone || '-'}</p>
          <p><strong>Dirección:</strong> ${order.delivery_address || '-'}</p>
          <p><strong>Total:</strong> ${money(order.total)}</p>
          ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
        </div>
      </div>

      ${isPreparing ? `
        <button class="gps-btn inactive" id="pickedUpBtn">
          <i class="fas fa-check-circle"></i> Ya recogí el pedido
        </button>
      ` : ''}

      ${isDelivering ? `
        <button class="gps-btn ${gpsWatchId ? 'active' : 'inactive'}" id="gpsToggle">
          <i class="fas fa-satellite-dish"></i>
          ${gpsWatchId ? '📍 Transmitiendo ubicación...' : '📡 Activar ubicación'}
        </button>
        <div class="map-container" id="workerMap">
          <i class="fas fa-map-marked-alt" style="font-size:32px;"></i>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-accent btn-block btn-lg" id="completeDeliveryBtn">
            <i class="fas fa-lock"></i> Completar Entrega
          </button>
        </div>
      ` : ''}
    `;

    if (isPreparing) {
      $('#pickedUpBtn').addEventListener('click', async () => {
        const btn = $('#pickedUpBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando...';
        try {
          // Generar código de verificación
          const code = generateCode();
          // Cambiar a delivering + guardar código + iniciar ubicación
          await API.put('/orders/' + order.id + '/status', {
            status: 'delivering',
            verification_code: code
          });
          // Iniciar transmisión de GPS
          startGPS(order.id);
          toast('¡Pedido recogido! Ahora ve al cliente. Tu código: ' + code);
          currentOrder = { ...order, status: 'delivering', verification_code: code };
          renderDeliveryFlow($('#tab-delivery'), currentOrder);
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-check-circle"></i> Ya recogí el pedido';
        }
      });
    }

    if (isDelivering) {
      $('#gpsToggle')?.addEventListener('click', () => {
        if (gpsWatchId) { stopGPS(); toast('GPS desactivado', 'warning'); }
        else { startGPS(order.id); toast('GPS activado - El cliente puede verte'); }
        renderDeliveryFlow($('#tab-delivery'), currentOrder || order);
      });

      $('#completeDeliveryBtn')?.addEventListener('click', () => {
        openModal('Completar Entrega', `
          <div style="text-align:center;">
            <p style="margin-bottom:12px;">El cliente debe darte este código de verificación:</p>
            <div class="code-display">${currentOrder?.verification_code || order.verification_code || '------'}</div>
            <div class="form-group" style="margin-top:16px;">
              <label><i class="fas fa-key"></i> Ingresa el código que te dio el cliente</label>
              <input type="text" class="form-input" id="verifyCodeInput" placeholder="Ej: 123456" maxlength="6" style="text-align:center;font-size:20px;letter-spacing:4px;">
            </div>
          </div>
        `, `
          <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
          <button class="btn btn-primary" id="verifyCodeBtn"><i class="fas fa-check"></i> Verificar y Completar</button>
        `);

        $('#verifyCodeBtn').addEventListener('click', async () => {
          const inputCode = $('#verifyCodeInput').value.trim();
          const expectedCode = currentOrder?.verification_code || order.verification_code;
          if (inputCode !== expectedCode) {
            toast('Código incorrecto. Pide el código correcto al cliente.', 'error');
            return;
          }
          try {
            stopGPS();
            await API.put('/orders/' + order.id + '/status', { status: 'delivered' });
            toast('¡Entrega completada exitosamente!');
            closeModal();
            currentOrder = null;
            loadDelivery();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }
  }

  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // ─── GPS ──────────────────────────────────────────────────
  function startGPS(orderId) {
    if (gpsWatchId) return;
    if (!navigator.geolocation) { toast('Tu navegador no soporta geolocalización', 'error'); return; }
    gpsWatchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await API.post('/worker-location', {
            order_id: orderId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        } catch (err) {
          console.error('Error enviando ubicación:', err.message);
        }
      },
      (err) => { console.error('GPS error:', err); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function stopGPS() {
    if (gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  }

  // ═══════════════════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════════════════
  async function loadHistory() {
    const el = $('#tab-history');
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/orders?limit=200');
      const myOrders = (res.data || res.orders || []).filter(o =>
        o.worker_id === API.user.id && ['delivered', 'cancelled'].includes(o.status)
      );
      if (myOrders.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fas fa-clock-rotate-left"></i><h3>Sin historial</h3><p>Tus entregas completadas aparecerán aquí</p></div>`;
        return;
      }
      el.innerHTML = `<h3 style="margin-bottom:12px;font-size:16px;">Historial de Entregas</h3>` +
        myOrders.map(o => `
          <div class="order-card" style="border-left-color: ${o.status === 'delivered' ? 'var(--primary)' : 'var(--danger)'};">
            <div class="order-card-header">
              <h4>Pedido ${(o.id||'').slice(0,8)}</h4>
              <span class="chip chip-${o.status}">${o.status === 'delivered' ? 'Entregado' : 'Cancelado'}</span>
            </div>
            <div class="order-card-body">
              <p><strong>Cliente:</strong> ${o.client_name || '-'}</p>
              <p><strong>Dirección:</strong> ${o.delivery_address || '-'}</p>
              <p><strong>Total:</strong> ${money(o.total)}</p>
              <p><strong>Fecha:</strong> ${fmtDate(o.created_at)} ${fmtTime(o.created_at)}</p>
            </div>
          </div>
        `).join('');
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }
})();
