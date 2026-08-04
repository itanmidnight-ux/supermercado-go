# Rediseño y completitud funcional de `website/` — Spec

Fecha: 2026-08-04
Estado: Aprobado por el usuario, en implementación autónoma.

## Contexto

`website/` es un SPA vanilla JS (sin build tool) con hash routing:
`index.html` (shell) + `css/styles.css` (2019 líneas, sistema de tokens ya definido:
verde/naranja/dorado, radios, sombras, Poppins) + `js/app.js` (1686 líneas, todas las
vistas) + `js/auth.js` (módulo IIFE, maneja login/registro/token) + `js/cart.js`.

Solo implementa el rol **client**. El backend (`server/src/routes/`) expone además
`favorites`, `notifications`, `addresses`, `promotions` (código promocional) y un
WebSocket (`/ws`, ver `server/src/services/ws.service.js`) — ninguno de estos está
conectado hoy en el sitio. `banners` sí está conectado.

El registro público (`POST /api/auth/register`) permite crear cuentas `client` o
`worker`, pero el sitio no tiene ninguna vista para `worker` — hoy un repartidor que
se registra ahí queda atrapado viendo el catálogo de cliente.

## Objetivo

1. Pulir visualmente el sitio (sigue siendo el mismo sistema de diseño, mejorado).
2. Conectar las funciones de cliente que el backend ya soporta y el sitio no usa.
3. Manejar con gracia las cuentas que no son `client`.
4. Cero errores, cero regresiones sobre lo que ya funciona (carrito, checkout, pedidos,
   banners, ayuda, zona de entrega, acerca de).

## No-objetivos (explícitamente fuera de alcance)

- Panel de admin/worker en el sitio web — ya existe en la app Flutter
  (`app/lib/screens/admin`, `app/lib/screens/worker`) y en `dashboard/main.py`. No se
  duplica aquí.
- Ver facturas desde el sitio — `GET /api/invoices/:id` solo permite roles
  `admin`/`worker`, el cliente no tiene acceso vía API. No se puede implementar sin
  cambiar el backend, y eso no fue pedido.
- Framework nuevo / build tool — se mantiene vanilla JS sin bundler.
- Dark mode, páginas legales — no pedidas.
- Integración con el repo externo `monserrath-commerce` — es un sub-proyecto aparte
  (ver conversación), no entra en este spec.

## Arquitectura

Se mantiene el patrón actual (módulos IIFE tipo `Auth`/`Cart`, cargados por `<script>`
en `index.html`, sin `import`/`export` ES modules, sin bundler).

`app.js` (1686 líneas) hace demasiado — mezcla router + render de las 10 vistas
existentes. Se divide así:

```
website/js/
  app.js            → solo: router (hash), helpers compartidos (api(), toast(), etc.), bootstrap
  auth.js           → (sin cambios de fondo, se le agrega chequeo de rol)
  cart.js           → (sin cambios de fondo)
  favorites.js      → NUEVO módulo IIFE, patrón igual a Auth/Cart
  notifications.js  → NUEVO módulo IIFE
  addresses.js      → NUEVO módulo IIFE
  live-tracking.js  → NUEVO módulo IIFE (WebSocket)
  views/
    home.js
    products.js
    product-detail.js
    cart.js           (vista, no confundir con el módulo cart.js de estado)
    checkout.js
    auth.js            (vista de login/registro)
    orders.js
    order-detail.js    (NUEVO, extraído de orders para poder crecer con rating/tracking)
    favorites.js       (NUEVO vista)
    notifications.js   (NUEVO vista)
    role-blocked.js    (NUEVO — pantalla de bloqueo para roles no-client)
    help.js
    delivery-zone.js
    about.js
```

`index.html` agrega los nuevos `<script>` en orden de dependencia (módulos de estado
antes que `views/*.js`, `views/*.js` antes que `app.js`).

## Funciones nuevas (todas contra endpoints reales, verificados en `server/src/routes/`)

### Favoritos
- `GET /api/favorites`, `POST /api/favorites/:productId`, `DELETE /api/favorites/:productId`
  (rol `client`).
- Ícono de corazón en card de producto y en detalle de producto (toggle optimista).
- Vista "Mis Favoritos" (`#/favoritos`), enlazada desde header/menú móvil.
- Estado vacío ilustrado si no hay favoritos.

### Notificaciones
- `GET /api/notifications` (cualquier rol autenticado), `POST /api/notifications/:id/read`.
- Badge de contador en el ícono de header (solo cuenta no leídas).
- Vista/panel "Notificaciones" (`#/notificaciones`), marca como leída al abrir cada una.
- Sin WebSocket para esto — el backend no emite push de notificaciones por WS
  (`notification.service.js` solo persiste en DB + placeholder FCM). Se hace poll cada
  30s mientras la pestaña esté visible (Page Visibility API para no pollear en segundo
  plano) más una carga inmediata al entrar a la vista.

### Direcciones guardadas
- `GET/POST/PUT/DELETE /api/addresses` (rol `client`). Campos:
  `label, address, detail, neighborhood, city, lat, lng, is_default`.
- CRUD en vista "Mis Direcciones" (`#/direcciones`) y selector integrado en checkout
  (reemplaza el campo de texto libre actual por: elegir dirección guardada o
  "agregar nueva" inline).
- Sin selector de mapa (Leaflet) para pickear lat/lng en esta fase — se captura como
  campos de texto + `lat/lng` opcionales nulos si el usuario no los provee. Un picker
  de mapa tipo `address_map_picker.dart` de la app queda fuera de alcance de esta
  spec (no lo pidió el usuario explícitamente; se puede pedir como follow-up).

### Código promocional
- `POST /api/promotions/validate` con `{ code, subtotal }` (rol `client`).
- Campo "¿Tienes un código?" en carrito/checkout. Al validar, muestra descuento y lo
  aplica al total mostrado. Errores del backend (código inválido/expirado/pedido
  mínimo/agotado) se muestran tal cual (son mensajes ya en español, listos para UI).
- No existe listado público de promociones activas (`GET /api/promotions` es
  `admin`-only) — no se muestra "promociones disponibles" en home, solo el campo de
  código.

### Calificar pedido
- `POST /api/orders/:id/rate` con `{ rating: 1-5, comment }` (rol `client`), solo
  válido si `status` es `delivered` o `picked_up`.
- En detalle de pedido: si el pedido está entregado/recogido y sin `rating` aún,
  mostrar selector de estrellas + comentario opcional.

### Cancelar pedido
- `POST /api/orders/:id/cancel` (rol `client`, además `admin`).
- Botón "Cancelar pedido" en detalle de pedido, visible solo en estados cancelables
  (antes de `in_transit`/`delivered`/`picked_up`/`cancelled` — el backend ya valida
  esto server-side vía el mensaje de error "Solo se pueden..."; el frontend refleja
  ese mismo error si el usuario dispara la acción en un estado límite por condición
  de carrera).

### Tracking en vivo (ubicación del repartidor)
- WebSocket `wss://<host>/ws?token=<jwt>`. Evento `worker_location` llega al
  `user_id` dueño del pedido mientras el trabajador transmite su GPS
  (`ws.service.js` → `sendToUser`).
- En detalle de pedido, cuando `status === 'in_transit'`: mapa Leaflet (CDN, sin
  build) con marcador del repartidor que se actualiza en vivo con cada evento
  `worker_location`. Si el WS se desconecta, reintenta con backoff; si no hay eventos
  aún, muestra el mapa centrado en la dirección de entrega con mensaje "esperando
  ubicación del repartidor".
- El estado del pedido en sí (texto "confirmado"/"en camino"/etc.) sigue viniendo de
  `GET /api/orders/:id` (poll al entrar a la vista + refresco manual), no del WS —
  el WS aquí es solo para el punto en el mapa.

## Manejo de roles

Tras `Auth.fetchProfile()` (login, registro, o carga inicial con token guardado): si
`user.role !== 'client'`, el router redirige a `#/cuenta-no-disponible`
(`views/role-blocked.js`) en vez de renderizar cualquier vista de catálogo/carrito.
Esa vista muestra: nombre del usuario, su rol, mensaje "esta cuenta es de tipo
`{role}` — usa la app Supermercados Go o el panel de administración para
gestionarla", botón de cerrar sesión. No se bloquean las vistas públicas
(home/productos sin acciones de compra/ayuda/acerca de) para un `worker`/`admin` no
logueado — el bloqueo aplica solo cuando ya hay sesión activa con rol distinto de
`client`.

## Visual

Sin tocar la paleta de marca (verde `#00B860`/naranja/dorado) ni Poppins. Se refuerza:
- Jerarquía del hero de home (más contraste entre título/CTA/fondo).
- Estados vacíos ilustrados (con ícono Font Awesome grande + texto, sin imágenes
  nuevas que agregar como assets) para: carrito vacío, sin pedidos, sin favoritos, sin
  notificaciones, sin direcciones.
- Cards de producto: hover/focus consistente, skeleton de carga ya existente se
  reutiliza para las vistas nuevas.
- Botones/toasts: estados de disabled/loading consistentes (varias vistas actuales no
  deshabilitan el botón de submit mientras la petición está en curso — se corrige).
- Contraste de texto sobre `--orange`/`--gold` revisado contra WCAG AA (algunos
  combos actuales de texto blanco sobre `--gold` `#FFD93D` no pasan AA — se ajustan
  solo esos casos puntuales, sin rediseñar la paleta).

## Manejo de errores

Ya existe un helper `api()` centralizado en `app.js` — se audita que las 5 vistas
nuevas lo usen consistentemente (try/catch → `toast(error, 'error')`, sin
`alert()`/errores silenciosos). Fallos de red en el WebSocket de tracking no rompen
el resto de la vista de detalle de pedido (degrada a "sin ubicación en vivo").

## Testing / QA

Sin framework de test para este sitio (no hay uno hoy, no se introduce uno nuevo por
fuera de alcance). Verificación: levantar el servidor local y recorrer con navegador
real (Playwright) los flujos:
- Cliente: registro → login → buscar/agregar producto a favoritos → carrito → aplicar
  código promo → checkout con dirección guardada → ver pedido → (si backend de test
  lo permite) cancelar pedido → calificar pedido entregado.
- Notificaciones: badge se actualiza, marcar como leída funciona.
- Cuenta `worker`: tras login, cae en pantalla de bloqueo, no ve catálogo.
- Responsive: 375px, 768px, 1024px, 1440px en las vistas nuevas y las existentes que
  se tocan (checkout, header, detalle de pedido).

## Nota sobre control de versiones

El directorio del proyecto no es un repositorio git (`git status` no aplica). Este
spec no se commitea porque no hay repo — queda solo como archivo en
`docs/superpowers/specs/`. Si en algún momento se quiere versionar el proyecto, se
puede pedir `git init` aparte.
