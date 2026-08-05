/* website/js/views/role-blocked.js — Pantalla para cuentas worker/admin en el sitio web */
(function () {
  'use strict';

  const ROLE_LABELS = { worker: 'repartidor', admin: 'administrador' };

  function renderRoleBlocked(container) {
    const user = Auth.getUser();
    const roleLabel = ROLE_LABELS[user.role] || user.role;

    container.innerHTML = `
      <div class="empty-state" style="min-height:60vh;display:flex;flex-direction:column;justify-content:center;">
        <i class="fas fa-user-shield" style="color:var(--orange);"></i>
        <h2>Hola, ${user.name}</h2>
        <p>Tu cuenta es de tipo <strong>${roleLabel}</strong>. Este sitio web es solo
        para clientes — usa la app Supermercados Go${user.role === 'admin' ? ' o el panel de administración' : ''}
        para gestionar tu cuenta.</p>
        <button class="btn btn-outline mt-3" id="roleBlockedLogout"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button>
      </div>
    `;

    document.getElementById('roleBlockedLogout').addEventListener('click', () => {
      Auth.logout();
    });
  }

  window.Views = window.Views || {};
  window.Views.renderRoleBlocked = renderRoleBlocked;
})();
