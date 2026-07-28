import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/catalogo.css';
import { mountLayout } from './layout';
import { staggerReveal } from './animations';
import { renderBreadcrumb } from './breadcrumb';
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

const grid = document.getElementById('ofertas-grid') as HTMLElement;
const emptyEl = document.getElementById('ofertas-empty') as HTMLElement;
const errorEl = document.getElementById('ofertas-error') as HTMLElement;
const breadcrumbEl = document.getElementById('ofertas-breadcrumb') as HTMLElement;

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

renderBreadcrumb(breadcrumbEl, [{ label: 'Inicio', href: '/index.html' }, { label: 'Ofertas' }]);

function renderSkeleton(): void {
  grid.innerHTML = '';
  grid.classList.add('catalog__skeleton-grid');
  grid.classList.remove('catalog__grid');
  for (let i = 0; i < 8; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton skeleton--card';
    grid.appendChild(card);
  }
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
  const oferta = document.createElement('span');
  oferta.className = 'badge badge--oferta';
  oferta.textContent = 'Oferta';
  badges.appendChild(oferta);
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
    placeholder.setAttribute('aria-hidden', 'true');
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

async function loadOfertas(): Promise<void> {
  renderSkeleton();
  try {
    const res = await fetch('/api/products/public');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: Product[] = await res.json();
    const products = Array.isArray(data) ? data : [];
    const ofertas = products.filter((p) => Number(p.favorite) === 1);

    grid.classList.remove('catalog__skeleton-grid');
    grid.classList.add('catalog__grid');
    grid.innerHTML = '';

    if (!ofertas.length) {
      emptyEl.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();
    ofertas.forEach((p) => fragment.appendChild(productCard(p)));
    grid.appendChild(fragment);

    staggerReveal('.catalog__card', { y: 24, duration: 0.5, stagger: 0.04 });
  } catch {
    grid.classList.remove('catalog__skeleton-grid');
    grid.innerHTML = '';
    errorEl.hidden = false;
  }
}

void loadOfertas();
