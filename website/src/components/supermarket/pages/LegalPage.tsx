'use client';

import { motion } from 'framer-motion';
import { useNavStore } from '@/store/navigation-store';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const termsContent = [
  { title: '1. Aceptación de los Términos', body: 'Al acceder y utilizar el sitio web y servicios de Supermercados Go (en adelante, "el Servicio"), usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, le rogamos que no utilice nuestro Servicio. Estos términos se aplican a todos los usuarios, incluidos visitantes, compradores y vendedores que accedan al Servicio.' },
  { title: '2. Descripción del Servicio', body: 'Supermercados Go es un servicio de delivery de supermercado que permite a los usuarios realizar pedidos de productos de abarrotes, alimentos, bebidas y artículos de cuidado personal y del hogar a través de nuestra plataforma web o aplicación móvil. Los productos son entregados en la dirección especificada por el usuario dentro de nuestra zona de cobertura que incluye Cúcuta, Los Patios, Villa del Rosario, Pamplonita y El Zulia.' },
  { title: '3. Registro y Cuenta', body: 'Para realizar compras, es necesario crear una cuenta proporcionando información veraz y completa. Usted es responsable de mantener la confidencialidad de su contraseña y de todas las actividades que ocurran bajo su cuenta. Supermercados Go se reserva el derecho de suspender o cancelar cuentas que violen estos términos.' },
  { title: '4. Precios y Pagos', body: 'Todos los precios están expresados en Pesos Colombianos (COP) e incluyen IVA. Los precios pueden variar según la disponibilidad y las promociones vigentes. Aceptamos pagos mediante efectivo, Nequi, Daviplata, tarjeta de crédito/débito (Visa, Mastercard), PSE y Bold. El costo de envío es de $3,500 COP salvo promociones especiales.' },
  { title: '5. Entrega', body: 'El tiempo estimado de entrega es de 30 a 60 minutos según la distancia y la disponibilidad. Supermercados Go no se hace responsable por demoras causadas por fuerza mayor, condiciones climáticas adversas o circunstancias fuera de nuestro control. Si el producto no está disponible, se ofrecerá una sustitución equivalente o reembolso.' },
  { title: '6. Política de Devoluciones', body: 'Puede solicitar devolución o reemplazo dentro de las 2 horas siguientes a la entrega si el producto presenta daños, está vencido o no corresponde al pedido. Los productos perecederos no son elegibles para devolución una vez abiertos. El reembolso se realizará mediante el mismo método de pago utilizado.' },
  { title: '7. Propiedad Intelectual', body: 'Todo el contenido del sitio web, incluyendo pero no limitado a textos, gráficos, logotipos, iconos, imágenes y software, es propiedad de Supermercados Go y está protegido por las leyes de propiedad intelectual colombianas e internacionales.' },
  { title: '8. Limitación de Responsabilidad', body: 'Supermercados Go no será responsable por daños indirectos, incidentales, especiales o consecuentes que surjan del uso o la imposibilidad de usar el Servicio. Nuestra responsabilidad total no excederá el monto pagado por el producto o servicio en cuestión.' },
];

const privacyContent = [
  { title: '1. Información que Recopilamos', body: 'Recopilamos información personal que usted nos proporciona directamente al crear una cuenta, realizar pedidos o contactarnos. Esto incluye: nombre completo, dirección de correo electrónico, número de teléfono, dirección de entrega, información de pago y preferencias de compra. También recopilamos información automáticamente: dirección IP, tipo de navegador, páginas visitadas y datos de uso.' },
  { title: '2. Cómo Usamos su Información', body: 'Utilizamos su información para: procesar y entregar sus pedidos, comunicarnos sobre el estado de sus compras, personalizar su experiencia de compra, enviar notificaciones sobre promociones y ofertas especiales, mejorar nuestros servicios y plataforma, prevenir fraudes y garantizar la seguridad de las transacciones, cumplir con obligaciones legales.' },
  { title: '3. Compartir Información', body: 'No vendemos ni alquilamos su información personal a terceros. Podemos compartir información con: repartidores para la entrega de pedidos (solo dirección y datos necesarios), proveedores de servicios de pago para procesar transacciones, autoridades legales cuando sea requerido por ley, socios comerciales con su consentimiento explícito.' },
  { title: '4. Seguridad de Datos', body: 'Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información personal. Esto incluye encriptación SSL/TLS para transmisiones de datos, almacenamiento seguro de contraseñas mediante hash, acceso restringido a datos personales, y auditorías periódicas de seguridad. Sin embargo, ningún sistema es completamente infalible.' },
  { title: '5. Cookies y Tecnologías Similares', body: 'Utilizamos cookies y tecnologías similares para mejorar su experiencia, recordar sus preferencias, analizar el uso del sitio y mostrar contenido relevante. Puede configurar su navegador para rechazar cookies, pero esto puede afectar la funcionalidad del sitio.' },
  { title: '6. Sus Derechos', body: 'Usted tiene derecho a: acceder a sus datos personales que tenemos almacenados, solicitar la corrección de datos inexactos, solicitar la eliminación de sus datos (sujeto a obligaciones legales), retirar su consentimiento para el procesamiento de datos, y presentar una queja ante la autoridad de protección de datos.' },
  { title: '7. Retención de Datos', body: 'Conservamos su información personal mientras su cuenta esté activa o según sea necesario para proporcionar nuestros servicios. Los datos de pedidos se conservan por un período de 5 años para fines contables y legales. Puede solicitar la eliminación de su cuenta en cualquier momento.' },
];

interface Props {
  type: 'terms' | 'privacy';
}

export function LegalPage({ type }: Props) {
  const { navigate, goBack } = useNavStore();
  const isTerms = type === 'terms';
  const content = isTerms ? termsContent : privacyContent;
  const Icon = isTerms ? FileText : ShieldCheck;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#00B860] to-[#008040] text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <button onClick={goBack} className="flex items-center gap-1 text-white/70 hover:text-white mb-6 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />Volver
          </button>
          <div className="flex items-center gap-3">
            <Icon className="w-8 h-8" />
            <h1 className="text-3xl md:text-4xl font-extrabold">{isTerms ? 'Términos y Condiciones' : 'Política de Privacidad'}</h1>
          </div>
          <p className="text-white/70 mt-3">Última actualización: Agosto 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-10 space-y-8">
          {content.map((section, i) => (
            <motion.section key={section.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <h2 className="text-lg font-bold text-gray-900 mb-3">{section.title}</h2>
              <p className="text-gray-600 leading-relaxed text-sm">{section.body}</p>
            </motion.section>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm mb-4">¿Tienes preguntas sobre nuestros {isTerms ? 'términos' : 'políticas de privacidad'}?</p>
          <Button variant="outline" onClick={() => navigate('contact')} className="rounded-full px-8">
            Contáctanos
          </Button>
        </div>
      </div>
    </div>
  );
}
