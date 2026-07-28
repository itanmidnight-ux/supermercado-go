import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/carrito.css';
import { mountLayout } from './layout';
import { gsap, fadeInUp } from './animations';

/**
 * Convención de sesión (misma que producto.ts):
 * - 'sg_token' en localStorage = JWT crudo, header Authorization: Bearer <token>.
 * - 'sg_cart' en localStorage = espejo del carrito ([{id, qty}]) que lee
 *   layout.ts para el contador del header. Esta página es la fuente de
 *   verdad (GET /api/cart) -- 'sg_cart' se resincroniza acá en cada cambio.
 */
const TOKEN_KEY = 'sg_token';
const CART_KEY = 'sg_cart';

interface CartItem {
  id: number; // cart_items.id
  client_username: string;
  product_id: number;
  quantity: number;
  delivery_date: string | null;
  created_at: string;
  product_name: string;
  price: number;
  available: number;
}

interface ProductLite {
  id: number;
  images: string[];
}

type PaymentMethod = 'nequi' | 'visa' | 'contra_entrega';
type DeliveryMode = 'gps' | 'address';

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function imgUrl(filename: string): string {
  return `/api/products/images/${encodeURIComponent(filename)}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function syncLocalCart(items: CartItem[]): void {
  const mirror = items.map((i) => ({ id: i.product_id, qty: i.quantity }));
  localStorage.setItem(CART_KEY, JSON.stringify(mirror));
  // Notifica al header en esta misma pestaña (el evento 'storage' solo
  // dispara en otras pestañas) -- layout.ts escucha 'storage', así que acá
  // se actualiza el badge a mano.
  const badge = document.querySelector<HTMLElement>('[data-cart-count]');
  if (badge) {
    const count = mirror.reduce((sum, i) => sum + (i.qty || 1), 0);
    badge.textContent = String(count);
  }
}

// ── Elementos ────────────────────────────────────────────────
const loadingEl = document.getElementById('cart-loading') as HTMLElement;
const guestEl = document.getElementById('cart-guest') as HTMLElement;
const emptyEl = document.getElementById('cart-empty') as HTMLElement;
const errorEl = document.getElementById('cart-error') as HTMLElement;
const errorTextEl = document.getElementById('cart-error-text') as HTMLElement;
const contentEl = document.getElementById('cart-content') as HTMLElement;
const listEl = document.getElementById('cart-list') as HTMLElement;
const totalEl = document.getElementById('cart-total') as HTMLElement;
const successEl = document.getElementById('cart-success') as HTMLElement;
const confettiEl = document.getElementById('cart-confetti') as HTMLElement;

const form = document.getElementById('checkout-form') as HTMLFormElement;
const paymentMethodSelect = document.getElementById('payment-method') as HTMLSelectElement;
const referenceField = document.getElementById('reference-field') as HTMLElement;
const referenceInput = document.getElementById('payment-reference') as HTMLInputElement;
const modeGps = document.getElementById('mode-gps') as HTMLInputElement;
const modeAddress = document.getElementById('mode-address') as HTMLInputElement;
const gpsField = document.getElementById('gps-field') as HTMLElement;
const gpsBtn = document.getElementById('gps-btn') as HTMLButtonElement;
const gpsStatus = document.getElementById('gps-status') as HTMLElement;
const addressField = document.getElementById('address-field') as HTMLElement;
const addressInput = document.getElementById('delivery-address') as HTMLTextAreaElement;
const contraEntregaHint = document.getElementById('contra-entrega-hint') as HTMLElement;
const checkoutError = document.getElementById('checkout-error') as HTMLElement;
const checkoutBtn = document.getElementById('checkout-btn') as HTMLButtonElement;
const checkoutBtnLabel = document.getElementById('checkout-btn-label') as HTMLElement;

let currentItems: CartItem[] = [];
let gpsCoords: { lat: number; lng: number } | null = null;

function hideAllStates(): void {
  loadingEl.hidden = true;
  guestEl.hidden = true;
  emptyEl.hidden = true;
  errorEl.hidden = true;
  contentEl.hidden = true;
}

function showGuest(): void {
  hideAllStates();
  guestEl.hidden = false;
}

function showEmpty(): void {
  hideAllStates();
  emptyEl.hidden = false;
}

function showError(message?: string): void {
  hideAllStates();
  if (message) errorTextEl.textContent = message;
  errorEl.hidden = false;
}

function computeTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

function renderTotal(items: CartItem[]): void {
  totalEl.textContent = money.format(computeTotal(items));
}

function buildCartItemRow(item: CartItem, imageFilename: string | null): HTMLElement {
  const row = el('article', 'cart-item');
  row.dataset.productId = String(item.product_id);

  const media = el('div', 'cart-item__media');
  if (imageFilename) {
    const img = el('img');
    img.src = imgUrl(imageFilename);
    img.alt = item.product_name;
    img.loading = 'lazy';
    media.appendChild(img);
  } else {
    const placeholder = el('span', 'cart-item__media--empty');
    placeholder.textContent = '🛒';
    media.appendChild(placeholder);
  }

  const info = el('div', 'cart-item__info');
  const name = el('p', 'cart-item__name');
  name.textContent = item.product_name;
  const unitPrice = el('p', 'cart-item__unit-price');
  unitPrice.textContent = `${money.format(item.price)} c/u`;
  info.append(name, unitPrice);
  if (!item.available) {
    const badge = el('span', 'badge badge--agotado cart-item__badge');
    badge.textContent = 'Ya no disponible';
    info.appendChild(badge);
  }

  const qtyBox = el('div', 'cart-item__qty');
  const minusBtn = el('button', 'cart-item__qty-btn');
  minusBtn.type = 'button';
  minusBtn.textContent = '−';
  minusBtn.setAttribute('aria-label', 'Restar cantidad');
  const qtyValue = el('span', 'cart-item__qty-value');
  qtyValue.textContent = String(item.quantity);
  const plusBtn = el('button', 'cart-item__qty-btn');
  plusBtn.type = 'button';
  plusBtn.textContent = '+';
  plusBtn.setAttribute('aria-label', 'Sumar cantidad');
  qtyBox.append(minusBtn, qtyValue, plusBtn);

  const actions = el('div', 'cart-item__actions');
  const subtotal = el('span', 'cart-item__subtotal');
  subtotal.textContent = money.format(item.price * item.quantity);
  const removeBtn = el('button', 'cart-item__remove');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Quitar';
  actions.append(subtotal, removeBtn);

  row.append(media, info, qtyBox, actions);

  const setBusy = (busy: boolean): void => {
    minusBtn.disabled = busy;
    plusBtn.disabled = busy;
    removeBtn.disabled = busy;
  };

  const updateQty = async (newQty: number): Promise<void> => {
    if (newQty < 1) return;
    setBusy(true);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ product_id: item.product_id, quantity: newQty }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar');
      item.quantity = newQty;
      qtyValue.textContent = String(newQty);
      subtotal.textContent = money.format(item.price * newQty);
      subtotal.classList.add('is-pulsing');
      setTimeout(() => subtotal.classList.remove('is-pulsing'), 200);
      syncLocalCart(currentItems);
      renderTotal(currentItems);
    } catch {
      // no se pudo actualizar en el server: no tocamos el estado local,
      // el número mostrado sigue siendo el real
      checkoutError.hidden = false;
      checkoutError.textContent = 'No se pudo actualizar la cantidad. Probá de nuevo.';
    } finally {
      setBusy(false);
    }
  };

  minusBtn.addEventListener('click', () => void updateQty(item.quantity - 1));
  plusBtn.addEventListener('click', () => void updateQty(item.quantity + 1));

  removeBtn.addEventListener('click', () => {
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch(`/api/cart/${item.product_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('No se pudo quitar');

        gsap.to(row, {
          opacity: 0,
          x: -16,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            row.remove();
            currentItems = currentItems.filter((i) => i.product_id !== item.product_id);
            syncLocalCart(currentItems);
            renderTotal(currentItems);
            if (currentItems.length === 0) showEmpty();
          },
        });
      } catch {
        setBusy(false);
        checkoutError.hidden = false;
        checkoutError.textContent = 'No se pudo quitar el producto. Probá de nuevo.';
      }
    })();
  });

  return row;
}

function renderList(items: CartItem[], imagesByProductId: Map<number, string>): void {
  listEl.innerHTML = '';
  items.forEach((item) => {
    listEl.appendChild(buildCartItemRow(item, imagesByProductId.get(item.product_id) || null));
  });
  gsap.from('.cart-item', { opacity: 0, y: 20, duration: 0.5, stagger: 0.06, ease: 'power2.out' });
}

async function fetchProductImages(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const res = await fetch('/api/products/public');
    if (!res.ok) return map;
    const products: ProductLite[] = await res.json();
    products.forEach((p) => {
      if (p.images && p.images.length) map.set(p.id, p.images[0]);
    });
  } catch {
    // sin imágenes: la fila cae al placeholder, no rompe la página
  }
  return map;
}

async function loadCart(): Promise<void> {
  const token = getToken();
  if (!token) {
    showGuest();
    return;
  }

  hideAllStates();
  loadingEl.hidden = false;

  try {
    const res = await fetch('/api/cart', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      showGuest();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { items } = (await res.json()) as { items: CartItem[] };
    currentItems = Array.isArray(items) ? items : [];
    syncLocalCart(currentItems);

    if (currentItems.length === 0) {
      showEmpty();
      return;
    }

    const imagesByProductId = await fetchProductImages();

    hideAllStates();
    contentEl.hidden = false;
    renderList(currentItems, imagesByProductId);
    renderTotal(currentItems);
    fadeInUp(contentEl, { y: 24, duration: 0.6 });
  } catch {
    showError();
  }
}

// ── Formulario de checkout ──────────────────────────────────────

function updatePaymentFields(): void {
  const method = paymentMethodSelect.value as PaymentMethod | '';
  referenceField.hidden = !(method === 'nequi' || method === 'visa');

  if (method === 'contra_entrega') {
    // Contra entrega SOLO se permite en modo GPS -- regla de negocio
    // validada también en el server (server/src/routes/cart.js), acá se
    // fuerza en la UI para no dejar mandar una combinación que el server
    // va a rechazar igual.
    modeGps.checked = true;
    modeAddress.disabled = true;
    contraEntregaHint.hidden = false;
    updateDeliveryFields();
  } else {
    modeAddress.disabled = false;
    contraEntregaHint.hidden = true;
  }
}

function updateDeliveryFields(): void {
  gpsField.hidden = !modeGps.checked;
  addressField.hidden = !modeAddress.checked;
}

paymentMethodSelect.addEventListener('change', updatePaymentFields);
modeGps.addEventListener('change', updateDeliveryFields);
modeAddress.addEventListener('change', updateDeliveryFields);

gpsBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    gpsStatus.textContent = 'Tu navegador no soporta geolocalización.';
    gpsStatus.className = 'cart-gps-status is-error';
    return;
  }
  gpsStatus.textContent = 'Buscando ubicación...';
  gpsStatus.className = 'cart-gps-status';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsStatus.textContent = 'Ubicación compartida ✓';
      gpsStatus.className = 'cart-gps-status is-ok';
    },
    () => {
      gpsCoords = null;
      gpsStatus.textContent = 'No pudimos obtener tu ubicación. Revisá los permisos.';
      gpsStatus.className = 'cart-gps-status is-error';
    },
    { enableHighAccuracy: true, timeout: 10_000 }
  );
});

function launchConfetti(): void {
  const colors = ['#C6FF3D', '#3D8BFD', '#D4800A', '#3ecf6b'];
  for (let i = 0; i < 36; i++) {
    const piece = el('span', 'cart-confetti__piece');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    confettiEl.appendChild(piece);
  }
  setTimeout(() => {
    confettiEl.innerHTML = '';
  }, 2200);
}

function showSuccess(): void {
  hideAllStates();
  successEl.hidden = false;
  gsap.fromTo(
    '.cart-success__check-circle',
    { strokeDashoffset: 151 },
    { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }
  );
  gsap.fromTo(
    '.cart-success__check-mark',
    { strokeDashoffset: 40 },
    { strokeDashoffset: 0, duration: 0.4, delay: 0.35, ease: 'power2.out' }
  );
  gsap.fromTo(
    successEl.querySelectorAll('h2, p, .btn'),
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.5, delay: 0.5, stagger: 0.1, ease: 'power2.out' }
  );
  launchConfetti();
}

function validateCheckout(): string | null {
  const method = paymentMethodSelect.value as PaymentMethod | '';
  if (!method) return 'Elegí un método de pago.';

  if ((method === 'nequi' || method === 'visa') && !referenceInput.value.trim()) {
    return 'Ingresá la referencia de pago.';
  }

  const mode: DeliveryMode | '' = modeGps.checked ? 'gps' : modeAddress.checked ? 'address' : '';
  if (!mode) return 'Elegí cómo vas a recibir el pedido.';

  if (method === 'contra_entrega' && mode !== 'gps') {
    return 'El pago contra entrega requiere compartir tu ubicación en tiempo real.';
  }

  if (mode === 'gps' && !gpsCoords) return 'Compartí tu ubicación para continuar.';
  if (mode === 'address' && !addressInput.value.trim()) return 'Escribí la dirección de entrega.';

  return null;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  checkoutError.hidden = true;

  const error = validateCheckout();
  if (error) {
    checkoutError.textContent = error;
    checkoutError.hidden = false;
    return;
  }

  const method = paymentMethodSelect.value as PaymentMethod;
  const mode: DeliveryMode = modeGps.checked ? 'gps' : 'address';

  const body: Record<string, unknown> = {
    payment_method: method,
    delivery_mode: mode,
  };
  if (method === 'nequi' || method === 'visa') {
    body.payment_reference = referenceInput.value.trim();
  }
  if (mode === 'gps' && gpsCoords) {
    body.delivery_lat = gpsCoords.lat;
    body.delivery_lng = gpsCoords.lng;
  } else if (mode === 'address') {
    body.delivery_address = addressInput.value.trim();
  }

  checkoutBtn.disabled = true;
  checkoutBtnLabel.textContent = 'Confirmando...';
  gsap.to(checkoutBtn, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });

  void (async () => {
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'No se pudo confirmar el pedido.' }));
        throw new Error(data.error || 'No se pudo confirmar el pedido.');
      }

      localStorage.setItem(CART_KEY, '[]');
      showSuccess();
    } catch (err) {
      checkoutError.textContent = err instanceof Error ? err.message : 'No se pudo confirmar el pedido. Probá de nuevo.';
      checkoutError.hidden = false;
      checkoutBtn.disabled = false;
      checkoutBtnLabel.textContent = 'Confirmar pedido';
    }
  })();
});

mountLayout();
void loadCart();
