/* website/js/favorites.js — Favorites Module
   Handles the client's favorite products list, mirrors the Cart.js pattern. */
const Favorites = (() => {
  let items = [];      // raw API rows: { id, product_id, name, price, image, ... }
  let ids = new Set();  // product_id lookup, kept in sync with `items`
  let listeners = [];

  function notifyListeners() {
    listeners.forEach(fn => fn(items));
  }

  async function load() {
    if (!Auth.isLogged() || Auth.getUser().role !== 'client') {
      items = [];
      ids = new Set();
      notifyListeners();
      return;
    }
    try {
      const res = await App.api('/api/favorites');
      items = res.data || [];
      ids = new Set(items.map(i => i.product_id));
    } catch {
      items = [];
      ids = new Set();
    }
    notifyListeners();
  }

  function isFavorite(productId) {
    return ids.has(productId);
  }

  function getAll() {
    return [...items];
  }

  async function toggle(productId) {
    const wasFavorite = ids.has(productId);
    // Optimistic update
    if (wasFavorite) {
      ids.delete(productId);
      items = items.filter(i => i.product_id !== productId);
    } else {
      ids.add(productId);
    }
    notifyListeners();

    try {
      if (wasFavorite) {
        await App.api('/api/favorites/' + productId, { method: 'DELETE', headers: Auth.getHeaders() });
      } else {
        await App.api('/api/favorites/' + productId, { method: 'POST', headers: Auth.getHeaders() });
        await load(); // refetch to get full product data for the new favorite
      }
    } catch (err) {
      // Revert optimistic update on failure
      if (wasFavorite) ids.add(productId); else ids.delete(productId);
      notifyListeners();
      App.toast(err.message, 'error');
    }
  }

  function onChange(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter(fn => fn !== callback); };
  }

  return { load, isFavorite, toggle, getAll, onChange };
})();
