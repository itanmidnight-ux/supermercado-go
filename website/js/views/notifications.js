/* website/js/views/notifications.js — Vista "Notificaciones" */
(function () {
  'use strict';

  const TYPE_ICONS = {
    order_status: 'fa-truck',
    order_assigned: 'fa-motorcycle',
    order_created: 'fa-receipt',
  };

  async function renderNotifications(container) {
    if (!Auth.requireAuth()) return;

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-bell" style="color:var(--orange);"></i> Notificaciones</h1>
        </div>
        <div id="notifContainer" style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    `;

    await Notifications.load();
    const list = Notifications.getAll();
    const notifContainer = document.getElementById('notifContainer');

    if (list.length === 0) {
      notifContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <h2>No tienes notificaciones</h2>
          <p>Aqui veras las actualizaciones de tus pedidos</p>
        </div>
      `;
      return;
    }

    notifContainer.innerHTML = `
      <div class="orders-list">
        ${list.map(n => `
          <div class="order-card notif-card ${n.read_at ? '' : 'unread'}" data-notif-id="${n.id}">
            <div class="order-card-header">
              <span class="order-id"><i class="fas ${TYPE_ICONS[n.type] || 'fa-info-circle'}"></i> ${n.title}</span>
              ${n.read_at ? '' : '<span class="status-chip pending">Nueva</span>'}
            </div>
            <div class="order-card-body">
              <div style="font-size:13px;color:var(--gray-600);">${n.body}</div>
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:6px;">${App.formatDate(n.created_at)}</div>
          </div>
        `).join('')}
      </div>
    `;

    notifContainer.querySelectorAll('.notif-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.notifId;
        await Notifications.markRead(id);
        card.classList.remove('unread');
        const badge = card.querySelector('.status-chip.pending');
        if (badge) badge.remove();
      });
    });
  }

  window.Views = window.Views || {};
  window.Views.renderNotifications = renderNotifications;
})();
