import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/paginas-info.css';
import { mountLayout } from './layout';

mountLayout();

interface PublicSettings {
  horario_atencion?: string;
}

async function loadHorario(): Promise<void> {
  const el = document.getElementById('faq-horario') as HTMLElement;
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) return;
    const { settings }: { settings: PublicSettings } = await res.json();
    if (settings?.horario_atencion?.trim()) el.textContent = settings.horario_atencion;
  } catch {
    // sin conexión: queda el texto genérico que ya está en el HTML
  }
}

// Acordeón: un solo <button> por pregunta, togglea la clase `is-open` en el
// `.accordion__item` padre -- la animación de alto/ícono la hace el CSS
// (grid-template-rows + rotate), no hace falta GSAP acá.
function initAccordion(): void {
  document.querySelectorAll<HTMLButtonElement>('.accordion__trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion__item') as HTMLElement;
      const isOpen = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });
  });
}

void loadHorario();
initAccordion();
