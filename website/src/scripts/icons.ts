/**
 * Sistema de iconos SVG inline -- reemplaza los emoji usados como iconos
 * estructurales (🥦🥛🥩🛒✓💵📱💳 etc.), anti-patrón para UI profesional:
 * el emoji rendereiza distinto según SO/navegador, no se puede themear con
 * los tokens de color (--brand, --highlight, etc.) y no escala nítido.
 *
 * Estilo Lucide/Heroicons outline: viewBox 24x24, stroke="currentColor",
 * fill="none", stroke-width 2, sin librería npm -- paths escritos a mano.
 *
 * Dos formas de uso:
 *   1. Directo en TS: `el.innerHTML = icon('cart', 24)`.
 *   2. Declarativo en HTML estático (partials, index.html): dejar
 *      `<span data-icon="cart" data-icon-size="24" aria-hidden="true"></span>`
 *      y llamar `mountIcons()` una vez montado el DOM (ya lo hace
 *      `mountLayout()` en layout.ts).
 */

export type IconName =
  | 'cart'
  | 'search'
  | 'user'
  | 'menu'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'star'
  | 'star-outline'
  | 'leaf'
  | 'milk'
  | 'beef'
  | 'bread'
  | 'cup-soda'
  | 'spray'
  | 'shield-check'
  | 'truck'
  | 'credit-card'
  | 'wallet'
  | 'banknote'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'lock'
  | 'alert-triangle'
  | 'map-pin'
  | 'mail'
  | 'clock'
  | 'phone';

/** Cuerpo interno (paths) de cada ícono, sobre viewBox 0 0 24 24. */
const ICONS: Record<IconName, string> = {
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  'star-outline': '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10-1.9 0-3.6-.7-5-1.8"/><path d="M2 21c0-3.5 1.7-7 6-7"/>',
  milk: '<path d="M9 2h6"/><path d="M10 2v4.2L7 11v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9l-3-4.8V2"/><path d="M7 15h10"/>',
  beef: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.5 1.5 6.5 1.5 8 0"/>',
  bread: '<path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M4 15a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3z"/>',
  'cup-soda': '<path d="M8 2h8l-1 2H9z"/><path d="M7 4h10l-1.3 16.2A2 2 0 0 1 13.7 22h-3.4a2 2 0 0 1-2-1.8L7 4z"/><path d="M16.5 8l2-4"/><path d="M8 12h8"/>',
  spray: '<path d="M10 2v3"/><path d="M13 2v3"/><path d="M7 8h6l2-2h2"/><path d="M18 4l2 2-2 2"/><path d="M7 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10"/>',
  'shield-check': '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>',
  truck: '<path d="M1 3h13v13H1z"/><path d="M14 8h4l4 4v4h-8z"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  wallet: '<path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M2 9V6a2 2 0 0 1 2-2h13"/><circle cx="17" cy="14" r="1.4"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01"/><path d="M18 15v.01"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none"/>',
  facebook: '<circle cx="12" cy="12" r="9"/><path d="M14 8.5h-1.5A1.5 1.5 0 0 0 11 10v2h3l-.4 3H11v6"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.44 15.34L2 22l4.8-1.5A10 10 0 1 0 12 2z"/><path d="M8.5 8.9c.3-.6.7-.6 1-.6h.4c.3 0 .5.1.6.4l.7 1.7c.1.2 0 .5-.1.6l-.5.6c-.2.2-.2.4-.1.6.4.8 1.6 2 2.4 2.4.2.1.4.1.6-.1l.6-.5c.2-.2.4-.2.6-.1l1.7.7c.3.1.4.3.4.6v.4c0 .3 0 .7-.6 1-1.5.9-3.5.3-5-1.2-1.5-1.5-2.6-3.3-2.7-5z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  'alert-triangle': '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5"/><path d="M12 17v.01"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 2 .7 3a2 2 0 0 1-.4 2.1L8 10.3a16 16 0 0 0 6 6l1.5-1.4a2 2 0 0 1 2.1-.4c1 .4 2 .6 3 .7a2 2 0 0 1 1.7 2z"/>',
};

/** `star` va relleno (rating); el resto son outline (fill="none"). */
const FILLED: Partial<Record<IconName, true>> = {
  star: true,
};

/** Devuelve el `<svg>...</svg>` completo, listo para `innerHTML`. */
export function icon(name: string, size = 20): string {
  const body = ICONS[name as IconName] ?? ICONS.cart;
  const fill = FILLED[name as IconName] ? 'currentColor' : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/**
 * Resuelve todos los `[data-icon]` presentes bajo `root` (por defecto todo
 * el documento) inyectando el SVG correspondiente. Pensado para partials
 * estáticos (header/footer) y markup estático de página (index.html) --
 * el markup generado dinámicamente en TS (ej. cards de producto) debe llamar
 * a `icon()` directamente al construir su string, no depende de esta función.
 */
export function mountIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset.icon;
    if (!name) return;
    const size = el.dataset.iconSize ? Number(el.dataset.iconSize) : 20;
    el.innerHTML = icon(name, size);
  });
}
