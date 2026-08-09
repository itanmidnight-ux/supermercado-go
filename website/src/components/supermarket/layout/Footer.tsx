'use client';

import { useNavStore, type PageName } from '@/store/navigation-store';
import {
  MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter, ChevronRight, ShieldCheck, Truck, CreditCard, RotateCcw
} from 'lucide-react';

const footerLinks: { title: string; links: { label: string; page: PageName }[] }[] = [
  {
    title: 'Comprar',
    links: [
      { label: 'Todos los productos', page: 'catalog' },
      { label: 'Ofertas', page: 'catalog' },
      { label: 'Productos destacados', page: 'catalog' },
    ],
  },
  {
    title: 'Mi Cuenta',
    links: [
      { label: 'Iniciar sesión', page: 'login' },
      { label: 'Registrarse', page: 'register' },
      { label: 'Mis Pedidos', page: 'orders' },
      { label: 'Favoritos', page: 'favorites' },
    ],
  },
  {
    title: 'Información',
    links: [
      { label: 'Sobre nosotros', page: 'about' },
      { label: 'Contacto', page: 'contact' },
      { label: 'Preguntas frecuentes', page: 'faq' },
      { label: 'Términos y condiciones', page: 'terms' },
      { label: 'Política de privacidad', page: 'privacy' },
    ],
  },
];

export function Footer() {
  const { navigate } = useNavStore();

  return (
    <footer className="bg-[#1a1a1a] text-gray-300">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, title: 'Envío rápido', desc: '30-60 minutos en Cúcuta' },
            { icon: ShieldCheck, title: 'Pago seguro', desc: 'Encriptación de punta a punta' },
            { icon: CreditCard, title: 'Múltiples pagos', desc: 'Efectivo, Nequi, Daviplata, tarjeta' },
            { icon: RotateCcw, title: 'Devolución fácil', desc: 'Garantía en todos los productos' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00B860]/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-[#00B860]" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">{item.title}</h4>
                <p className="text-gray-400 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand column */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00B860] to-[#008040] flex items-center justify-center">
              <span className="text-white font-black text-base">SG</span>
            </div>
            <div>
              <h3 className="text-white font-extrabold text-lg">Supermercados<span className="text-[#00B860]"> Go</span></h3>
            </div>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
            Tu supermercado en línea, donde vayas. Compra fácil desde tu casa con delivery en Cúcuta y zona metropolitana. Productos frescos, precios justos y entrega rápida.
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <MapPin className="w-4 h-4 text-[#00B860] shrink-0" />
              <span>KDX 1-2B Los Mangos, Cúcuta, Norte de Santander</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Phone className="w-4 h-4 text-[#00B860] shrink-0" />
              <span>+57 304 401 6277</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Mail className="w-4 h-4 text-[#00B860] shrink-0" />
              <span>hola@supermercadosgo.com</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="w-4 h-4 text-[#00B860] shrink-0" />
              <span>Lun - Dom: 7:00 AM - 10:00 PM</span>
            </div>
          </div>
        </div>

        {/* Link columns */}
        {footerLinks.map((section) => (
          <div key={section.title}>
            <h4 className="text-white font-bold text-sm mb-4">{section.title}</h4>
            <ul className="space-y-2.5">
              {section.links.map((link) => (
                <li key={link.label}>
                  <button
                    onClick={() => { navigate(link.page); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-gray-400 hover:text-[#00B860] transition-colors text-sm flex items-center gap-1 group"
                  >
                    <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Supermercados Go. Todos los derechos reservados.</p>
          <div className="flex items-center gap-3">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <button key={i} className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#00B860]/20 flex items-center justify-center transition-colors">
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <button onClick={() => navigate('terms')} className="hover:text-white transition-colors">Términos</button>
            <span className="opacity-30">|</span>
            <button onClick={() => navigate('privacy')} className="hover:text-white transition-colors">Privacidad</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
