import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/paginas-info.css';
import { mountLayout } from './layout';

mountLayout();

interface PublicSettings {
  theme_name?: string;
  empresa_descripcion?: string;
}

// Nombre real del negocio y descripción vienen de /api/settings/public
// (tabla settings) -- no hardcodear "Supermercado GO" en el cuerpo del texto.
async function loadNombreYDescripcion(): Promise<void> {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings }: { settings: PublicSettings } = await res.json();
    const nombre = settings?.theme_name;
    if (!nombre) return;

    const subtitle = document.getElementById('sobre-subtitle') as HTMLElement;
    subtitle.textContent = `Fundado para ofrecer productos frescos y de calidad a la comunidad de Cúcuta: así nació ${nombre}.`;

    const parrafo1 = document.getElementById('sobre-parrafo-1') as HTMLElement;
    parrafo1.textContent = settings.empresa_descripcion?.trim()
      ? settings.empresa_descripcion
      : `Somos ${nombre}, un supermercado de barrio que nació con una idea simple: que hacer el mercado sea fácil, rápido y de confianza, sin dejar de lado la atención cercana que se perdió con las grandes cadenas. Empezamos atendiendo a los vecinos del barrio y hoy seguimos con el mismo compromiso, ahora también online.`;

    const mision = document.getElementById('sobre-mision') as HTMLElement;
    mision.textContent = `Acercar productos frescos, de calidad y a precios justos a cada hogar de Cúcuta, con un servicio rápido y humano, tanto en el local de ${nombre} como a través de nuestra tienda online.`;
  } catch {
    // sin conexión al backend: el texto genérico ya cargado en el HTML queda tal cual
  }
}

void loadNombreYDescripcion();
