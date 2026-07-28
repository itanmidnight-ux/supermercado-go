/**
 * Breadcrumb compartido entre catalogo.ts y producto.ts -- misma estructura
 * "Inicio › Catálogo › ..." con `chevron-right` de icons.ts como separador
 * (nunca texto "/" ni emoji).
 */
import { icon } from './icons';

export interface BreadcrumbItem {
  label: string;
  /** Si falta, el crumb se renderiza como texto plano (item actual, sin link). */
  href?: string;
}

export function renderBreadcrumb(nav: HTMLElement, items: BreadcrumbItem[]): void {
  const parts: string[] = [];
  items.forEach((item, i) => {
    if (i > 0) {
      parts.push(`<span class="breadcrumb__sep">${icon('chevron-right', 14)}</span>`);
    }
    parts.push(
      item.href
        ? `<a href="${item.href}" class="breadcrumb__link">${item.label}</a>`
        : `<span class="breadcrumb__current">${item.label}</span>`
    );
  });
  nav.innerHTML = parts.join('');
}
