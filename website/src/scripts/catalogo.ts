import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/catalogo.css';
import { mountLayout } from './layout';
import { staggerReveal } from './animations';
import { renderBreadcrumb, type BreadcrumbItem } from './breadcrumb';
import { icon } from './icons';

mountLayout();

interface Product {
  id: number;
  name: string;
  price: number;
  category: string | null;
  favorite: number;
  available: number;
  images: string[];
}

type SortMode = 'destacados' | 'nombre' | 'precio-asc' | 'precio-desc';

const grid = document.getElementById('catalog-grid') as HTMLElement;
const chipsEl = document.getElementById('catalog-chips') as HTMLElement;
const emptyEl = document.getElementById('catalog-empty') as HTMLElement;
const errorEl = document.getElementById('catalog-error') as HTMLElement;
const breadcrumbEl = document.getElementById('catalog-breadcrumb') as HTMLElement;
const searchInput = document.getElementById('catalog-search') as HTMLInputElement;
const sortSelect = document.getElementById('catalog-sort') as HTMLSelectElement;
const priceMinInput = document.getElementById('catalog-price-min') as HTMLInputElement;
const priceMaxInput = document.getElementById('catalog-price-max') as HTMLInputElement;

const initialParams = new URLSearchParams(window.location.search);

let allProducts: Product[] = [];
let activeCategory: string | null = initialParams.get('categoria'); // null = "Todas"
let searchTerm = '';
let sortMode: SortMode = 'destacados';
let priceMin: number | null = null;
let priceMax: number | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let priceDebounceTimer: ReturnType<typeof setTimeout> | undefined;

function updateBreadcrumb(): void {
  const items: BreadcrumbItem[] = [{ label: 'Inicio', href: '/index.html' }];
  if (activeCategory) {
    items.push({ label: 'Catálogo', href: '/catalogo.html' });
    items.push({ label: activeCategory });
  } else {
    items.push({ label: 'Catálogo' });
  }
  renderBreadcrumb(breadcrumbEl, items);
}

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function renderSkeleton(): void {
  grid.innerHTML = '';
  grid.classList.add('catalog__skeleton-grid');
  grid.classList.remove('catalog__grid');
  for (let i = 0; i < 10; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton skeleton--card';
    grid.appendChild(card);
  }
}

function renderChips(categories: string[]): void {
  chipsEl.innerHTML = '';

  const makeChip = (label: string, value: string | null): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'catalog__chip';
    btn.textContent = label;
    if (value === activeCategory) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      activeCategory = value;
      renderChips(categories);
      updateBreadcrumb();
      renderGrid();
    });
    return btn;
  };

  chipsEl.appendChild(makeChip('Todas', null));
  categories.forEach((cat) => chipsEl.appendChild(makeChip(cat, cat)));
}

function getFilteredSorted(): Product[] {
  let list = allProducts;

  if (activeCategory) {
    list = list.filter((p) => p.category === activeCategory);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(term));
  }

  if (priceMin !== null) {
    list = list.filter((p) => p.price >= priceMin!);
  }
  if (priceMax !== null) {
    list = list.filter((p) => p.price <= priceMax!);
  }

  const sorted = [...list];
  switch (sortMode) {
    case 'nombre':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      break;
    case 'precio-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'precio-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'destacados':
    default:
      sorted.sort((a, b) => b.favorite - a.favorite);
      break;
  }

  return sorted;
}

function productCard(p: Product): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = `/producto.html?id=${p.id}`;
  a.className = 'catalog__card';

  const isAgotado = p.available === 0;

  const card = document.createElement('article');
  card.className = 'product-card' + (isAgotado ? ' is-agotado' : '');

  const badges = document.createElement('div');
  badges.className = 'catalog__card-badges';
  if (p.favorite) {
    const b = document.createElement('span');
    b.className = 'badge badge--oferta';
    b.textContent = 'Destacado';
    badges.appendChild(b);
  } else {
    badges.appendChild(document.createElement('span'));
  }
  if (isAgotado) {
    const b = document.createElement('span');
    b.className = 'badge badge--agotado';
    b.textContent = 'Agotado';
    badges.appendChild(b);
  }

  const media = document.createElement('div');
  media.className = 'product-card__media';
  media.appendChild(badges);
  if (p.images && p.images.length > 0) {
    const img = document.createElement('img');
    img.src = `/api/products/images/${p.images[0]}`;
    img.alt = p.name;
    img.loading = 'lazy';
    media.appendChild(img);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'product-card__media--empty';
    placeholder.innerHTML = icon('cart', 40);
    media.appendChild(placeholder);
  }

  const body = document.createElement('div');
  body.className = 'product-card__body';

  if (p.category) {
    const cat = document.createElement('span');
    cat.className = 'catalog__card-category';
    cat.textContent = p.category;
    body.appendChild(cat);
  }

  const name = document.createElement('h3');
  name.className = 'product-card__name';
  name.textContent = p.name;
  body.appendChild(name);

  const priceRow = document.createElement('div');
  priceRow.className = 'catalog__card-price-row';
  const price = document.createElement('span');
  price.className = 'product-card__price';
  price.textContent = money.format(p.price);
  priceRow.appendChild(price);
  body.appendChild(priceRow);

  card.appendChild(media);
  card.appendChild(body);
  a.appendChild(card);

  return a;
}

function renderGrid(): void {
  grid.classList.remove('catalog__skeleton-grid');
  grid.classList.add('catalog__grid');
  grid.innerHTML = '';

  const list = getFilteredSorted();

  if (list.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const fragment = document.createDocumentFragment();
  list.forEach((p) => fragment.appendChild(productCard(p)));
  grid.appendChild(fragment);

  staggerReveal('.catalog__card', { y: 24, duration: 0.5, stagger: 0.04 });
}

async function loadProducts(): Promise<void> {
  renderSkeleton();
  try {
    const res = await fetch('/api/products/public');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: Product[] = await res.json();
    allProducts = Array.isArray(data) ? data : [];

    const categories = Array.from(
      new Set(allProducts.map((p) => p.category).filter((c): c is string => Boolean(c)))
    ).sort((a, b) => a.localeCompare(b, 'es'));

    // Si el ?categoria= de la URL no existe entre las categorías reales, se
    // ignora (activeCategory queda huérfano y el chip "Todas" gana el estado
    // is-active porque ninguno matchea) -- evita un filtro roto silencioso.
    if (activeCategory && !categories.includes(activeCategory)) activeCategory = null;

    updateBreadcrumb();
    renderChips(categories);
    renderGrid();
  } catch {
    grid.classList.remove('catalog__skeleton-grid');
    grid.innerHTML = '';
    errorEl.hidden = false;
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchTerm = searchInput.value.trim();
    renderGrid();
  }, 250);
});

sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value as SortMode;
  renderGrid();
});

function readPriceInputs(): void {
  const min = priceMinInput.value.trim();
  const max = priceMaxInput.value.trim();
  priceMin = min === '' ? null : Math.max(0, Number(min));
  priceMax = max === '' ? null : Math.max(0, Number(max));
  renderGrid();
}

priceMinInput.addEventListener('input', () => {
  clearTimeout(priceDebounceTimer);
  priceDebounceTimer = setTimeout(readPriceInputs, 250);
});
priceMaxInput.addEventListener('input', () => {
  clearTimeout(priceDebounceTimer);
  priceDebounceTimer = setTimeout(readPriceInputs, 250);
});

void loadProducts();
