/* website/js/views/favorites.js — Vista "Mis Favoritos" */
(function () {
  'use strict';

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
    const list = Favorites.getAll();
    const favContainer = document.getElementById('favoritesContainer');

    if (list.length === 0) {
      favContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-heart"></i>
          <h2>No tienes favoritos aun</h2>
          <p>Toca el corazon en un producto para guardarlo aqui</p>
          <a href="#/productos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ver Productos</a>
        </div>
      `;
      return;
    }

    // La API de favoritos devuelve `product_id`, no `id` — App.productCardHTML
    // espera `p.id`. Se mapea antes de reusar la misma card que el catálogo.
    favContainer.innerHTML = `
      <div class="products-grid">
        ${list.map(f => App.productCardHTML({ ...f, id: f.product_id })).join('')}
      </div>
    `;
    App.bindAddToCartButtons(favContainer);
    App.bindFavoriteButtons(favContainer);

    // App.bindFavoriteButtons solo actualiza el ícono del botón clickeado (le
    // sirve al catálogo, donde la card debe quedarse). En esta vista, en
    // cambio, quitar un favorito debe hacer que la card desaparezca de la
    // grilla sin recargar. Nos suscribimos a Favorites.onChange para eso —
    // se dispara luego del toggle optimista, así que basta con quitar del DOM
    // cualquier card cuyo product_id ya no esté en la lista actual. La
    // suscripción se limpia en el próximo hashchange (salir de esta vista)
    // para no acumular listeners en Favorites cada vez que se visita la ruta.
    const unsubscribe = Favorites.onChange((currentItems) => {
      const currentIds = new Set(currentItems.map(i => i.product_id));
      favContainer.querySelectorAll('.product-card').forEach(card => {
        if (!currentIds.has(card.dataset.productId)) card.remove();
      });
      if (favContainer.querySelectorAll('.product-card').length === 0) {
        favContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-heart"></i>
            <h2>No tienes favoritos aun</h2>
            <p>Toca el corazon en un producto para guardarlo aqui</p>
            <a href="#/productos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ver Productos</a>
          </div>
        `;
      }
    });
    window.addEventListener('hashchange', function cleanup() {
      unsubscribe();
      window.removeEventListener('hashchange', cleanup);
    }, { once: true });
  }

  window.Views = window.Views || {};
  window.Views.renderFavorites = renderFavorites;
})();
