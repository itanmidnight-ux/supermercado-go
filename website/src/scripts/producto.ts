import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/producto.css';
import { mountLayout, authFetch, getToken } from './layout';
import { gsap, fadeInUp, staggerReveal } from './animations';
import { renderBreadcrumb as renderBreadcrumbShared, type BreadcrumbItem } from './breadcrumb';
import { icon } from './icons';

/**
 * Claves de localStorage:
 * - 'sg_cart'  ya la usa layout.ts (contador del carrito en el header).
 * - 'sg_token' es el token JWT de sesión -- authFetch() de layout.ts agrega
 *   el header y limpia el token solo en 401 (mismo comportamiento en las
 *   3 páginas: cuenta/carrito/producto).
 */
const CART_KEY = 'sg_cart';

interface Product {
  id: number;
  name: string;
  price: number;
  aliases: string[];
  available: number;
  favorite: number;
  no_fiado: number;
  category: string | null;
  description: string | null;
  images: string[];
  stock?: number;
}

interface CartLine {
  id: number;
  qty: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  author: string;
}

interface ReviewsResponse {
  reviews: Review[];
  count: number;
  average: number;
}

function imgUrl(filename: string): string {
  return `/api/products/images/${encodeURIComponent(filename)}`;
}

function fmtPrice(v: number): string {
  return '$' + Math.round(v).toLocaleString('es-CO');
}

function starString(rating: number): string {
  const rounded = Math.round(rating);
  return '★'.repeat(Math.max(0, Math.min(5, rounded))) + '☆'.repeat(Math.max(0, 5 - rounded));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function updateCartBadge(): void {
  const badge = document.querySelector<HTMLElement>('[data-cart-count]');
  if (!badge) return;
  try {
    const cart: CartLine[] = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const count = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.qty || 1), 0) : 0;
    badge.textContent = String(count);
  } catch {
    badge.textContent = '0';
  }
}

function addToLocalCart(productId: number, qty: number): void {
  let cart: CartLine[] = [];
  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }
  const existing = cart.find((line) => line.id === productId);
  if (existing) existing.qty = qty;
  else cart.push({ id: productId, qty });
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function buildProductCard(p: Product): HTMLElement {
  const card = el('a', 'product-card');
  card.href = `/producto.html?id=${p.id}`;
  card.style.textDecoration = 'none';
  card.style.color = 'inherit';

  const media = el('div', 'product-card__media');
  if (p.images.length) {
    const img = el('img');
    img.src = imgUrl(p.images[0]);
    img.alt = p.name;
    img.loading = 'lazy';
    media.appendChild(img);
  } else {
    media.innerHTML = icon('cart', 40);
    media.classList.add('product-card__media--placeholder');
  }
  card.appendChild(media);

  const body = el('div', 'product-card__body');
  const name = el('p', 'product-card__name');
  name.textContent = p.name;
  const price = el('p', 'product-card__price');
  price.textContent = fmtPrice(p.price);
  body.append(name, price);

  if (!p.available) {
    const badge = el('span', 'badge badge--agotado');
    badge.textContent = 'Agotado';
    body.appendChild(badge);
  }

  card.appendChild(body);
  return card;
}

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products/public');
  if (!res.ok) throw new Error('No se pudo cargar el catálogo');
  return res.json();
}

function renderBreadcrumb(product: Product): void {
  const nav = document.getElementById('product-breadcrumb');
  if (!nav) return;
  const items: BreadcrumbItem[] = [
    { label: 'Inicio', href: '/index.html' },
    { label: 'Catálogo', href: '/catalogo.html' },
  ];
  if (product.category) {
    items.push({
      label: product.category,
      href: `/catalogo.html?categoria=${encodeURIComponent(product.category)}`,
    });
  }
  items.push({ label: product.name });
  renderBreadcrumbShared(nav, items);
}

function renderGallery(product: Product): void {
  const mainImg = document.getElementById('gallery-main-img') as HTMLImageElement | null;
  const placeholder = document.getElementById('gallery-placeholder');
  const thumbs = document.getElementById('gallery-thumbs');
  if (!mainImg || !placeholder || !thumbs) return;

  if (!product.images.length) {
    mainImg.hidden = true;
    placeholder.hidden = false;
    return;
  }

  placeholder.hidden = true;
  mainImg.hidden = false;
  mainImg.alt = product.name;
  mainImg.src = imgUrl(product.images[0]);

  function setActive(filename: string, thumbEl: HTMLElement): void {
    if (!mainImg) return;
    gsap.to(mainImg, {
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        mainImg.src = imgUrl(filename);
        gsap.to(mainImg, { opacity: 1, duration: 0.25 });
      },
    });
    thumbs?.querySelectorAll('.product-gallery__thumb').forEach((t) => t.classList.remove('is-active'));
    thumbEl.classList.add('is-active');
  }

  if (product.images.length > 1) {
    product.images.forEach((filename, idx) => {
      const btn = el('button', 'product-gallery__thumb');
      btn.type = 'button';
      if (idx === 0) btn.classList.add('is-active');
      const img = el('img');
      img.src = imgUrl(filename);
      img.alt = `${product.name} — foto ${idx + 1}`;
      btn.appendChild(img);
      btn.addEventListener('click', () => setActive(filename, btn));
      thumbs.appendChild(btn);
    });
  }
}

function renderInfo(product: Product): { qtyInput: HTMLInputElement } {
  const category = document.getElementById('product-category');
  const name = document.getElementById('product-name');
  const badges = document.getElementById('product-badges');
  const price = document.getElementById('product-price');
  const description = document.getElementById('product-description');
  const stockHint = document.getElementById('stock-hint');
  const qtyInput = document.getElementById('qty-input') as HTMLInputElement;
  const qtyMinus = document.getElementById('qty-minus') as HTMLButtonElement;
  const qtyPlus = document.getElementById('qty-plus') as HTMLButtonElement;
  const addBtn = document.getElementById('add-to-cart-btn') as HTMLButtonElement;
  const addLabel = document.getElementById('add-btn-label');

  if (category) category.textContent = product.category || 'Sin categoría';
  if (name) name.textContent = product.name;
  if (price) price.textContent = fmtPrice(product.price);
  if (description) description.textContent = product.description || 'Sin descripción disponible.';

  if (badges) {
    badges.innerHTML = '';
    if (!product.available) {
      const b = el('span', 'badge badge--agotado');
      b.textContent = 'Agotado';
      badges.appendChild(b);
    }
    if (product.no_fiado) {
      const b = el('span', 'badge badge--no-fiado');
      b.textContent = 'No fiado';
      badges.appendChild(b);
    }
  }

  const maxStock = typeof product.stock === 'number' ? product.stock : null;
  if (maxStock !== null && stockHint) {
    stockHint.hidden = false;
    stockHint.textContent = maxStock > 0 ? `Quedan ${maxStock} unidades.` : 'Sin stock disponible.';
  }

  const clamp = (v: number): number => {
    let val = Math.max(1, v);
    if (maxStock !== null) val = Math.min(val, Math.max(1, maxStock));
    return val;
  };

  qtyInput.value = '1';
  qtyMinus.addEventListener('click', () => {
    qtyInput.value = String(clamp(parseInt(qtyInput.value, 10) - 1));
  });
  qtyPlus.addEventListener('click', () => {
    qtyInput.value = String(clamp(parseInt(qtyInput.value, 10) + 1));
  });

  if (!product.available || (maxStock !== null && maxStock <= 0)) {
    addBtn.disabled = true;
    qtyMinus.disabled = true;
    qtyPlus.disabled = true;
    if (addLabel) addLabel.textContent = 'Agotado';
  } else {
    addBtn.addEventListener('click', () => void handleAddToCart(product, addBtn, qtyInput));
  }

  return { qtyInput };
}

/** Tab "Detalles" -- solo campos que ya vienen de la API, nada inventado. */
function renderDetails(product: Product): void {
  const dl = document.getElementById('product-details-list');
  if (!dl) return;
  const rows: [string, string][] = [
    ['Categoría', product.category || 'Sin categoría'],
    ['Disponibilidad', product.available ? 'Disponible' : 'Agotado'],
    ['Fiado', product.no_fiado ? 'No se fía' : 'Se fía'],
  ];
  dl.innerHTML = rows.map(([term, desc]) => `<dt>${term}</dt><dd>${desc}</dd>`).join('');
}

/**
 * Tabs Descripción/Detalles/Reseñas -- role="tablist"/"tab"/aria-selected
 * real (no solo visual) + navegación con flechas, y fade con gsap en vez
 * de solo togglear `hidden` en seco.
 */
function initTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.product-tabs__tab'));
  if (!tabs.length) return;

  const panelFor = (tab: HTMLButtonElement): HTMLElement | null =>
    document.getElementById(tab.getAttribute('aria-controls') || '');

  const activate = (tab: HTMLButtonElement): void => {
    const nextPanel = panelFor(tab);
    if (!nextPanel || tab.getAttribute('aria-selected') === 'true') return;

    const currentTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    const currentPanel = currentTab ? panelFor(currentTab) : null;

    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });

    if (currentPanel && currentPanel !== nextPanel) {
      gsap.to(currentPanel, {
        opacity: 0,
        duration: 0.15,
        onComplete: () => {
          currentPanel.hidden = true;
          nextPanel.hidden = false;
          gsap.fromTo(nextPanel, { opacity: 0 }, { opacity: 1, duration: 0.25 });
        },
      });
    } else {
      nextPanel.hidden = false;
      gsap.fromTo(nextPanel, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    }
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      activate(next);
    });
  });
}

async function handleAddToCart(product: Product, btn: HTMLButtonElement, qtyInput: HTMLInputElement): Promise<void> {
  const token = getToken();
  if (!token) {
    // Sin sesión: no se intenta pegarle a /api/cart (siempre 401 sin token).
    // Se manda al flujo de login/registro y se vuelve acá después.
    const back = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/cuenta.html?redirect=${back}`;
    return;
  }

  const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
  const label = document.getElementById('add-btn-label');
  btn.disabled = true;

  try {
    const res = await authFetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, quantity: qty }),
    });
    if (res.status === 401) {
      const back = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/cuenta.html?redirect=${back}`;
      return;
    }
    if (!res.ok) throw new Error('No se pudo agregar');

    addToLocalCart(product.id, qty);

    // Micro-feedback: pulso + check animado en vez de solo cambiar color.
    btn.classList.add('is-added');
    if (label) label.textContent = '✓ ¡Agregado!';
    gsap.fromTo(btn, { scale: 1 }, { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });

    setTimeout(() => {
      btn.classList.remove('is-added');
      if (label) label.textContent = 'Agregar al carrito';
      btn.disabled = false;
    }, 1600);
  } catch {
    if (label) label.textContent = 'Error, reintentar';
    setTimeout(() => {
      if (label) label.textContent = 'Agregar al carrito';
    }, 1800);
    btn.disabled = false;
  }
}

async function renderReviews(productId: number): Promise<void> {
  const summaryEl = document.getElementById('reviews-summary');
  const listEl = document.getElementById('reviews-list');
  if (!summaryEl || !listEl) return;

  const token = getToken();
  let data: ReviewsResponse | null = null;

  // GET /api/products/:id/reviews requiere sesión (clientAuth) en el backend
  // -- sin token ni se intenta, se cae directo al estado neutro de abajo.
  if (token) {
    try {
      const res = await authFetch(`/api/products/${productId}/reviews`);
      if (res.ok) data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!data || !data.count) {
    summaryEl.innerHTML = '';
    listEl.innerHTML = '<p class="reviews-empty">Sé el primero en opinar sobre este producto.</p>';
    return;
  }

  summaryEl.innerHTML = `
    <span class="reviews-summary__stars">${starString(data.average)}</span>
    <span class="reviews-summary__count">${data.average.toFixed(1)} · ${data.count} reseña${data.count === 1 ? '' : 's'}</span>
  `;

  listEl.innerHTML = '';
  data.reviews.forEach((r) => {
    const item = el('article', 'review-item');
    item.innerHTML = `
      <div class="review-item__head">
        <span class="review-item__author">${r.author}</span>
        <span class="review-item__stars">${starString(r.rating)}</span>
      </div>
      ${r.comment ? `<p class="review-item__comment">${r.comment}</p>` : ''}
    `;
    listEl.appendChild(item);
  });

  staggerReveal('#reviews-list .review-item', { scrollTrigger: true });
}

function renderRelated(current: Product, all: Product[]): void {
  const section = document.getElementById('product-related');
  const grid = document.getElementById('related-grid');
  if (!section || !grid) return;

  const related = all
    .filter((p) => p.id !== current.id && p.category && p.category === current.category)
    .slice(0, 6);

  if (!related.length) return;

  grid.innerHTML = '';
  related.forEach((p) => grid.appendChild(buildProductCard(p)));
  section.hidden = false;

  fadeInUp(section.querySelector('h2') as Element, { duration: 0.6 });
  staggerReveal('.product-related__grid .product-card', { scrollTrigger: true });
}

async function init(): Promise<void> {
  mountLayout();

  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get('id') || '', 10);

  const loading = document.getElementById('product-loading');
  const errorEl = document.getElementById('product-error');
  const detail = document.getElementById('product-detail');

  const showError = (): void => {
    if (loading) loading.hidden = true;
    if (errorEl) errorEl.hidden = false;
  };

  if (!id || id <= 0) {
    showError();
    return;
  }

  try {
    const products = await fetchProducts();
    const product = products.find((p) => p.id === id);
    if (!product) {
      showError();
      return;
    }

    renderBreadcrumb(product);
    renderGallery(product);
    renderInfo(product);
    renderDetails(product);
    initTabs();

    if (loading) loading.hidden = true;
    if (detail) {
      detail.hidden = false;
      fadeInUp(detail, { y: 24, duration: 0.7 });
    }

    void renderReviews(product.id);
    renderRelated(product, products);
  } catch {
    showError();
  }
}

void init();
