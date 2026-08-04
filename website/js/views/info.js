/* website/js/views/info.js — Vistas informativas (Ayuda, Zona de Entrega, Acerca de) */
(function () {
  'use strict';

  // Nota: no se desestructura `window.App` aquí arriba porque este script se
  // carga ANTES que app.js (que es quien crea window.App) — a esta altura
  // `window.App` todavía no existe. Las funciones de abajo solo se invocan
  // más tarde (tras DOMContentLoaded), momento en el que `App` ya se resolvió
  // como global, así que referenciarlo como `App.xxx` dentro de los cuerpos
  // de función (enlace tardío) es seguro; capturarlo en una const aquí no lo
  // sería.

  // ═══════════════════════════════════════════════════════════════════
  //  HELP VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderHelp(container) {
    const settings = App.settings;
    const phone = settings ? settings.business_phone : '+573044016277';
    const email = settings ? settings.business_email : 'carrierjawerly@gmail.com';
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const address = settings ? settings.business_address : 'Cucuta, N. de Santander';

    const faqs = [
      { q: 'Como hago un pedido?', a: 'Explora nuestros productos, agrega los que necesites al carrito y finaliza tu compra eligiendo tipo de entrega y metodo de pago.' },
      { q: 'Cual es la tarifa de envio?', a: `La tarifa de envio es de ${App.money(settings ? settings.delivery_fee : 4900)}. En pedidos mayores a ${App.money(settings ? settings.free_delivery_min : 50000)} el envio es completamente gratis.` },
      { q: 'En que zona hacen entregas?', a: 'Realizamos entregas en toda la ciudad de Cucuta y zona metropolitana. Consulta nuestra zona de entrega para mas detalles.' },
      { q: 'Cuales son los metodos de pago?', a: 'Aceptamos efectivo, Nequi, Daviplata y tarjeta. El pago se realiza al momento de la entrega o recogida.' },
      { q: 'Puedo recoger mi pedido?', a: 'Si! Puedes elegir la opcion de recogida en tienda. Recibiras un codigo que debes presentar al llegar.' },
      { q: 'Como cancelo un pedido?', a: 'Puedes cancelar tu pedido desde la seccion "Mis Pedidos" siempre que este en estado pendiente o confirmado. El stock se restituye automaticamente.' },
      { q: 'Que horario tienen?', a: `Nuestro horario de atencion es ${hours}. Los pedidos se procesan dentro de este horario.` },
      { q: 'Los productos pesados como se venden?', a: 'Los productos pesados (frutas, verduras, carnes) se venden por libra (lb). El precio que ves es por cada libra.' },
    ];

    container.innerHTML = `
      <div class="help-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-life-ring" style="color:var(--green);"></i> Centro de Ayuda</h1>
          <p>Encuentra respuestas a las preguntas mas frecuentes</p>
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:16px;">Preguntas Frecuentes</h3>
        <div id="faqContainer">
          ${faqs.map((faq, i) => `
            <div class="faq-item" data-faq="${i}">
              <button class="faq-question" onclick="this.closest('.faq-item').classList.toggle('open')">
                <span>${faq.q}</span>
                <i class="fas fa-chevron-down"></i>
              </button>
              <div class="faq-answer"><p>${faq.a}</p></div>
            </div>
          `).join('')}
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-top:32px;margin-bottom:16px;">Contacto</h3>
        <div class="contact-cards">
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--green-light);color:var(--green);"><i class="fab fa-whatsapp"></i></div>
            <div class="contact-card-info">
              <h4>WhatsApp</h4>
              <p>${phone}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--orange-light);color:var(--orange);"><i class="fas fa-phone"></i></div>
            <div class="contact-card-info">
              <h4>Telefono</h4>
              <p>${phone}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--blue-light);color:var(--blue);"><i class="fas fa-envelope"></i></div>
            <div class="contact-card-info">
              <h4>Correo Electronico</h4>
              <p>${email}</p>
            </div>
          </div>
          <div class="contact-card">
            <div class="contact-card-icon" style="background:var(--gray-100);color:var(--gray-600);"><i class="fas fa-map-marker-alt"></i></div>
            <div class="contact-card-info">
              <h4>Direccion</h4>
              <p>${address}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DELIVERY ZONE VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderDeliveryZone(container) {
    const settings = App.settings;
    const zone = settings ? settings.operating_zone : 'Cucuta';
    const fee = settings ? settings.delivery_fee : 4900;
    const freeMin = settings ? settings.free_delivery_min : 50000;
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const address = settings ? settings.business_address : 'KDX 1-2B Los Mangos';

    const neighborhoods = [
      'Centro', 'El Bosque', 'Los Mangos', 'La Playa', 'San Luis',
      'Colombia', 'Garcia Rovira', 'Villa del Rosario', 'Alto de Caicedo',
      'Santa Rosa', 'Sur Occidente', 'Norte', 'Oriental',
      'La Esmeralda', 'El Progreso', '7 de Agosto', 'San Jose',
    ];

    container.innerHTML = `
      <div class="zone-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-map-marker-alt" style="color:var(--orange);"></i> Zona de Entrega</h1>
          <p>Cobrimos toda la ciudad de ${zone}</p>
        </div>

        <div class="zone-map-container">
          <i class="fas fa-map-marked-alt"></i>
          <span style="font-weight:600;">Mapa de cobertura - ${zone}</span>
          <span style="font-size:13px;">Entregamos a toda la ciudad y zona metropolitana</span>
        </div>

        <div class="zone-info-card mb-3">
          <h3><i class="fas fa-truck" style="margin-right:8px;"></i>Informacion de Entrega</h3>
          <div style="text-align:left;margin-top:16px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Ciudad</span>
              <strong>${zone}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Tarifa de envio</span>
              <strong>${App.money(fee)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Envio gratis desde</span>
              <strong style="color:var(--green);">${App.money(freeMin)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,184,96,0.2);">
              <span style="color:var(--gray-600);">Horario</span>
              <strong>${hours}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;">
              <span style="color:var(--gray-600);">Tiempo estimado</span>
              <strong>30-60 minutos</strong>
            </div>
          </div>
        </div>

        <h3 style="font-size:16px;font-weight:700;color:var(--gray-900);margin-bottom:16px;">Barrios que Cubrimos</h3>
        <div class="zone-neighborhoods">
          ${neighborhoods.map(n => `
            <div class="zone-neighborhood"><i class="fas fa-check-circle"></i> ${n}</div>
          `).join('')}
        </div>

        <div class="about-card mt-3">
          <h3><i class="fas fa-store"></i> Punto de Recogida</h3>
          <p><i class="fas fa-map-marker-alt" style="color:var(--orange);margin-right:6px;"></i> ${address}</p>
          <p style="margin-top:8px;">Si prefieres recoger tu pedido, puedes pasar por nuestra tienda en el horario de atencion.</p>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="#/productos" class="btn btn-primary btn-lg" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Hacer un Pedido</a>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ABOUT VIEW
  // ═══════════════════════════════════════════════════════════════════

  function renderAbout(container) {
    const settings = App.settings;
    const name = settings ? settings.business_name : 'Supermercados Go';
    const phone = settings ? settings.business_phone : '+573044016277';
    const email = settings ? settings.business_email : 'carrierjawerly@gmail.com';
    const hours = settings ? settings.business_hours : '6:00 AM - 6:00 PM';
    const city = settings ? settings.business_city : 'Cucuta';
    const dept = settings ? settings.business_department : 'Norte de Santander';
    const address = settings ? settings.business_address : 'KDX 1-2B Los Mangos';

    container.innerHTML = `
      <div class="about-page">
        <div class="about-hero">
          <i class="fas fa-shopping-basket"></i>
          <h1>${name}</h1>
          <p>Tu supermercado de confianza en ${city}, ${dept}</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-heart"></i> Nuestra Mision</h3>
          <p>Llevar los mejores productos de supermercado hasta la puerta de tu hogar, con la mayor facilidad, rapidez y al mejor precio. Queremos que comprar los alimentos de tu familia sea una experiencia comoda y placentera.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-clock"></i> Horario de Atencion</h3>
          <p><strong>${hours}</strong> - Lunes a Sabado</p>
          <p style="margin-top:4px;">Realizamos entregas dentro de este horario. Los pedidos realizados fuera de horario se procesaran el siguiente dia habil.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-truck"></i> Servicio de Domicilios</h3>
          <p>Ofrecemos servicio de entrega a domicilio en toda la ciudad de ${city}. Contamos con repartidores confiables que llevan tus productos con cuidado y en el menor tiempo posible. Tambien ofrecemos la opcion de recogida en tienda para quienes prefieren pasar a buscar su pedido.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-shield-alt"></i> Calidad Garantizada</h3>
          <p>Seleccionamos cuidadosamente cada producto que ofrecemos. Trabajamos con proveedores de confianza para asegurar la frescura y calidad de frutas, verduras, carnes y todos los productos de nuestra tienda. Si no estas satisfecho, comunicate con nosotros.</p>
        </div>

        <div class="about-card">
          <h3><i class="fas fa-map-marker-alt"></i> Ubicacion</h3>
          <p>${address}<br>${city}, ${dept}</p>
          <div style="margin-top:12px;">
            <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="btn btn-primary btn-sm" style="border-radius:var(--radius-full);margin-right:8px;"><i class="fas fa-phone"></i> Llamar</a>
            <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline btn-sm" style="border-radius:var(--radius-full);color:var(--green);border-color:var(--green);"><i class="fab fa-whatsapp"></i> WhatsApp</a>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════
  window.Views = window.Views || {};
  window.Views.renderHelp = renderHelp;
  window.Views.renderDeliveryZone = renderDeliveryZone;
  window.Views.renderAbout = renderAbout;

})();
