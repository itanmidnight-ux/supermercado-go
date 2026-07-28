import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/paginas-info.css';
import { mountLayout } from './layout';

mountLayout();

interface PublicSettings {
  theme_name?: string;
}

async function loadNombre(): Promise<void> {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings }: { settings: PublicSettings } = await res.json();
    if (settings?.theme_name) {
      const el = document.getElementById('privacidad-subtitle') as HTMLElement;
      el.textContent = `Cómo ${settings.theme_name} protege y usa tus datos personales.`;
    }
  } catch {
    // sin conexión: queda el texto genérico ya presente en el HTML
  }
}

void loadNombre();
