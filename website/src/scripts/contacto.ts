import '../styles/tokens.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/contacto.css';
import { mountLayout } from './layout';

mountLayout();

interface ClientSettings {
  empresa_nombre?: string;
  empresa_descripcion?: string;
  horario_atencion?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_address?: string;
  contact_instagram?: string;
  contact_facebook?: string;
}

const UNAVAILABLE_LABEL = 'No disponible por el momento';

function setText(id: string, value: string | undefined, fallback = UNAVAILABLE_LABEL): void {
  const el = document.getElementById(id) as HTMLElement;
  el.classList.remove('skeleton', 'skeleton--text', 'contacto__skeleton');
  el.textContent = value && value.trim() ? value : fallback;
}

function waLink(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  return `https://wa.me/${digits}`;
}

// Info de contacto de un supermercado real (teléfono/dirección/horario/redes)
// es información de vidriera -- pública para cualquier visitante, sin login.
// Solo lo que es realmente sensible (nequi_phone, config de dominio/admin)
// sigue detrás de auth en /api/settings. Ver server/src/routes/settings.js.
async function loadPublicContact(): Promise<void> {
  try {
    const res = await fetch('/api/settings/public');
    if (!res.ok) throw new Error('settings/public no disponible');
    const { settings }: { settings: ClientSettings & { theme_name?: string } } = await res.json();

    const name = settings?.theme_name;
    if (name) {
      (document.getElementById('contacto-map-label') as HTMLElement).textContent = name;
      (document.getElementById('contacto-subtitle') as HTMLElement).textContent =
        `Escribinos, estamos para ayudarte en ${name}.`;
    }

    setText('contacto-email', settings.contact_email);
    setText('contacto-address', settings.contact_address);
    setText('contacto-horario', settings.horario_atencion);

    if (settings.contact_phone) {
      setText('contacto-phone', settings.contact_phone);
      const link = document.getElementById('contacto-whatsapp-link') as HTMLAnchorElement;
      link.href = waLink(settings.contact_phone);
      link.hidden = false;
    } else {
      setText('contacto-phone', undefined);
    }

    const socialEl = document.getElementById('contacto-social') as HTMLElement;
    socialEl.innerHTML = '';
    const social: Array<[string, string | undefined]> = [
      ['Instagram', settings.contact_instagram],
      ['Facebook', settings.contact_facebook],
    ];
    const links = social.filter(([, url]) => !!url);
    if (!links.length) {
      const span = document.createElement('span');
      span.textContent = UNAVAILABLE_LABEL;
      socialEl.appendChild(span);
    } else {
      links.forEach(([label, url]) => {
        const a = document.createElement('a');
        a.href = url as string;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        socialEl.appendChild(a);
      });
    }
  } catch {
    // sin conexión: dejar los campos con su fallback fijo (skeleton -> "No disponible")
    ['contacto-phone', 'contacto-email', 'contacto-address', 'contacto-horario'].forEach((id) =>
      setText(id, undefined)
    );
  }
}

void loadPublicContact();
