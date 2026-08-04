/* website/js/views/favorites.js — Vista "Mis Favoritos" */
(function () {
  'use strict';

  const EMPTY_STATE_HTML = `
    <div class="empty-state">
      <i class="fas fa-heart"></i>
      <h2>No tienes favoritos aun</h2>
      <p>Toca el corazon en un producto para guardarlo aqui</p>
      <a href="#/productos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ver Productos</a>
    </div>
  `;

  // Reconstruye el contenido de favContainer a partir de la lista de
  // favoritos actual. Se usa tanto en el render inicial como cada vez que
  // Favorites.onChange se dispara, para que la grilla siempre refleje el
  // estado real de `items` — incluyendo el caso en que un DELETE optimista
  // falla y Favorites.toggle() restaura el item (la card debe reaparecer,
  // no quedar perdida hasta la próxima visita a la ruta).
  function renderGrid(favContainer, currentItems) {
    if (currentItems.length === 0) {
      favContainer.innerHTML = EMPTY_STATE_HTML;
      return;
    }
    // La API de favoritos devuelve `product_id`, no `id` — App.productCardHTML
    // espera `p.id`. Se mapea antes de reusar la misma card que el catálogo.
    favContainer.innerHTML = `
      <div class="products-grid">
        ${currentItems.map(f => App.productCardHTML({ ...f, id: f.product_id })).join('')}
      </div>
    `;
    App.bindAddToCartButtons(favContainer);
    App.bindFavoriteButtons(favContainer);
  }

  async function renderFavorites(container) {
    if (!Auth.requireAuth()) return;
    if (Auth.getUser().role !== 'client') return; // el router ya lo bloquea antes, defensivo

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-heart" style="color:var(--red);"></i> Mis Favoritos</h1>
          <p>Productos que has guardado</p>
        </div>
        <div id="favoritesContainer" style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    `;

    await Favorites.load();
    const favContainer = document.getElementById('favoritesContainer');
    renderGrid(favContainer, Favorites.getAll());

    // App.bindFavoriteButtons solo actualiza el ícono del botón clickeado (le
    // sirve al catálogo, donde la card debe quedarse). En esta vista, en
    // cambio, la grilla debe reflejar en vivo cualquier cambio a la lista de
    // favoritos: quitar uno debe hacer que su card desaparezca sin recargar,
    // y si esa operación falla en el servidor (DELETE fallido) y
    // Favorites.toggle() revierte el estado, la card debe reaparecer — no
    // quedar perdida hasta la próxima visita a la ruta. Por eso reconstruimos
    // toda la grilla (renderGrid) en cada notificación de Favorites.onChange,
    // en vez de solo remover cards puntualmente. La suscripción se limpia en
    // el próximo hashchange (salir de esta vista) para no acumular listeners
    // en Favorites cada vez que se visita la ruta.
    const unsubscribe = Favorites.onChange((currentItems) => {
      renderGrid(favContainer, currentItems);
    });
    window.addEventListener('hashchange', function cleanup() {
      unsubscribe();
      window.removeEventListener('hashchange', cleanup);
    }, { once: true });
  }

  window.Views = window.Views || {};
  window.Views.renderFavorites = renderFavorites;
})();
