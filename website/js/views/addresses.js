/* website/js/views/addresses.js — Vista "Mis Direcciones" (CRUD) */
(function () {
  'use strict';

  function addressFormHTML(a = {}) {
    return `
      <div class="form-group">
        <label class="form-label">Etiqueta (ej: Casa, Trabajo)</label>
        <input type="text" class="form-input" id="addrLabel" value="${a.label || ''}" placeholder="Casa">
      </div>
      <div class="form-group">
        <label class="form-label">Direccion completa *</label>
        <input type="text" class="form-input" id="addrAddress" value="${a.address || ''}" placeholder="Cra 5 # 12-34">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Barrio</label>
          <input type="text" class="form-input" id="addrNeighborhood" value="${a.neighborhood || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Referencia</label>
          <input type="text" class="form-input" id="addrDetail" value="${a.detail || ''}">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px;">
        <input type="checkbox" id="addrIsDefault" ${a.is_default ? 'checked' : ''}> Usar como dirección predeterminada
      </label>
    `;
  }

  function readAddressForm() {
    return {
      label: document.getElementById('addrLabel').value.trim() || null,
      address: document.getElementById('addrAddress').value.trim(),
      neighborhood: document.getElementById('addrNeighborhood').value.trim() || null,
      detail: document.getElementById('addrDetail').value.trim() || null,
      is_default: document.getElementById('addrIsDefault').checked,
    };
  }

  async function renderAddresses(container) {
    if (!Auth.requireAuth()) return;

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-map-marker-alt" style="color:var(--green);"></i> Mis Direcciones</h1>
        </div>
        <div class="checkout-card mb-2">
          <h3>Agregar Nueva Dirección</h3>
          <div id="addrNewForm">${addressFormHTML()}</div>
          <button class="btn btn-primary mt-2" id="addrCreateBtn"><i class="fas fa-plus"></i> Guardar Dirección</button>
        </div>
        <div id="addressesList"></div>
      </div>
    `;

    document.getElementById('addrCreateBtn').addEventListener('click', async function () {
      const data = readAddressForm();
      if (!data.address) { App.toast('La dirección es obligatoria', 'error'); return; }
      this.disabled = true;
      try {
        await Addresses.create(data);
        App.toast('Dirección guardada');
        renderAddresses(container);
      } catch (err) {
        this.disabled = false;
        App.toast(err.message, 'error');
      }
    });

    await Addresses.load();
    renderList();

    function renderList() {
      const list = Addresses.getAll();
      const listEl = document.getElementById('addressesList');
      if (list.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><i class="fas fa-map-marker-alt"></i><p>No tienes direcciones guardadas todavia</p></div>`;
        return;
      }
      listEl.innerHTML = list.map(a => `
        <div class="checkout-card mb-2" data-address-id="${a.id}">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <strong>${a.label || 'Dirección'}</strong> ${a.is_default ? '<span class="status-chip confirmed">Predeterminada</span>' : ''}
              <p style="font-size:13px;color:var(--gray-600);margin-top:4px;">${a.address}${a.neighborhood ? ', ' + a.neighborhood : ''}</p>
              ${a.detail ? `<p style="font-size:12px;color:var(--gray-400);">${a.detail}</p>` : ''}
            </div>
            <button class="btn btn-outline btn-sm addr-delete-btn" data-id="${a.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.addr-delete-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Eliminar esta dirección?')) return;
          try {
            await Addresses.remove(this.dataset.id);
            App.toast('Dirección eliminada', 'warning');
            renderList();
          } catch (err) {
            App.toast(err.message, 'error');
          }
        });
      });
    }
  }

  window.Views = window.Views || {};
  window.Views.renderAddresses = renderAddresses;
})();
