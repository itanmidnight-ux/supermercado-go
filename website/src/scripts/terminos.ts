import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/paginas-info.css';
import { mountLayout } from './layout';

mountLayout();

interface PublicSettings {
  theme_name?: string;
}

// Nombre real del negocio en el subtítulo -- no hardcodear "Supermercado GO".
async function loadNombre(): Promise<void> {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings }: { settings: PublicSettings } = await res.json();
    if (settings?.theme_name) {
      const el = document.getElementById('terminos-subtitle') as HTMLElement;
      el.textContent = `Condiciones de uso de nuestro sitio web y de la tienda online de ${settings.theme_name}.`;
    }
  } catch {
    // sin conexión: queda el texto genérico ya presente en el HTML
  }
}

void loadNombre();
