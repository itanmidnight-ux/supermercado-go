/* ════════════════════════════════════════════════════════════════════════════════
   Supermercados Go — Cart Module
   Manages shopping cart with localStorage persistence
   ════════════════════════════════════════════════════════════════════════════════ */

const Cart = (() => {
  const STORAGE_KEY = 'sg_cart';

  // ─── Internal state ────────────────────────────────────────────────
  let items = [];
  let listeners = [];

  // ─── Load from localStorage ───────────────────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
    } catch {
      items = [];
    }
  }

  // ─── Save to localStorage ─────────────────────────────────────────
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    notifyListeners();
    updateBadges();
  }

  // ─── Notify all registered listeners ──────────────────────────────
  function notifyListeners() {
    listeners.forEach(fn => fn(items));
  }

  // ─── Update all cart badge elements ───────────────────────────────
  function updateBadges() {
    const count = getCount();
    const badge = document.getElementById('cartBadge');
    const floatingCart = document.getElementById('floatingCart');
    const floatingCount = document.getElementById('floatingCartCount');

    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    if (floatingCart) {
      floatingCart.style.display = count > 0 ? 'block' : 'none';
    }
    if (floatingCount) {
      floatingCount.textContent = count;
    }
  }

  // ─── Get items ────────────────────────────────────────────────────
  function getItems() {
    return [...items];
  }

  // ─── Get total item count ─────────────────────────────────────────
  function getCount() {
    return items.reduce((sum, item) => sum + item.qty, 0);
  }

  // ─── Check if product is in cart ──────────────────────────────────
  function hasItem(productId) {
    return items.some(i => i.product_id === productId);
  }

  // ─── Get quantity of a product ────────────────────────────────────
  function getQty(productId) {
    const item = items.find(i => i.product_id === productId);
    return item ? item.qty : 0;
  }

  // ─── Add item to cart ─────────────────────────────────────────────
  function addItem(product, qty = 1) {
    qty = Math.max(1, Math.floor(qty));
    const existing = items.find(i => i.product_id === product.id);

    if (existing) {
      existing.qty += qty;
      // Cap at stock
      if (product.stock && product.stock > 0) {
        existing.qty = Math.min(existing.qty, product.stock);
      }
    } else {
      items.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || null,
        unit: product.unit || 'un',
        qty: qty,
        brand: product.brand || '',
        stock: product.stock || null,
      });
    }

    save();
    return true;
  }

  // ─── Set quantity for an item ─────────────────────────────────────
  function setQty(productId, qty) {
    qty = Math.max(1, Math.floor(qty));
    const item = items.find(i => i.product_id === productId);
    if (!item) return false;

    if (item.stock && item.stock > 0) {
      qty = Math.min(qty, item.stock);
    }
    item.qty = qty;
    save();
    return true;
  }

  // ─── Increment quantity ───────────────────────────────────────────
  function increment(productId) {
    const item = items.find(i => i.product_id === productId);
    if (!item) return false;
    return setQty(productId, item.qty + 1);
  }

  // ─── Decrement quantity ───────────────────────────────────────────
  function decrement(productId) {
    const item = items.find(i => i.product_id === productId);
    if (!item) return false;
    if (item.qty <= 1) {
      removeItem(productId);
      return true;
    }
    return setQty(productId, item.qty - 1);
  }

  // ─── Remove item from cart ────────────────────────────────────────
  function removeItem(productId) {
    items = items.filter(i => i.product_id !== productId);
    save();
    return true;
  }

  // ─── Clear cart ───────────────────────────────────────────────────
  function clear() {
    items = [];
    save();
    return true;
  }

  // ─── Calculate subtotal ───────────────────────────────────────────
  function getSubtotal() {
    return items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }

  // ─── Calculate delivery fee ───────────────────────────────────────
  function getDeliveryFee(freeMin = 50000, feeDefault = 4900, fulfillmentType = 'delivery') {
    if (fulfillmentType === 'pickup') return 0;
    const subtotal = getSubtotal();
    return subtotal >= freeMin ? 0 : feeDefault;
  }

  // ─── Get cart summary ─────────────────────────────────────────────
  function getSummary(freeMin = 50000, feeDefault = 4900, fulfillmentType = 'delivery') {
    const subtotal = getSubtotal();
    const deliveryFee = getDeliveryFee(freeMin, feeDefault, fulfillmentType);
    const total = subtotal + deliveryFee;
    return { items: [...items], subtotal, deliveryFee, total, count: getCount() };
  }

  // ─── Prepare order items for API ──────────────────────────────────
  function toOrderItems() {
    return items.map(item => ({
      product_id: item.product_id,
      qty: item.qty,
    }));
  }

  // ─── Subscribe to cart changes ────────────────────────────────────
  function onChange(callback) {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(fn => fn !== callback);
    };
  }

  // ─── Format price in COP ──────────────────────────────────────────
  function formatPrice(amount) {
    return '$' + Math.round(amount).toLocaleString('es-CO');
  }

  // ─── Initialize ───────────────────────────────────────────────────
  load();
  updateBadges();

  return {
    getItems,
    getCount,
    hasItem,
    getQty,
    addItem,
    setQty,
    increment,
    decrement,
    removeItem,
    clear,
    getSubtotal,
    getDeliveryFee,
    getSummary,
    toOrderItems,
    onChange,
    formatPrice,
  };
})();
