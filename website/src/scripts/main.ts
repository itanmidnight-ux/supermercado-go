import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/home.css';
import { mountLayout } from './layout';
import { gsap, staggerReveal } from './animations';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const DEFAULT_BRAND = 'Supermercado GO';

interface PublicProduct {
  id: number;
  name: string;
  price: number;
  favorite: number;
  category: string | null;
  images: string[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  'frutas y verduras': '🥦',
  lácteos: '🥛',
  lacteos: '🥛',
  carnes: '🥩',
  panadería: '🥖',
  panaderia: '🥖',
  bebidas: '🥤',
  aseo: '🧼',
};

function fmtPrice(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function placeholderEmoji(category: string | null): string {
  if (!category) return '🛒';
  return CATEGORY_EMOJI[category.toLowerCase()] || '🛒';
}

function productCardHtml(p: PublicProduct): string {
  const media = p.images?.length
    ? `<img src="/api/products/images/${encodeURIComponent(p.images[0])}" alt="${p.name}" loading="lazy" />`
    : `<span class="product-card__media--placeholder" aria-hidden="true">${placeholderEmoji(p.category)}</span>`;

  return `
    <article class="product-card" data-reveal-item>
      <div class="product-card__media">${media}</div>
      <div class="product-card__body">
        <h3 class="product-card__name">${p.name}</h3>
        <span class="product-card__price">${fmtPrice(p.price)}</span>
      </div>
      <div class="product-card__footer">
        <a href="/catalogo.html" class="btn btn-secondary" style="width: 100%;">Ver en catálogo</a>
      </div>
    </article>
  `;
}

/** Trae favoritos (o los primeros 6 si no hay ninguno marcado) desde el
 * catálogo público, sin bloquear el resto de la página si falla. */
async function loadFeaturedProducts(): Promise<void> {
  const grid = document.querySelector<HTMLElement>('[data-featured-grid]');
  if (!grid) return;

  try {
    const res = await fetch('/api/products/public');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const products: PublicProduct[] = await res.json();

    const favorites = products.filter((p) => Number(p.favorite) === 1);
    const featured = (favorites.length ? favorites : products).slice(0, 6);

    if (!featured.length) {
      grid.innerHTML = `<p style="color: var(--fg-dim);">Todavía no hay productos cargados.</p>`;
      return;
    }

    grid.innerHTML = featured.map(productCardHtml).join('');
    staggerReveal(Array.from(grid.querySelectorAll('[data-reveal-item]')), { scrollTrigger: true });
  } catch {
    // sin conexión al backend: el sitio no debe romperse, solo se oculta la sección
    grid.innerHTML = `<p style="color: var(--fg-dim);">No pudimos cargar los productos destacados en este momento.</p>`;
  }
}

/** Nombre del negocio real desde settings, con fallback silencioso. */
async function loadBrandName(): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-brand-eyebrow]');
  if (!el) return;
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings } = await res.json();
    const name = settings?.theme_name;
    if (name && name !== DEFAULT_BRAND) {
      el.textContent = `🛒 ${name}`;
    }
  } catch {
    // queda el fallback "Supermercado GO" ya en el HTML
  }
}

/** Hero: título letra por letra + blobs con parallax de scroll sutil. */
function animateHero(): void {
  const title = document.querySelector<HTMLElement>('[data-hero-title]');
  const eyebrow = document.querySelector<HTMLElement>('[data-brand-eyebrow]');
  const subtitle = document.querySelector<HTMLElement>('[data-hero-subtitle]');
  const actions = document.querySelector<HTMLElement>('[data-hero-actions]');
  const blobs = document.querySelectorAll<HTMLElement>('[data-hero-blob]');

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (eyebrow) tl.from(eyebrow, { opacity: 0, y: -12, duration: 0.5 });

  if (title) {
    const split = new SplitText(title, { type: 'chars' });
    tl.from(
      split.chars,
      { opacity: 0, y: 24, rotateX: -60, stagger: 0.018, duration: 0.6 },
      '-=0.2'
    );
  }

  if (subtitle) tl.from(subtitle, { opacity: 0, y: 20, duration: 0.6 }, '-=0.35');
  if (actions) tl.from(actions.children, { opacity: 0, y: 16, stagger: 0.1, duration: 0.5 }, '-=0.3');

  // Blobs: entrada suave + drift continuo + parallax de scroll.
  blobs.forEach((blob, i) => {
    gsap.from(blob, { opacity: 0, scale: 0.6, duration: 1.2, ease: 'power2.out', delay: i * 0.1 });
    gsap.to(blob, {
      y: i % 2 === 0 ? 30 : -30,
      x: i % 2 === 0 ? -20 : 20,
      duration: 6 + i,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.to(blob, {
      y: `+=${60 + i * 20}`,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1,
      },
    });
  });
}

mountLayout();
animateHero();
void loadBrandName();
void loadFeaturedProducts();
