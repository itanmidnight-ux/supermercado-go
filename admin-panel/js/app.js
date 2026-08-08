/* ═══════════════════════════════════════════════════════════════
   SupermercadosGo Admin Panel — Main Application
   ═══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // ─── Helpers ──────────────────────────────────────────────
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('es-CO') : '-';
  // XSS protection: escape HTML entities
  const esc = (s) => { if (s == null) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };
  const statusChip = (s) => {
    const labels = { pending:'Pendiente', confirmed:'Confirmado', preparing:'Preparando', ready:'Listo', assigned:'Asignado', in_transit:'En camino', delivering:'Entregando', delivered:'Entregado', cancelled:'Cancelado', picked_up:'Recogido' };
    return `<span class="chip chip-${s}">${labels[s] || s}</span>`;
  };
  const avatar = (img, name) => img ? `<img src="${img}" alt="${name||''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : `<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${(name||'A')[0].toUpperCase()}</div>`;

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'exclamation-triangle'}"></i><span>${esc(msg)}</span>`;
    $('#toastContainer').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function openModal(title, bodyHTML, footerHTML = '') {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modalFooter').innerHTML = footerHTML;
    $('#modalOverlay').style.display = 'flex';
  }
  function closeModal() { $('#modalOverlay').style.display = 'none'; }

  // ─── Auth ─────────────────────────────────────────────────
  function initAuth() {
    // Set up 401 auto-recovery: show login screen when token expires
    API.onAuthError = (msg) => {
      Object.keys(tabCache).forEach(k => delete tabCache[k]);
      currentTab = '';
      $('#adminPanel').style.display = 'none';
      $('#loginScreen').style.display = 'flex';
      const errEl = $('#loginError');
      errEl.textContent = msg || 'La sesión ha expirado. Inicie sesión nuevamente.';
      errEl.style.display = 'block';
    };

    if (API.isLogged && API.user && API.user.role === 'admin') {
      // Validate token before showing panel
      API.validateToken().then(valid => {
        if (valid) {
          showAdmin();
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
      const btn = $('#loginBtn');
      const errEl = $('#loginError');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
      errEl.style.display = 'none';
      try {
        await API.login($('#loginEmail').value.trim(), $('#loginPassword').value);
        showAdmin();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
      }
    });
    $('#logoutBtn').addEventListener('click', () => { API.logout(); location.reload(); });
  }

  function showAdmin() {
    $('#loginScreen').style.display = 'none';
    $('#adminPanel').style.display = 'flex';
    $('#adminName').textContent = API.user.name || 'Admin';
    loadTab('dashboard');
  }

  // ─── Navigation ───────────────────────────────────────────
  function initNav() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        $$('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        loadTab(tab);
        if (window.innerWidth <= 768) $('#sidebar').classList.remove('open');
      });
    });
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#sidebarClose').addEventListener('click', () => $('#sidebar').classList.remove('open'));
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  }

  const tabTitles = { dashboard:'Dashboard', workers:'Trabajadores', products:'Productos', orders:'Pedidos', clients:'Clientes', analytics:'Analíticas', records:'Registros', settings:'Configuración' };
  const tabCache = {};
  let currentTab = 'dashboard';

  function loadTab(tab) {
    if (tab === currentTab && tabCache[tab]) return;
    
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    const el = $(`#tab-${tab}`);
    if (el) {
      el.classList.add('active');
      $('#pageTitle').textContent = tabTitles[tab] || tab;
    }
    
    currentTab = tab;
    const loaders = { dashboard: loadDashboard, workers: loadWorkers, products: loadProducts, orders: loadOrders, clients: loadClients, analytics: loadAnalytics, records: loadRecords, settings: loadSettings };
    
    // Always re-fetch on tab click (no caching to avoid stale token issues)
    if (loaders[tab]) {
      loaders[tab](el);
      tabCache[tab] = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════
  async function loadDashboard(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const [sales, orders, users, products] = await Promise.all([
        API.get('/analytics/sales').catch(() => ({ data: [] })),
        API.get('/orders?limit=100').catch(() => ({ data: [] })),
        API.get('/users').catch(() => ({ data: [] })),
        API.get('/products').catch(() => ({ data: [] })),
      ]);
      const today = sales.data?.[0] || {};
      const totalOrders = orders.data?.length || orders.orders?.length || 0;
      const allOrders = orders.data || orders.orders || [];
      const clients = (users.data || users.users || []).filter(u => u.role === 'client');
      const workers = (users.data || users.users || []).filter(u => u.role === 'worker');
      const prods = products.data || products.products || [];

      el.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><h4>${money(today.revenue || 0)}</h4><p>Ventas hoy</p></div></div>
          <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-receipt"></i></div><div class="stat-info"><h4>${today.orders || 0}</h4><p>Pedidos hoy</p></div></div>
          <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-users"></i></div><div class="stat-info"><h4>${clients.length}</h4><p>Clientes</p></div></div>
          <div class="stat-card"><div class="stat-icon red"><i class="fas fa-boxes-stacked"></i></div><div class="stat-info"><h4>${prods.length}</h4><p>Productos</p></div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
          <button class="btn btn-outline btn-sm" id="refreshDashboard"><i class="fas fa-sync-alt"></i> Actualizar</button>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-motorcycle" style="color:var(--primary);margin-right:8px;"></i> Últimos Pedidos</h3></div>
            <div class="card-body">
              ${allOrders.length === 0 ? '<div class="empty-state"><i class="fas fa-inbox"></i><p>Sin pedidos aún</p></div>' :
              `<div class="table-container"><table>
                <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>${allOrders.slice(0,8).map(o => `<tr>
                  <td><strong>${(o.id||'').slice(0,8)}...</strong></td>
                  <td>${o.client_name || '-'}</td>
                  <td>${money(o.total)}</td>
                  <td>${statusChip(o.status)}</td>
                  <td>${fmtDate(o.created_at)}</td>
                </tr>`).join('')}</tbody>
              </table></div>`}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-motorcycle" style="color:var(--accent);margin-right:8px;"></i> Trabajadores Activos</h3></div>
            <div class="card-body">
              ${workers.length === 0 ? '<div class="empty-state"><i class="fas fa-user-slash"></i><p>Sin trabajadores</p></div>' :
              workers.map(w => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-200);">
                ${avatar(w.avatar, w.name)}
                <div><strong>${w.name}</strong><br><small style="color:var(--gray-500);">${w.email}</small></div>
                <span class="chip ${w.is_active ? 'chip-active' : 'chip-inactive'}" style="margin-left:auto;">${w.is_active ? 'Activo' : 'Inactivo'}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
      `;
      // Refresh dashboard button
      const refreshBtn = document.getElementById('refreshDashboard');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          delete tabCache['dashboard'];
          loadDashboard(el);
        });
      }
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error cargando dashboard</h3><p>${err.message}</p></div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WORKERS (CRUD con búsqueda, crear, editar, eliminar)
  // ═══════════════════════════════════════════════════════════
  async function loadWorkers(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/users');
      const allUsers = res.data || res.users || [];
      const workers = allUsers.filter(u => u.role === 'worker');
      renderWorkersList(el, workers);
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  function renderWorkersList(el, workers) {
    el.innerHTML = `
      <div class="search-bar">
        <div class="search-input"><i class="fas fa-search"></i><input type="text" id="workerSearch" placeholder="Buscar trabajador por nombre o email..."></div>
        <button class="btn btn-primary" id="addWorkerBtn"><i class="fas fa-plus"></i> Agregar Trabajador</button>
      </div>
      <div class="card">
        <div class="card-body">
          ${workers.length === 0 ? '<div class="empty-state"><i class="fas fa-motorcycle"></i><h3>Sin trabajadores</h3><p>Agrega el primer trabajador</p></div>' :
          `<div class="table-container"><table>
            <thead><tr><th>Foto</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
            <tbody id="workersTableBody">${workers.map(w => `<tr data-worker-id="${w.id}">
              <td>${avatar(w.avatar, w.name)}</td>
              <td><strong>${w.name}</strong></td>
              <td>${w.email}</td>
              <td>${w.phone || '-'}</td>
              <td><span class="chip ${w.is_active ? 'chip-active' : 'chip-inactive'}">${w.is_active ? 'Activo' : 'Inactivo'}</span></td>
              <td>${fmtDate(w.created_at)}</td>
              <td><button class="btn btn-outline btn-sm edit-worker" data-id="${w.id}"><i class="fas fa-pen"></i></button></td>
            </tr>`).join('')}</tbody>
          </table></div>`}
        </div>
      </div>
    `;
    $('#workerSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      $$('#workersTableBody tr').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    $('#addWorkerBtn').addEventListener('click', () => workerForm());
    $$('.edit-worker').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = workers.find(x => x.id === btn.dataset.id);
        if (w) workerForm(w);
      });
    });
  }

  function workerForm(worker = null) {
    const isEdit = !!worker;
    openModal(isEdit ? 'Editar Trabajador' : 'Nuevo Trabajador', `
      <div class="form-group">
        <label><i class="fas fa-user"></i> Nombre completo *</label>
        <input type="text" class="form-input" id="wName" value="${worker?.name || ''}" placeholder="Carlos García" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-envelope"></i> Correo electrónico *</label>
          <input type="email" class="form-input" id="wEmail" value="${worker?.email || ''}" placeholder="carlos@delivery.com" ${isEdit ? 'readonly style="background:var(--gray-100);"' : ''} required>
        </div>
        <div class="form-group">
          <label><i class="fas fa-phone"></i> Teléfono</label>
          <input type="tel" class="form-input" id="wPhone" value="${worker?.phone || ''}" placeholder="3001234567">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-lock"></i> Contraseña ${isEdit ? '(dejar vacío para no cambiar)' : '*'}</label>
          <input type="password" class="form-input" id="wPassword" placeholder="••••••••" ${isEdit ? '' : 'required'}>
        </div>
        <div class="form-group">
          <label><i class="fas fa-image"></i> Foto de perfil</label>
          <input type="file" class="form-input" id="wPhoto" accept="image/*">
        </div>
      </div>
      ${worker?.avatar ? `<div style="margin-top:8px;"><img src="${worker.avatar}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--gray-200);"></div>` : ''}
    `, `
      ${isEdit ? `<button class="btn btn-danger" id="workerDeleteBtn"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
      <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
      <button class="btn btn-primary" id="workerSaveBtn"><i class="fas fa-check"></i> Guardar</button>
    `);

    $('#workerSaveBtn').addEventListener('click', async () => {
      const name = $('#wName').value.trim();
      const email = $('#wEmail').value.trim();
      const phone = $('#wPhone').value.trim();
      const password = $('#wPassword').value;
      if (!name || !email) { toast('Nombre y email son obligatorios', 'error'); return; }
      if (!isEdit && !password) { toast('La contraseña es obligatoria', 'error'); return; }
      try {
        const body = { name, email, phone, role: 'worker' };
        if (password) body.password = password;
        if (isEdit) {
          await API.put('/users/' + worker.id, body);
          toast('Trabajador actualizado');
        } else {
          await API.post('/users', body);
          toast('Trabajador creado');
        }
        closeModal();
        loadTab('workers');
      } catch (err) { toast(err.message, 'error'); }
    });

    if (isEdit && $('#workerDeleteBtn')) {
      $('#workerDeleteBtn').addEventListener('click', () => {
        openModal('¿Eliminar trabajador?', `<p>¿Estás seguro de eliminar a <strong>${worker.name}</strong>? Esta acción no se puede deshacer.</p>`, `
          <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
          <button class="btn btn-danger" id="confirmWorkerDelete"><i class="fas fa-trash"></i> Sí, eliminar</button>
        `);
        $('#confirmWorkerDelete').addEventListener('click', async () => {
          try { await API.delete('/users/' + worker.id); toast('Trabajador eliminado'); closeModal(); loadTab('workers'); }
          catch (err) { toast(err.message, 'error'); }
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRODUCTS (CRUD con NIT, múltiples imágenes, importar Excel)
  // ═══════════════════════════════════════════════════════════
  async function loadProducts(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const [prodRes, catRes] = await Promise.all([API.get('/products'), API.get('/categories')]);
      const products = prodRes.data || prodRes.products || [];
      const categories = catRes.data || catRes.categories || [];
      renderProductsList(el, products, categories);
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  function renderProductsList(el, products, categories) {
    el.innerHTML = `
      <div class="search-bar">
        <div class="search-input"><i class="fas fa-search"></i><input type="text" id="productSearch" placeholder="Buscar producto por nombre, NIT o categoría..."></div>
        <button class="btn btn-primary" id="addProductBtn"><i class="fas fa-plus"></i> Agregar Producto</button>
        <button class="btn btn-accent" id="importExcelBtn"><i class="fas fa-file-excel"></i> Importar Excel</button>
      </div>
      <div class="card">
        <div class="card-body">
          ${products.length === 0 ? '<div class="empty-state"><i class="fas fa-box-open"></i><h3>Sin productos</h3><p>Agrega el primer producto</p></div>' :
          `<div class="table-container"><table>
            <thead><tr><th>Imagen</th><th>Nombre</th><th>NIT</th><th>Precio</th><th>Stock</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody id="productsTableBody">${products.map(p => {
              const cat = categories.find(c => c.id === p.category_id);
              let img = p.image || '';
              if (!img && p.images) {
                try { const arr = JSON.parse(p.images); if (arr && arr.length > 0) img = arr[0]; } catch {}
              }
              return `<tr data-product-id="${p.id}">
                <td>${img ? `<img src="${img}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;">` : `<div style="width:48px;height:48px;border-radius:8px;background:var(--gray-200);display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:var(--gray-400);"></i></div>`}</td>
                <td><strong>${p.name}</strong></td>
                <td><code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:12px;">${p.nit || 'S/N'}</code></td>
                <td>${money(p.price)}</td>
                <td>${p.stock != null ? p.stock : '-'}</td>
                <td>${cat ? cat.name : '-'}</td>
                <td><span class="chip ${p.is_active ? 'chip-active' : 'chip-inactive'}">${p.is_active ? 'Activo' : 'Inactivo'}</span></td>
                <td><button class="btn btn-outline btn-sm edit-product" data-id="${p.id}"><i class="fas fa-pen"></i></button></td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>`}
        </div>
      </div>
    `;
    $('#productSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      $$('#productsTableBody tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    $('#addProductBtn').addEventListener('click', () => productForm(null, categories));
    $('#importExcelBtn').addEventListener('click', importExcel);
    $$('.edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = products.find(x => x.id === btn.dataset.id);
        if (p) productForm(p, categories);
      });
    });
  }

  function productForm(product = null, categories = []) {
    const isEdit = !!product;
    const existingImages = isEdit ? JSON.parse(product.images || '[]') : [];
    openModal(isEdit ? 'Editar Producto' : 'Nuevo Producto', `
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-tag"></i> Nombre del producto *</label>
          <input type="text" class="form-input" id="pName" value="${product?.name || ''}" required>
        </div>
        <div class="form-group">
          <label><i class="fas fa-barcode"></i> NIT del producto *</label>
          <input type="text" class="form-input" id="pNIT" value="${product?.nit || ''}" placeholder="Ej: 900123456-7" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-dollar-sign"></i> Precio *</label>
          <input type="number" class="form-input" id="pPrice" value="${product?.price || ''}" min="0" step="100" required>
        </div>
        <div class="form-group">
          <label><i class="fas fa-cubes"></i> Stock</label>
          <input type="number" class="form-input" id="pStock" value="${product?.stock || 0}" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-layer-group"></i> Categoría</label>
          <select class="form-select" id="pCategory">
            <option value="">Sin categoría</option>
            ${categories.map(c => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label><i class="fas fa-percent"></i> Precio de oferta</label>
          <input type="number" class="form-input" id="pOfferPrice" value="${product?.offer_price || ''}" min="0">
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-image"></i> Imagen de portada</label>
        <input type="file" class="form-input" id="pImage" accept="image/*">
        ${product?.image ? `<div style="margin-top:8px;"><img src="${product.image}" style="width:80px;height:80px;border-radius:8px;object-fit:cover;border:2px solid var(--gray-200);"></div>` : ''}
      </div>
      <div class="form-group">
        <label><i class="fas fa-images"></i> Imágenes adicionales (opcional)</label>
        <input type="file" class="form-input" id="pImages" accept="image/*" multiple>
        <div class="image-preview" id="existingImages">${existingImages.map((img, i) => `<div class="remove-img"><img src="${img}"></div>`).join('')}</div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-toggle-on"></i> Estado</label>
        <select class="form-select" id="pActive">
          <option value="1" ${product?.is_active !== 0 ? 'selected' : ''}>Activo</option>
          <option value="0" ${product?.is_active === 0 ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>
    `, `
      ${isEdit ? `<button class="btn btn-danger" id="productDeleteBtn"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
      <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
      <button class="btn btn-primary" id="productSaveBtn"><i class="fas fa-check"></i> Guardar</button>
    `);

    $('#productSaveBtn').addEventListener('click', async () => {
      const name = $('#pName').value.trim();
      const nit = $('#pNIT').value.trim();
      const price = parseFloat($('#pPrice').value);
      if (!name || !price) { toast('Nombre y precio son obligatorios', 'error'); return; }
      try {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('nit', nit);
        fd.append('price', price);
        fd.append('stock', $('#pStock').value || 0);
        fd.append('category_id', $('#pCategory').value || '');
        fd.append('offer_price', $('#pOfferPrice').value || '');
        fd.append('is_active', $('#pActive').value);
        const imgFile = $('#pImage').files[0];
        if (imgFile) fd.append('image', imgFile);
        const imgsFiles = $('#pImages').files;
        for (let i = 0; i < imgsFiles.length; i++) fd.append('images', imgsFiles[i]);

        if (isEdit) {
          await API.upload('/products/' + product.id + '?_method=PUT', fd);
          toast('Producto actualizado');
        } else {
          await API.upload('/products', fd);
          toast('Producto creado');
        }
        closeModal();
        loadTab('products');
      } catch (err) { toast(err.message, 'error'); }
    });

    if (isEdit && $('#productDeleteBtn')) {
      $('#productDeleteBtn').addEventListener('click', () => {
        openModal('¿Eliminar producto?', `<p>¿Estás seguro de eliminar <strong>${product.name}</strong>? Esta acción no se puede deshacer.</p>`, `
          <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
          <button class="btn btn-danger" id="confirmProductDelete"><i class="fas fa-trash"></i> Sí, eliminar</button>
        `);
        $('#confirmProductDelete').addEventListener('click', async () => {
          try { await API.delete('/products/' + product.id); toast('Producto eliminado'); closeModal(); loadTab('products'); }
          catch (err) { toast(err.message, 'error'); }
        });
      });
    }
  }

  function importExcel() {
    openModal('Importar productos desde Excel', `
      <div class="image-upload-area" id="excelDropZone">
        <i class="fas fa-file-excel"></i>
        <p>Arrastra un archivo .xlsx aquí o haz clic para seleccionar</p>
        <input type="file" id="excelFileInput" accept=".xlsx,.xls,.csv" style="display:none;">
      </div>
      <div id="excelPreview" style="margin-top:16px;"></div>
      <div style="margin-top:12px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:12px;color:var(--gray-600);">
        <strong>Formato esperado:</strong> Nombre | NIT | Precio | Stock | Categoría (cada fila es un producto)
      </div>
    `, `
      <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
      <button class="btn btn-accent" id="importExcelConfirm" disabled><i class="fas fa-upload"></i> Importar</button>
    `);

    const dropZone = $('#excelDropZone');
    const fileInput = $('#excelFileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = ''; handleExcelFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleExcelFile(fileInput.files[0]); });

    let excelData = null;
    function handleExcelFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          excelData = data.slice(1).filter(row => row[0]);
          $('#excelPreview').innerHTML = `
            <p style="font-size:13px;color:var(--success);"><i class="fas fa-check-circle"></i> ${excelData.length} productos encontrados</p>
            <div class="table-container" style="max-height:200px;overflow-y:auto;margin-top:8px;">
              <table><thead><tr><th>Nombre</th><th>NIT</th><th>Precio</th><th>Stock</th></tr></thead>
              <tbody>${excelData.slice(0,10).map(r => `<tr><td>${r[0]||''}</td><td>${r[1]||''}</td><td>${money(r[2])}</td><td>${r[3]||0}</td></tr>`).join('')}</tbody></table>
            </div>
          `;
          $('#importExcelConfirm').disabled = false;
        } catch (err) { toast('Error leyendo archivo: ' + err.message, 'error'); }
      };
      reader.readAsBinaryString(file);
    }

    $('#importExcelConfirm')?.addEventListener('click', async () => {
      if (!excelData) return;
      let imported = 0;
      for (const row of excelData) {
        try {
          await API.post('/products', { name: row[0], nit: String(row[1]||''), price: Number(row[2]||0), stock: Number(row[3]||0) });
          imported++;
        } catch {}
      }
      toast(`${imported} productos importados exitosamente`);
      closeModal();
      loadTab('products');
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════
  async function loadOrders(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/orders?limit=200');
      const orders = res.data || res.orders || [];
      el.innerHTML = `
        <div class="search-bar">
          <div class="search-input"><i class="fas fa-search"></i><input type="text" id="orderSearch" placeholder="Buscar por ID, cliente o estado..."></div>
          <select class="form-select" id="orderFilter" style="width:auto;min-width:160px;">
            <option value="">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmados</option>
            <option value="preparing">Preparando</option>
            <option value="delivering">Entregando</option>
            <option value="delivered">Entregados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
        <div class="card">
          <div class="card-body">
            ${orders.length === 0 ? '<div class="empty-state"><i class="fas fa-inbox"></i><h3>Sin pedidos</h3></div>' :
            `<div class="table-container"><table>
              <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Repartidor</th><th>Fecha</th><th>Acciones</th></tr></thead>
              <tbody id="ordersTableBody">${orders.map(o => `<tr>
                <td><strong>${(o.id||'').slice(0,8)}...</strong></td>
                <td>${o.client_name || '-'}</td>
                <td>${money(o.total)}</td>
                <td>${statusChip(o.status)}</td>
                <td>${o.worker_name || '-'}</td>
                <td>${fmtDate(o.created_at)}</td>
                <td><button class="btn btn-outline btn-sm view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button></td>
              </tr>`).join('')}</tbody>
            </table></div>`}
          </div>
        </div>
      `;
      $('#orderSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        $$('#ordersTableBody tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
      });
      $('#orderFilter').addEventListener('change', (e) => {
        const f = e.target.value;
        $$('#ordersTableBody tr').forEach(tr => {
          if (!f) { tr.style.display = ''; return; }
          tr.style.display = tr.innerHTML.includes(`chip-${f}`) ? '' : 'none';
        });
      });
      $$('.view-order').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const res = await API.get('/orders/' + btn.dataset.id);
            const o = res.data || res;
            openModal('Detalle del Pedido', `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div><strong>ID:</strong><br>${o.id}</div>
                <div><strong>Estado:</strong><br>${statusChip(o.status)}</div>
                <div><strong>Cliente:</strong><br>${o.client_name || '-'}</div>
                <div><strong>Teléfono:</strong><br>${o.client_phone || '-'}</div>
                <div><strong>Repartidor:</strong><br>${o.worker_name || 'Sin asignar'}</div>
                <div><strong>Total:</strong><br>${money(o.total)}</div>
                <div><strong>Dirección:</strong><br>${o.delivery_address || '-'}</div>
                <div><strong>Fecha:</strong><br>${fmtDateTime(o.created_at)}</div>
              </div>
              ${o.items ? `<div style="margin-top:16px;"><strong>Items:</strong><pre style="font-size:12px;background:var(--gray-50);padding:8px;border-radius:6px;overflow-x:auto;">${
                (() => { try { return JSON.stringify(JSON.parse(o.items), null, 2); } catch { return o.items; } })()
              }</pre></div>` : ''}
            `);
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CLIENTS (CRUD con bloqueo y eliminación)
  // ═══════════════════════════════════════════════════════════
  async function loadClients(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/users');
      const allUsers = res.data || res.users || [];
      const clients = allUsers.filter(u => u.role === 'client');
      renderClientsList(el, clients);
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  function renderClientsList(el, clients) {
    el.innerHTML = `
      <div class="search-bar">
        <div class="search-input"><i class="fas fa-search"></i><input type="text" id="clientSearch" placeholder="Buscar cliente por nombre o email..."></div>
        <button class="btn btn-primary" id="addClientBtn"><i class="fas fa-plus"></i> Agregar Cliente</button>
      </div>
      <div class="card">
        <div class="card-body">
          ${clients.length === 0 ? '<div class="empty-state"><i class="fas fa-users"></i><h3>Sin clientes</h3></div>' :
          `<div class="table-container"><table>
            <thead><tr><th>Foto</th><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Estado</th><th>Registro</th><th>Acciones</th></tr></thead>
            <tbody id="clientsTableBody">${clients.map(c => `<tr data-client-id="${c.id}">
              <td>${avatar(c.avatar, c.name)}</td>
              <td><strong>${c.name}</strong></td>
              <td>${c.email}</td>
              <td>${c.phone || '-'}</td>
              <td><span class="chip ${c.is_active ? 'chip-active' : 'chip-inactive'}">${c.is_active ? 'Activo' : 'Bloqueado'}</span></td>
              <td>${fmtDate(c.created_at)}</td>
              <td style="display:flex;gap:6px;">
                <button class="btn btn-outline btn-sm edit-client" data-id="${c.id}"><i class="fas fa-pen"></i></button>
                <button class="btn btn-outline btn-sm toggle-client" data-id="${c.id}" data-active="${c.is_active}" title="${c.is_active ? 'Bloquear' : 'Activar'}">
                  <i class="fas fa-${c.is_active ? 'ban' : 'check'}"></i>
                </button>
                <button class="btn btn-outline btn-sm delete-client" data-id="${c.id}" data-name="${c.name}" style="color:var(--danger);"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`).join('')}</tbody>
          </table></div>`}
        </div>
      </div>
    `;
    $('#clientSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      $$('#clientsTableBody tr').forEach(tr => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
    $('#addClientBtn').addEventListener('click', () => clientForm());
    $$('.edit-client').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = clients.find(x => x.id === btn.dataset.id);
        if (c) clientForm(c);
      });
    });
    $$('.toggle-client').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.put('/users/' + btn.dataset.id, { is_active: btn.dataset.active === '1' ? 0 : 1 });
          toast('Estado actualizado');
          loadTab('clients');
        } catch (err) { toast(err.message, 'error'); }
      });
    });
    $$('.delete-client').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal('¿Eliminar cliente?', `<p>¿Estás seguro de eliminar a <strong>${btn.dataset.name}</strong>? Esta acción no se puede deshacer.</p>`, `
          <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
          <button class="btn btn-danger" id="confirmClientDelete"><i class="fas fa-trash"></i> Sí, eliminar</button>
        `);
        $('#confirmClientDelete').addEventListener('click', async () => {
          try { await API.delete('/users/' + btn.dataset.id); toast('Cliente eliminado'); closeModal(); loadTab('clients'); }
          catch (err) { toast(err.message, 'error'); }
        });
      });
    });
  }

  function clientForm(client = null) {
    const isEdit = !!client;
    openModal(isEdit ? 'Editar Cliente' : 'Nuevo Cliente', `
      <div class="form-group">
        <label><i class="fas fa-user"></i> Nombre completo *</label>
        <input type="text" class="form-input" id="cName" value="${client?.name || ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label><i class="fas fa-envelope"></i> Email *</label>
          <input type="email" class="form-input" id="cEmail" value="${client?.email || ''}" ${isEdit ? 'readonly style="background:var(--gray-100);"' : ''} required>
        </div>
        <div class="form-group">
          <label><i class="fas fa-phone"></i> Teléfono</label>
          <input type="tel" class="form-input" id="cPhone" value="${client?.phone || ''}">
        </div>
      </div>
      <div class="form-group">
        <label><i class="fas fa-lock"></i> Contraseña ${isEdit ? '(dejar vacío para no cambiar)' : '*'}</label>
        <input type="password" class="form-input" id="cPassword" ${isEdit ? '' : 'required'}>
      </div>
    `, `
      <button class="btn btn-outline" onclick="document.getElementById('modalOverlay').style.display='none'">Cancelar</button>
      <button class="btn btn-primary" id="clientSaveBtn"><i class="fas fa-check"></i> Guardar</button>
    `);

    $('#clientSaveBtn').addEventListener('click', async () => {
      const name = $('#cName').value.trim();
      const email = $('#cEmail').value.trim();
      const phone = $('#cPhone').value.trim();
      const password = $('#cPassword').value;
      if (!name || !email) { toast('Nombre y email obligatorios', 'error'); return; }
      try {
        const body = { name, email, phone, role: 'client' };
        if (password) body.password = password;
        if (isEdit) { await API.put('/users/' + client.id, body); toast('Cliente actualizado'); }
        else { await API.post('/users', body); toast('Cliente creado'); }
        closeModal(); loadTab('clients');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYTICS (sub-pestañas con gráficas circulares SVG)
  // ═══════════════════════════════════════════════════════════
  async function loadAnalytics(el) {
    el.innerHTML = `
      <div class="sub-tabs" id="analyticsTabs">
        <button class="sub-tab active" data-sub="sales">Ventas</button>
        <button class="sub-tab" data-sub="products">Productos</button>
        <button class="sub-tab" data-sub="clients">Clientes</button>
        <button class="sub-tab" data-sub="workers">Trabajadores</button>
      </div>
      <div id="analyticsContent"><div class="spinner"></div></div>
    `;
    $$('#analyticsTabs .sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('#analyticsTabs .sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadAnalyticsSub(tab.dataset.sub);
      });
    });
    loadAnalyticsSub('sales');
  }

  async function loadAnalyticsSub(sub) {
    const content = $('#analyticsContent');
    content.innerHTML = '<div class="spinner"></div>';
    try {
      if (sub === 'sales') {
        const [sales, orders] = await Promise.all([API.get('/analytics/sales'), API.get('/orders?limit=1000')]);
        const salesData = sales.data || [];
        const allOrders = orders.data || orders.orders || [];
        const delivered = allOrders.filter(o => o.status === 'delivered');
        const cancelled = allOrders.filter(o => o.status === 'cancelled');
        const totalRevenue = salesData.reduce((s, d) => s + (d.revenue || 0), 0);
        const totalOrders = salesData.reduce((s, d) => s + (d.orders || 0), 0);

        const statusCounts = {};
        allOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
        const pieData = Object.entries(statusCounts).map(([k, v]) => ({ label: k, value: v }));

        content.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-dollar-sign"></i></div><div class="stat-info"><h4>${money(totalRevenue)}</h4><p>Ingresos totales</p></div></div>
            <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-receipt"></i></div><div class="stat-info"><h4>${totalOrders}</h4><p>Pedidos totales</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-check-circle"></i></div><div class="stat-info"><h4>${delivered.length}</h4><p>Entregados</p></div></div>
            <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times-circle"></i></div><div class="stat-info"><h4>${cancelled.length}</h4><p>Cancelados</p></div></div>
          </div>
          <div class="grid-2">
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:8px;"></i> Distribución por Estado</div>
              ${renderPieChart(pieData)}
            </div>
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-chart-line" style="color:var(--accent);margin-right:8px;"></i> Ventas por Día</div>
              <div class="table-container">
                <table><thead><tr><th>Fecha</th><th>Pedidos</th><th>Ingresos</th></tr></thead>
                <tbody>${salesData.map(d => `<tr><td>${fmtDate(d.period)}</td><td>${d.orders}</td><td>${money(d.revenue)}</td></tr>`).join('')}</tbody></table>
              </div>
            </div>
          </div>
        `;
      } else if (sub === 'products') {
        const [prodRes, catRes] = await Promise.all([API.get('/products'), API.get('/categories')]);
        const products = prodRes.data || prodRes.products || [];
        const categories = catRes.data || catRes.categories || [];
        const catCounts = {};
        products.forEach(p => {
          const catName = categories.find(c => c.id === p.category_id)?.name || 'Sin categoría';
          catCounts[catName] = (catCounts[catName] || 0) + 1;
        });
        const pieData = Object.entries(catCounts).map(([k, v]) => ({ label: k, value: v }));
        const topProducts = [...products].sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 10);
        content.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-boxes-stacked"></i></div><div class="stat-info"><h4>${products.length}</h4><p>Total productos</p></div></div>
            <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-layer-group"></i></div><div class="stat-info"><h4>${categories.length}</h4><p>Categorías</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-check-circle"></i></div><div class="stat-info"><h4>${products.filter(p => p.is_active).length}</h4><p>Activos</p></div></div>
            <div class="stat-card"><div class="stat-icon red"><i class="fas fa-exclamation-triangle"></i></div><div class="stat-info"><h4>${products.filter(p => p.stock <= (p.stock_min || 5)).length}</h4><p>Stock bajo</p></div></div>
          </div>
          <div class="grid-2">
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:8px;"></i> Productos por Categoría</div>
              ${renderPieChart(pieData)}
            </div>
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-box" style="color:var(--accent);margin-right:8px;"></i> Top 10 por Stock</div>
              <div class="table-container">
                <table><thead><tr><th>Producto</th><th>Stock</th><th>Precio</th></tr></thead>
                <tbody>${topProducts.map(p => `<tr><td>${p.name}</td><td>${p.stock}</td><td>${money(p.price)}</td></tr>`).join('')}</tbody></table>
              </div>
            </div>
          </div>
        `;
      } else if (sub === 'clients') {
        const [usersRes, ordersRes] = await Promise.all([API.get('/users'), API.get('/orders?limit=1000')]);
        const users = (usersRes.data || usersRes.users || []).filter(u => u.role === 'client');
        const allOrders = ordersRes.data || ordersRes.orders || [];
        const clientOrders = {};
        allOrders.forEach(o => {
          const cid = o.user_id;
          if (!clientOrders[cid]) clientOrders[cid] = { count: 0, total: 0 };
          clientOrders[cid].count++;
          clientOrders[cid].total += o.total || 0;
        });
        const topClients = users.map(u => ({ ...u, ...(clientOrders[u.id] || { count: 0, total: 0 }) })).sort((a, b) => b.total - a.total).slice(0, 10);
        const activeCount = users.filter(u => u.is_active).length;
        const inactiveCount = users.length - activeCount;
        content.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-users"></i></div><div class="stat-info"><h4>${users.length}</h4><p>Total clientes</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-user-check"></i></div><div class="stat-info"><h4>${activeCount}</h4><p>Activos</p></div></div>
            <div class="stat-card"><div class="stat-icon red"><i class="fas fa-user-slash"></i></div><div class="stat-info"><h4>${inactiveCount}</h4><p>Bloqueados</p></div></div>
          </div>
          <div class="grid-2">
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:8px;"></i> Estado de Clientes</div>
              ${renderPieChart([{ label: 'Activos', value: activeCount }, { label: 'Bloqueados', value: inactiveCount }])}
            </div>
            <div class="chart-container">
              <div class="chart-title"><i class="fas fa-trophy" style="color:var(--accent);margin-right:8px;"></i> Top Clientes por Compras</div>
              <div class="table-container">
                <table><thead><tr><th>Cliente</th><th>Pedidos</th><th>Total</th></tr></thead>
                <tbody>${topClients.map(c => `<tr><td>${c.name}</td><td>${c.count}</td><td>${money(c.total)}</td></tr>`).join('')}</tbody></table>
              </div>
            </div>
          </div>
        `;
      } else if (sub === 'workers') {
        const [usersRes, ordersRes] = await Promise.all([API.get('/users'), API.get('/orders?limit=1000')]);
        const workers = (usersRes.data || usersRes.users || []).filter(u => u.role === 'worker');
        const allOrders = ordersRes.data || ordersRes.orders || [];
        const workerStats = {};
        allOrders.forEach(o => {
          if (o.worker_id) {
            if (!workerStats[o.worker_id]) workerStats[o.worker_id] = { delivered: 0, active: 0 };
            if (o.status === 'delivered') workerStats[o.worker_id].delivered++;
            else workerStats[o.worker_id].active++;
          }
        });
        const workerList = workers.map(w => ({ ...w, ...(workerStats[w.id] || { delivered: 0, active: 0 }) }));
        const deliveredCount = allOrders.filter(o => o.status === 'delivered').length;
        const deliveringCount = allOrders.filter(o => ['in_transit','delivering'].includes(o.status)).length;
        content.innerHTML = `
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon green"><i class="fas fa-motorcycle"></i></div><div class="stat-info"><h4>${workers.length}</h4><p>Trabajadores</p></div></div>
            <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-truck"></i></div><div class="stat-info"><h4>${deliveringCount}</h4><p>En entrega</p></div></div>
            <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-check-double"></i></div><div class="stat-info"><h4>${deliveredCount}</h4><p>Entregas completadas</p></div></div>
          </div>
          <div class="card"><div class="card-header"><h3>Rendimiento de Trabajadores</h3></div><div class="card-body">
            <div class="table-container"><table>
              <thead><tr><th>Trabajador</th><th>Entregas</th><th>Activas</th><th>Estado</th></tr></thead>
              <tbody>${workerList.map(w => `<tr><td>${w.name}</td><td>${w.delivered}</td><td>${w.active}</td><td><span class="chip ${w.is_active ? 'chip-active' : 'chip-inactive'}">${w.is_active ? 'Activo' : 'Inactivo'}</span></td></tr>`).join('')}</tbody>
            </table></div>
          </div></div>
        `;
      }
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  function renderPieChart(data) {
    if (!data.length) return '<div class="empty-state"><p>Sin datos</p></div>';
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return '<div class="empty-state"><p>Sin datos</p></div>';
    const colors = ['#00B860', '#FF8C00', '#1E88E5', '#E53935', '#FFB300', '#7B1FA2', '#00ACC1', '#8D6E63'];
    let cumulative = 0;
    const gradientParts = data.map((d, i) => {
      const start = (cumulative / total) * 360;
      cumulative += d.value;
      const end = (cumulative / total) * 360;
      return `${colors[i % colors.length]} ${start}deg ${end}deg`;
    });
    return `
      <div class="pie-chart" style="background: conic-gradient(${gradientParts.join(',')});"></div>
      <div class="pie-legend">
        ${data.map((d, i) => `<div class="pie-legend-item"><div class="pie-legend-dot" style="background:${colors[i % colors.length]};"></div>${d.label}: ${d.value} (${Math.round(d.value/total*100)}%)</div>`).join('')}
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // RECORDS (Exportación PDF/Excel/CSV — Ventas, Ganancias, DIAN, Inventario)
  // ═══════════════════════════════════════════════════════════
  function loadRecords(el) {
    el.innerHTML = `
      <div class="records-grid">
        <div class="record-card" id="exportSalesPDF">
          <i class="fas fa-file-pdf" style="color:#E53935;"></i>
          <h4>Ventas en PDF</h4>
          <p>Exportar registro de ventas del período seleccionado</p>
        </div>
        <div class="record-card" id="exportProfitsPDF">
          <i class="fas fa-chart-line" style="color:#00B860;"></i>
          <h4>Ganancias en PDF</h4>
          <p>Reporte de ganancias para juntas empresariales</p>
        </div>
        <div class="record-card" id="exportDIAN">
          <i class="fas fa-file-invoice" style="color:#1E88E5;"></i>
          <h4>Registro DIAN</h4>
          <p>Documentación oficial para la DIAN</p>
        </div>
        <div class="record-card" id="exportInventory">
          <i class="fas fa-boxes-stacked" style="color:#FF8C00;"></i>
          <h4>Inventario</h4>
          <p>Listado completo de productos con stock</p>
        </div>
        <div class="record-card" id="exportClients">
          <i class="fas fa-users" style="color:#7B1FA2;"></i>
          <h4>Clientes</h4>
          <p>Base de datos de clientes registrados</p>
        </div>
        <div class="record-card" id="exportWorkers">
          <i class="fas fa-motorcycle" style="color:#00ACC1;"></i>
          <h4>Trabajadores</h4>
          <p>Listado de repartidores y su rendimiento</p>
        </div>
      </div>
      <div style="margin-top:24px;" class="card">
        <div class="card-header"><h3><i class="fas fa-calendar" style="color:var(--primary);margin-right:8px;"></i> Seleccionar Período</h3></div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label>Fecha inicio</label>
              <input type="date" class="form-input" id="recordDateFrom" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Fecha fin</label>
              <input type="date" class="form-input" id="recordDateTo" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;" class="card">
        <div class="card-header"><h3><i class="fas fa-download" style="color:var(--accent);margin-right:8px;"></i> Formatos de Exportación</h3></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--gray-600);margin-bottom:12px;">Todos los reportes se pueden exportar en:</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="chip chip-active"><i class="fas fa-file-pdf"></i> PDF</span>
            <span class="chip chip-confirmed"><i class="fas fa-file-excel"></i> Excel</span>
            <span class="chip chip-preparing"><i class="fas fa-file-csv"></i> CSV</span>
          </div>
        </div>
      </div>
    `;

    // Date range
    const getDateRange = () => ({
      from: $('#recordDateFrom').value,
      to: $('#recordDateTo').value
    });

    // Export handlers
    $('#exportSalesPDF').addEventListener('click', () => exportReport('sales', 'pdf', getDateRange()));
    $('#exportProfitsPDF').addEventListener('click', () => exportReport('profits', 'pdf', getDateRange()));
    $('#exportDIAN').addEventListener('click', () => exportReport('dian', 'pdf', getDateRange()));
    $('#exportInventory').addEventListener('click', () => exportReport('inventory', 'pdf', getDateRange()));
    $('#exportClients').addEventListener('click', () => exportReport('clients', 'pdf', getDateRange()));
    $('#exportWorkers').addEventListener('click', () => exportReport('workers', 'pdf', getDateRange()));
  }

  async function exportReport(type, format, dateRange) {
    toast('Generando reporte...', 'warning');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 184, 96);
      doc.text('SupermercadosGo', 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Reporte: ${type.toUpperCase()} | Período: ${dateRange.from} al ${dateRange.to}`, 14, 28);
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 34);
      doc.setDrawColor(0, 184, 96);
      doc.line(14, 37, 196, 37);

      if (type === 'sales') {
        const res = await API.get('/analytics/sales');
        const data = res.data || [];
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text('Registro de Ventas', 14, 45);
        doc.autoTable({
          startY: 50,
          head: [['Fecha', 'Pedidos', 'Subtotal', 'Envíos', 'Descuentos', 'Ingresos']],
          body: data.map(d => [d.period, d.orders, money(d.subtotal), money(d.delivery_fees), money(d.discounts), money(d.revenue)]),
          theme: 'grid',
          headStyles: { fillColor: [0, 184, 96] },
        });
      } else if (type === 'profits') {
        const res = await API.get('/analytics/sales');
        const data = res.data || [];
        doc.setFontSize(14);
        doc.text('Reporte de Ganancias', 14, 45);
        doc.autoTable({
          startY: 50,
          head: [['Fecha', 'Ingresos', 'Costos Estimados', 'Ganancia Neta']],
          body: data.map(d => [d.period, money(d.revenue), money(Math.round(d.revenue * 0.6)), money(Math.round(d.revenue * 0.4))]),
          theme: 'grid',
          headStyles: { fillColor: [0, 184, 96] },
        });
      } else if (type === 'dian') {
        const res = await API.get('/analytics/sales');
        const data = res.data || [];
        doc.setFontSize(14);
        doc.text('Registro para DIAN', 14, 45);
        doc.setFontSize(8);
        doc.text('NIT: [Número de Identificación Tributaria]', 14, 52);
        doc.text('Razón Social: SupermercadosGo S.A.S.', 14, 57);
        doc.text('Dirección: Cúcuta, Norte de Santander, Colombia', 14, 62);
        doc.autoTable({
          startY: 67,
          head: [['Fecha', 'Pedidos', 'Subtotal', 'IVA', 'Total con IVA']],
          body: data.map(d => [d.period, d.orders, money(d.subtotal), money(d.taxes), money(d.subtotal + d.taxes)]),
          theme: 'grid',
          headStyles: { fillColor: [30, 136, 229] },
        });
      } else if (type === 'inventory') {
        const res = await API.get('/products');
        const data = res.data || res.products || [];
        doc.setFontSize(14);
        doc.text('Inventario de Productos', 14, 45);
        doc.autoTable({
          startY: 50,
          head: [['Nombre', 'NIT', 'Precio', 'Stock', 'Estado']],
          body: data.map(p => [p.name, p.nit || 'S/N', money(p.price), p.stock ?? '-', p.is_active ? 'Activo' : 'Inactivo']),
          theme: 'grid',
          headStyles: { fillColor: [255, 140, 0] },
        });
      } else if (type === 'clients') {
        const res = await API.get('/users');
        const data = (res.data || res.users || []).filter(u => u.role === 'client');
        doc.setFontSize(14);
        doc.text('Base de Datos de Clientes', 14, 45);
        doc.autoTable({
          startY: 50,
          head: [['Nombre', 'Email', 'Teléfono', 'Estado', 'Registro']],
          body: data.map(c => [c.name, c.email, c.phone || '-', c.is_active ? 'Activo' : 'Bloqueado', fmtDate(c.created_at)]),
          theme: 'grid',
          headStyles: { fillColor: [123, 31, 162] },
        });
      } else if (type === 'workers') {
        const res = await API.get('/users');
        const data = (res.data || res.users || []).filter(u => u.role === 'worker');
        doc.setFontSize(14);
        doc.text('Listado de Trabajadores', 14, 45);
        doc.autoTable({
          startY: 50,
          head: [['Nombre', 'Email', 'Teléfono', 'Estado', 'Registro']],
          body: data.map(w => [w.name, w.email, w.phone || '-', w.is_active ? 'Activo' : 'Inactivo', fmtDate(w.created_at)]),
          theme: 'grid',
          headStyles: { fillColor: [0, 172, 193] },
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`SupermercadosGo — Página ${i} de ${pageCount} — Documento generado automáticamente`, 14, doc.internal.pageSize.height - 10);
      }

      doc.save(`SupermercadosGo_${type}_${dateRange.from}_${dateRange.to}.pdf`);
      toast('Reporte exportado exitosamente');
    } catch (err) {
      toast('Error generando reporte: ' + err.message, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════
  async function loadSettings(el) {
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await API.get('/settings');
      const s = res.data || res.settings || {};
      el.innerHTML = `
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-gear" style="color:var(--primary);margin-right:8px;"></i> Configuración del Negocio</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label><i class="fas fa-store"></i> Nombre del negocio</label>
              <input type="text" class="form-input" id="sName" value="${s.business_name || s.name || 'SupermercadosGo'}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label><i class="fas fa-phone"></i> Teléfono</label>
                <input type="tel" class="form-input" id="sPhone" value="${s.phone || ''}">
              </div>
              <div class="form-group">
                <label><i class="fas fa-envelope"></i> Email</label>
                <input type="email" class="form-input" id="sEmail" value="${s.email || ''}">
              </div>
            </div>
            <div class="form-group">
              <label><i class="fas fa-map-marker-alt"></i> Dirección</label>
              <input type="text" class="form-input" id="sAddress" value="${s.address || ''}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label><i class="fas fa-dollar-sign"></i> Tarifa de envío</label>
                <input type="number" class="form-input" id="sDeliveryFee" value="${s.delivery_fee || 5000}" min="0">
              </div>
              <div class="form-group">
                <label><i class="fas fa-truck"></i> Envío gratis desde</label>
                <input type="number" class="form-input" id="sFreeMin" value="${s.free_delivery_min || 50000}" min="0">
              </div>
            </div>
            <div class="form-group">
              <label><i class="fas fa-clock"></i> Horario</label>
              <input type="text" class="form-input" id="sHours" value="${s.hours || '6:00 AM - 9:00 PM'}">
            </div>
            <button class="btn btn-primary" id="saveSettings"><i class="fas fa-save"></i> Guardar Configuración</button>
          </div>
        </div>
      `;
      $('#saveSettings').addEventListener('click', async () => {
        try {
          await API.put('/settings', {
            business_name: $('#sName').value,
            phone: $('#sPhone').value,
            email: $('#sEmail').value,
            address: $('#sAddress').value,
            delivery_fee: Number($('#sDeliveryFee').value),
            free_delivery_min: Number($('#sFreeMin').value),
            hours: $('#sHours').value
          });
          toast('Configuración guardada');
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
    }
  }

  // ─── Init ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNav();
    
    // Ver Tienda button - opens store in new tab
    const viewStoreBtn = document.getElementById('viewStoreBtn');
    if (viewStoreBtn) {
      viewStoreBtn.addEventListener('click', () => {
        window.open('/', '_blank');
      });
    }
  });
})();
