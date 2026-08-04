# Rediseño y completitud funcional de `website/` — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir `website/js/app.js` (1686 líneas, todas las vistas) en módulos por
vista, y conectar 5 funciones de cliente que el backend ya expone y el sitio no usa
(favoritos, notificaciones, direcciones, código promocional, calificación de pedido,
tracking en vivo del repartidor), manejando con gracia cuentas `worker`/`admin` que
inicien sesión en el sitio — sin build tool, sin romper nada que ya funciona.

**Architecture:** Vanilla JS sin bundler, `<script>` tags en `index.html`. Un
namespace compartido `window.App` (helpers + estado) y `window.Views` (una función
`renderX` por vista) reemplazan la única IIFE monolítica de `app.js`. Los 4 módulos
nuevos (`Favorites`, `Notifications`, `Addresses`, `LiveTracking`) siguen el mismo
patrón IIFE que ya usan `Auth`/`Cart`.

**Tech Stack:** HTML/CSS/JS vanilla (sin build), Express sirve estático, Leaflet
(CDN) solo para el mapa de tracking en vivo, WebSocket nativo del navegador contra
`/ws` del backend existente.

## Global Constraints

- Cero cambios al backend (`server/`) — todos los endpoints usados ya existen y ya
  fueron verificados leyendo el código fuente real (no se asume nada).
- Cero build tool nuevo, cero framework — se mantiene el patrón `<script>` +
  IIFE + namespace global que ya usa el proyecto.
- No se toca `dashboard/`, `app/` (Flutter), ni el repo externo
  `monserrath-commerce` — fuera de alcance de este plan (ver spec).
- No se implementa vista de facturas para cliente — `GET /api/invoices/:id` es
  `admin`/`worker`-only, no hay endpoint accesible para `client`.
- Paleta de marca (verde `#00B860`, naranja `#FF8C00`, dorado `#FFD93D`) y fuente
  Poppins no cambian.
- Cada tarea deja el sitio en un estado funcionalmente probado — no hay "lo arreglo
  en la siguiente tarea".
- No hay framework de test para este sitio y no se introduce uno — la verificación de
  cada tarea es un recorrido real en navegador (Playwright MCP: `mcp__playwright__*`)
  contra el servidor local corriendo, mirando el DOM/network resultante.

## Namespace contract (válido para todas las tareas)

**`window.App`** (definido en `app.js`, ampliado en la Tarea 1):
- `App.api(url, options)` → `Promise<data>` — ya existe, sin cambios de comportamiento.
- `App.toast(message, type='success')` — ya existe.
- `App.money(amount)`, `App.formatDate(dateStr)`, `App.statusChip(status)`,
  `App.unitLabel(unit)`, `App.productImgHTML(image, size)`, `App.getCategoryIcon(name)`
  — ya existen, solo se mueven a `App.*`.
- `App.productCardHTML(p)`, `App.bindAddToCartButtons(container)` — ya existen
  (líneas 350-405 actuales), se mueven a `App.*`.
- `App.bindFavoriteButtons(container)` — NUEVO, Tarea 6.
- `App.settings`, `App.categories`, `App.featuredProducts`, `App.banners` — mismo
  estado que hoy vive en variables privadas de la IIFE, ahora propiedades públicas de
  solo-lectura-por-convención en `App`. Las setea `init()` en `app.js`.
- `App.redirectToProduct(id)` — ya existe, sin cambios (usado por `onclick=` inline).
- `App.router()` — el router ya existente, expuesto para que las vistas (ahora en
  otros archivos) puedan forzar un re-render tras una acción (ej. cancelar pedido).

**`window.Views`** (nuevo, uno por archivo bajo `website/js/views/`):
- `Views.renderHome(container)`, `Views.renderProducts(container)`,
  `Views.renderProductDetail(container, productId)` — `views/catalog.js`.
- `Views.renderCart(container)`, `Views.renderCheckout(container)` — `views/shopping.js`.
- `Views.renderAuthPage(container)`, `Views.renderOrders(container)`,
  `Views.openOrderDetail(orderId)` — `views/account.js`. (El detalle de pedido sigue
  siendo un modal, no una ruta — así está hoy, no se cambia esa decisión.)
- `Views.renderHelp(container)`, `Views.renderDeliveryZone(container)`,
  `Views.renderAbout(container)` — `views/info.js`.
- `Views.renderFavorites(container)` — NUEVO, `views/favorites.js`, Tarea 6.
- `Views.renderNotifications(container)` — NUEVO, `views/notifications.js`, Tarea 7.
- `Views.renderAddresses(container)` — NUEVO, `views/addresses.js`, Tarea 8.
- `Views.renderRoleBlocked(container)` — NUEVO, `views/role-blocked.js`, Tarea 10.

**Módulos nuevos** (mismo patrón IIFE que `Auth`/`Cart`, un archivo cada uno):
- `Favorites` (`js/favorites.js`): `load()`, `isFavorite(productId)`, `toggle(productId)`,
  `getAll()`, `onChange(cb)`.
- `Notifications` (`js/notifications.js`): `load()`, `getUnreadCount()`, `getAll()`,
  `markRead(id)`, `startPolling()`, `stopPolling()`, `onChange(cb)`.
- `Addresses` (`js/addresses.js`): `load()`, `getAll()`, `create(data)`,
  `update(id, data)`, `remove(id)`, `getDefault()`.
- `LiveTracking` (`js/live-tracking.js`): `connect()`, `disconnect()`,
  `onLocation(orderId, cb)` → devuelve función para desuscribirse.

Orden de `<script>` en `index.html` (cada uno depende solo de los anteriores):
`cart.js` → `auth.js` → `favorites.js` → `notifications.js` → `addresses.js` →
`live-tracking.js` → `views/catalog.js` → `views/shopping.js` → `views/account.js` →
`views/info.js` → `views/favorites.js` → `views/notifications.js` →
`views/addresses.js` → `views/role-blocked.js` → `app.js`.

---

## Task 1: Namespace compartido `App`

**Files:**
- Modify: `website/js/app.js:1-138` (bloque de helpers/estado, antes del router)

**Interfaces:**
- Produces: `window.App` con todos los miembros listados en "Namespace contract"
  arriba, EXCEPTO `bindFavoriteButtons` (Tarea 6).

Esta tarea es puramente aditiva: no mueve ni borra ninguna función todavía, solo
expone lo que ya existe. Cero riesgo de regresión.

- [ ] **Step 1: Reemplazar el bloque `window.App = {...}` actual (líneas 1627-1631)**

Ubicación actual:
```js
window.App = {
  redirectToProduct(id) {
    window.location.hash = '#/producto/' + id;
  },
};
```

Reemplazar por (mantiene `redirectToProduct`, agrega el resto por referencia a las
funciones ya definidas más arriba en el mismo archivo — en este punto todavía viven
en la misma IIFE, así que son visibles por closure):

```js
window.App = {
  redirectToProduct(id) {
    window.location.hash = '#/producto/' + id;
  },
  api,
  toast,
  money,
  formatDate,
  statusChip,
  unitLabel,
  productImgHTML,
  getCategoryIcon,
  productCardHTML,
  bindAddToCartButtons,
  get settings() { return settings; },
  get categories() { return categories; },
  get featuredProducts() { return featuredProducts; },
  get banners() { return banners; },
  router,
};
```

(Se usan `get` accessors para `settings`/`categories`/etc. porque esas variables se
reasignan dentro de `init()` — un accessor siempre lee el valor actual, una copia
directa quedaría congelada en `null`/`[]` desde antes de `init()`.)

- [ ] **Step 2: Verificar en navegador**

Levantar el servidor (`cd server && node src/index.js`), abrir
`http://localhost:3777/` con Playwright, en la consola del navegador
(`mcp__playwright__browser_evaluate`) ejecutar:
```js
() => typeof window.App.api === 'function' && typeof window.App.productCardHTML === 'function' && window.App.router === undefined ? 'FAIL router' : 'OK'
```
Esperado: `"OK"` (nota: `router` SÍ debe estar definida en este punto — si el check
anterior confunde, simplemente confirmar con
`() => typeof window.App.router === 'function'` → `true`).
Navegar a `#/`, `#/productos`, confirmar visualmente que se ven igual que antes
(catálogo, banners, categorías). Ningún cambio visual esperado.

- [ ] **Step 3: Commit**

No hay git en este proyecto (`git status` no aplica) — omitir este paso en todas las
tareas de este plan. Guardar el archivo es suficiente.

---

## Task 2: Extraer vistas de catálogo (`views/catalog.js`)

**Files:**
- Create: `website/js/views/catalog.js`
- Modify: `website/js/app.js` (eliminar líneas 185-405 movidas: `renderHome`,
  `productCardHTML`, `bindAddToCartButtons`, `renderProducts` 410-521,
  `renderProductDetail` 526-640; actualizar el `router()` para llamar `Views.render*`)
- Modify: `website/index.html` (agregar `<script src="js/views/catalog.js">`)

**Interfaces:**
- Consumes: `App.api`, `App.toast`, `App.money`, `App.productImgHTML`,
  `App.unitLabel`, `App.getCategoryIcon`, `App.settings`, `App.categories`,
  `App.featuredProducts`, `App.banners`, `Cart.*`, `Auth.*`.
- Produces: `Views.renderHome`, `Views.renderProducts`, `Views.renderProductDetail`,
  y (dentro del mismo archivo, no exportadas) `productCardHTML`/`bindAddToCartButtons`
  reexpuestas también en `App.productCardHTML`/`App.bindAddToCartButtons` para que
  Task 1 siga siendo válida (ver Step 2).

- [ ] **Step 1: Crear `website/js/views/catalog.js`**

Copiar tal cual el contenido actual de `app.js` líneas 185-405 (`renderHome`,
`productCardHTML`, `bindAddToCartButtons`) y 410-640 (`renderProducts`,
`renderProductDetail`), envuelto así:

```js
/* website/js/views/catalog.js — Home, Productos, Detalle de producto */
(function () {
  'use strict';

  const { api, toast, money, productImgHTML, unitLabel, getCategoryIcon } = window.App;

  // ── pegar aquí tal cual: renderHome (líneas 185-349 actuales) ──
  // ── pegar aquí tal cual: productCardHTML (líneas 350-383 actuales) ──
  // ── pegar aquí tal cual: bindAddToCartButtons (líneas 386-404 actuales) ──
  // ── pegar aquí tal cual: renderProducts (líneas 410-521 actuales) ──
  // ── pegar aquí tal cual: renderProductDetail (líneas 526-639 actuales) ──

  // Dentro de las funciones pegadas: reemplazar cualquier referencia libre a
  // `settings`, `categories`, `featuredProducts`, `banners` (variables que en
  // app.js eran privadas de la IIFE) por `App.settings`, `App.categories`,
  // `App.featuredProducts`, `App.banners`.

  window.Views = window.Views || {};
  window.Views.renderHome = renderHome;
  window.Views.renderProducts = renderProducts;
  window.Views.renderProductDetail = renderProductDetail;

  // Reexponer en App para que otras vistas (favorites, etc.) puedan reusar la
  // misma card sin duplicar el HTML.
  window.App.productCardHTML = productCardHTML;
  window.App.bindAddToCartButtons = bindAddToCartButtons;
})();
```

Nota: `renderHome` referencia `bindAddToCartButtons(container)` (línea 346 actual) —
queda dentro del mismo archivo, sin cambios. `renderProducts` también la referencia
(línea 476) — igual.

- [ ] **Step 2: Borrar de `app.js` lo que se movió**

Eliminar de `app.js`:
- Líneas 185-405 (`renderHome` hasta el final de `bindAddToCartButtons`).
- Líneas 410-640 (`renderProducts`, `renderProductDetail`), incluyendo los separadores
  `═══` de sección entre ellas.

Como `App.productCardHTML`/`App.bindAddToCartButtons` ahora se asignan desde
`views/catalog.js` (Step 1) en vez de existir como funciones locales de `app.js`,
quitar también esas dos líneas del objeto `window.App = {...}` armado en la Tarea 1
(quedan asignadas desde afuera, no inline).

- [ ] **Step 3: Actualizar el router en `app.js`**

Cambiar las 3 líneas correspondientes dentro de `function router()`:
```js
    } else if (hash === '#/' || hash === '#' || hash === '') {
      Views.renderHome(app);
    } else if (hash.startsWith('#/productos')) {
      Views.renderProducts(app);
    } else if (hash.startsWith('#/producto/')) {
      const id = hash.replace('#/producto/', '');
      Views.renderProductDetail(app, id);
```

- [ ] **Step 4: Agregar el script tag**

En `website/index.html`, antes de `<script src="js/app.js"></script>`:
```html
<script src="js/views/catalog.js"></script>
```

- [ ] **Step 5: Verificar en navegador**

Playwright: navegar a `#/` → confirmar hero, banners (si hay), categorías y
productos destacados se ven igual que antes. Navegar a `#/productos` → confirmar
grid de productos, filtro por categoría (`#/productos?categoria=X`), buscador
(`#/productos?q=texto`). Click en un producto → `#/producto/:id` → confirmar detalle,
selector de cantidad, botón agregar al carrito funcional (el contador del header debe
subir). Sin errores en consola (`mcp__playwright__browser_console_messages`).

- [ ] **Step 6: Commit** — omitido (sin git, ver Task 1 Step 3).

---

## Task 3: Extraer vistas de compra (`views/shopping.js`)

**Files:**
- Create: `website/js/views/shopping.js`
- Modify: `website/js/app.js` (eliminar `renderCart` 645-728, `renderCheckout`
  733-953; actualizar router)
- Modify: `website/index.html`

**Interfaces:**
- Consumes: `App.api`, `App.toast`, `App.money`, `App.statusChip`, `App.settings`,
  `Cart.*`, `Auth.*`, `App.router` (para re-renderizar tras vaciar carrito).
- Produces: `Views.renderCart`, `Views.renderCheckout`.

- [ ] **Step 1: Crear `website/js/views/shopping.js`**

Mismo patrón que Task 2: copiar tal cual `renderCart` (líneas 645-728 actuales de
`app.js`) y `renderCheckout` (733-953), envueltas en IIFE, reemplazando referencias
libres a `settings` por `App.settings`, `api`/`toast`/`money`/`statusChip` por
`App.*`. Exponer:

```js
window.Views = window.Views || {};
window.Views.renderCart = renderCart;
window.Views.renderCheckout = renderCheckout;
```

- [ ] **Step 2: Borrar de `app.js` las líneas 645-953** (incluyendo separadores de
  sección entre `renderCart` y `renderCheckout`).

- [ ] **Step 3: Actualizar el router en `app.js`**
```js
    } else if (hash === '#/carrito') {
      Views.renderCart(app);
    } else if (hash === '#/checkout') {
      Views.renderCheckout(app);
```

- [ ] **Step 4:** Agregar `<script src="js/views/shopping.js"></script>` en
  `index.html`, después de `views/catalog.js`.

- [ ] **Step 5: Verificar en navegador**

Playwright: agregar un producto al carrito → `#/carrito` → confirmar items, subtotal,
incrementar/decrementar cantidad. Ir a `#/checkout` → llenar dirección → confirmar
pedido → confirmar pantalla de éxito y que `#/mis-pedidos` (aún sin extraer, sigue en
`app.js`) sigue funcionando desde el link de esa pantalla de éxito.

- [ ] **Step 6: Commit** — omitido.

---

## Task 4: Extraer vistas de cuenta (`views/account.js`)

**Files:**
- Create: `website/js/views/account.js`
- Modify: `website/js/app.js` (eliminar `renderAuthPage` 959-1044, `openAuthModal`
  1049-1135, `closeAuthModal` 1136-1139, `renderOrders` 1144-1209,
  `openOrderDetail` 1212-1295, `closeOrderModal` 1297-1299; actualizar router y
  `setupModals`/`setupAuthToggle` que llaman a `openAuthModal`/`closeOrderModal`)
- Modify: `website/index.html`

**Interfaces:**
- Consumes: `App.api`, `App.toast`, `App.money`, `App.statusChip`, `App.formatDate`,
  `App.unitLabel`, `App.router`, `Auth.*`, `Cart.*`.
- Produces: `Views.renderAuthPage`, `Views.renderOrders`, `Views.openOrderDetail`.
  `openAuthModal`/`closeAuthModal`/`closeOrderModal` quedan como funciones internas
  de `views/account.js`, pero `closeOrderModal` y `openAuthModal` son llamadas desde
  `app.js` (`setupModals`, `setupAuthToggle`) — exponerlas también:
  `Views.openAuthModal(mode)`, `Views.closeAuthModal()`, `Views.closeOrderModal()`.

- [ ] **Step 1: Crear `website/js/views/account.js`**

Copiar tal cual: `renderAuthPage` (959-1044), `openAuthModal` (1049-1135),
`closeAuthModal` (1136-1139), `renderOrders` (1144-1209), `openOrderDetail`
(1212-1295), `closeOrderModal` (1297-1299). Reemplazar referencias libres a
`api`/`toast`/`money`/`statusChip`/`formatDate`/`unitLabel`/`router` por `App.*`
(excepto llamadas internas entre estas mismas funciones, ej. `openOrderDetail`
llamando a algo dentro del mismo archivo — esas quedan sin prefijo).

Dentro de `openOrderDetail`, la línea que hoy dice:
```js
            toast('Pedido cancelado', 'warning');
            modal.classList.remove('open');
            router();
```
pasa a:
```js
            App.toast('Pedido cancelado', 'warning');
            modal.classList.remove('open');
            App.router();
```

Exponer al final:
```js
window.Views = window.Views || {};
window.Views.renderAuthPage = renderAuthPage;
window.Views.renderOrders = renderOrders;
window.Views.openOrderDetail = openOrderDetail;
window.Views.openAuthModal = openAuthModal;
window.Views.closeAuthModal = closeAuthModal;
window.Views.closeOrderModal = closeOrderModal;
```

- [ ] **Step 2: Borrar de `app.js` las líneas 959-1299** (todo el bloque, incluyendo
  separadores de sección).

- [ ] **Step 3: Actualizar referencias cruzadas en `app.js`**

Buscar en lo que queda de `app.js` (con `grep -n "openAuthModal\|closeAuthModal\|closeOrderModal\|renderAuthPage\|renderOrders\|openOrderDetail"`) todas las llamadas
(en `router()`, `setupModals()`, `setupAuthToggle()`, `setupMobileNav()`) y
prefijarlas con `Views.`. Ejemplo en `router()`:
```js
    } else if (hash === '#/ingresar' || hash === '#/registro') {
      Views.renderAuthPage(app);
    } else if (hash === '#/mis-pedidos') {
      Views.renderOrders(app);
```

- [ ] **Step 4:** Agregar `<script src="js/views/account.js"></script>` en
  `index.html`, después de `views/shopping.js`.

- [ ] **Step 5: Verificar en navegador**

Playwright: `#/ingresar` → login con `admin@supermercadosgo.com` /
`644b8792118f6ed11b3503f7` (usar SOLO para confirmar que el flujo de login no está
roto — inmediatamente después cerrar sesión; no dejar esta sesión abierta, y notar
que como es rol `admin` esto también sirve como preview informal de lo que hará la
Tarea 10, aunque el bloqueo de rol todavía no existe en este punto del plan).
Registrar un usuario `client` de prueba nuevo, confirmar redirección/estado logueado.
`#/mis-pedidos` → confirmar lista (vacía si es usuario nuevo) → si hay pedidos de
pruebas anteriores, abrir el modal de detalle, confirmar que "Cancelar Pedido"
sigue funcionando en pedidos `pending`/`confirmed`.

- [ ] **Step 6: Commit** — omitido.

---

## Task 5: Extraer vistas informativas (`views/info.js`) y dejar `app.js` como shell puro

**Files:**
- Create: `website/js/views/info.js`
- Modify: `website/js/app.js` (eliminar `renderHelp` 1305-1376,
  `renderDeliveryZone` 1381-1453, `renderAbout` 1458-1507; actualizar router; agregar
  `Auth.onChange(() => router())` en `init()`)
- Modify: `website/index.html`

**Interfaces:**
- Consumes: `App.money`, `App.settings`.
- Produces: `Views.renderHelp`, `Views.renderDeliveryZone`, `Views.renderAbout`.

- [ ] **Step 1: Crear `website/js/views/info.js`**

Copiar tal cual `renderHelp` (1305-1376), `renderDeliveryZone` (1381-1453),
`renderAbout` (1458-1507). Reemplazar `money`/`settings` por `App.money`/`App.settings`.
Exponer `Views.renderHelp`, `Views.renderDeliveryZone`, `Views.renderAbout`.

- [ ] **Step 2: Borrar de `app.js` las líneas 1305-1507.**

- [ ] **Step 3: Actualizar router**
```js
    } else if (hash === '#/ayuda') {
      Views.renderHelp(app);
    } else if (hash === '#/zona-entrega') {
      Views.renderDeliveryZone(app);
    } else if (hash === '#/acerca') {
      Views.renderAbout(app);
```

- [ ] **Step 4: Agregar `Auth.onChange` en `init()`**

En `init()` (dentro de `app.js`), junto a `Cart.onChange(() => updateBadges());`,
agregar:
```js
    Auth.onChange(() => router());
```
Esto hace que login/logout/registro re-evalúen la ruta actual de inmediato (necesario
para la Tarea 10 — bloqueo de rol — y para que el header se sincronice sin esperar un
cambio de hash).

- [ ] **Step 5:** Agregar `<script src="js/views/info.js"></script>` en `index.html`,
  después de `views/account.js`.

- [ ] **Step 6: Verificar `app.js` quedó como shell puro**

`grep -n "^  function render\|^  async function render" website/js/app.js` debe
devolver **cero resultados** — todo `renderX` ahora vive en `views/*.js`. Lo único
que debe quedar en `app.js`: helpers (ahora también expuestos en `App`), `router()`,
`setupHeaderScroll`/`setupSearch`/`setupCartToggle`/`setupAuthToggle`/`setupModals`/
`setupMobileNav`/`setupFooter`, `window.App = {...}`, `init()`, `updateBadges()`.

- [ ] **Step 7: Verificación completa (checkpoint de "cero regresión")**

Playwright, recorrido completo de las 10 rutas originales: `#/`, `#/productos`,
`#/producto/:id`, `#/carrito`, `#/checkout`, `#/ingresar`, `#/mis-pedidos`,
`#/ayuda`, `#/zona-entrega`, `#/acerca`. Sin errores de consola en ninguna. Repetir
en viewport 375px (móvil) y 1440px (desktop) — menú hamburguesa, header, footer.
Este es el checkpoint que cierra el refactor: a partir de aquí, toda tarea siguiente
es funcionalidad nueva sobre una base ya verificada.

- [ ] **Step 8: Commit** — omitido.

---

## Task 6: Favoritos

**Files:**
- Create: `website/js/favorites.js`
- Create: `website/js/views/favorites.js`
- Modify: `website/js/views/catalog.js` (agregar botón de corazón en
  `productCardHTML` y en `renderProductDetail`)
- Modify: `website/js/app.js` (router: ruta `#/favoritos`; `init()`: cargar
  `Favorites` si el usuario es `client`)
- Modify: `website/index.html` (script tag, link de header + nav móvil)
- Modify: `website/css/styles.css` (estilos del botón de favorito)

**Interfaces:**
- Consumes: `App.api`, `Auth.isLogged()`, `Auth.getUser()`.
- Produces: `Favorites.load()`, `Favorites.isFavorite(productId)`,
  `Favorites.toggle(productId)`, `Favorites.getAll()`, `Favorites.onChange(cb)`.
  `Views.renderFavorites(container)`. `App.bindFavoriteButtons(container)`.

- [ ] **Step 1: Crear `website/js/favorites.js`**

```js
/* website/js/favorites.js — Favorites Module
   Handles the client's favorite products list, mirrors the Cart.js pattern. */
const Favorites = (() => {
  let items = [];      // raw API rows: { id, product_id, name, price, image, ... }
  let ids = new Set();  // product_id lookup, kept in sync with `items`
  let listeners = [];

  function notifyListeners() {
    listeners.forEach(fn => fn(items));
  }

  async function load() {
    if (!Auth.isLogged() || Auth.getUser().role !== 'client') {
      items = [];
      ids = new Set();
      notifyListeners();
      return;
    }
    try {
      const res = await App.api('/api/favorites');
      items = res.data || [];
      ids = new Set(items.map(i => i.product_id));
    } catch {
      items = [];
      ids = new Set();
    }
    notifyListeners();
  }

  function isFavorite(productId) {
    return ids.has(productId);
  }

  function getAll() {
    return [...items];
  }

  async function toggle(productId) {
    const wasFavorite = ids.has(productId);
    // Optimistic update
    if (wasFavorite) {
      ids.delete(productId);
      items = items.filter(i => i.product_id !== productId);
    } else {
      ids.add(productId);
    }
    notifyListeners();

    try {
      if (wasFavorite) {
        await App.api('/api/favorites/' + productId, { method: 'DELETE', headers: Auth.getHeaders() });
      } else {
        await App.api('/api/favorites/' + productId, { method: 'POST', headers: Auth.getHeaders() });
        await load(); // refetch to get full product data for the new favorite
      }
    } catch (err) {
      // Revert optimistic update on failure
      if (wasFavorite) ids.add(productId); else ids.delete(productId);
      notifyListeners();
      App.toast(err.message, 'error');
    }
  }

  function onChange(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter(fn => fn !== callback); };
  }

  return { load, isFavorite, toggle, getAll, onChange };
})();
```

- [ ] **Step 2: Agregar botón de favorito en `productCardHTML` (`views/catalog.js`)**

Dentro del template de `productCardHTML`, en `.product-card-img` (justo después del
`hasOffer` badge), agregar:
```js
          ${Auth.isLogged() && Auth.getUser().role === 'client' ? `
            <button class="favorite-btn ${Favorites.isFavorite(p.id) ? 'active' : ''}" data-product-id="${p.id}" onclick="event.stopPropagation();" title="${Favorites.isFavorite(p.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
              <i class="${Favorites.isFavorite(p.id) ? 'fas' : 'far'} fa-heart"></i>
            </button>
          ` : ''}
```

- [ ] **Step 3: Agregar `bindFavoriteButtons` en `views/catalog.js`, junto a
  `bindAddToCartButtons`**

```js
  function bindFavoriteButtons(container) {
    container.querySelectorAll('.favorite-btn').forEach(btn => {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const pid = this.dataset.productId;
        await Favorites.toggle(pid);
        const nowFav = Favorites.isFavorite(pid);
        this.classList.toggle('active', nowFav);
        this.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
        this.title = nowFav ? 'Quitar de favoritos' : 'Agregar a favoritos';
      });
    });
  }
```

Llamar `bindFavoriteButtons(container)` en `renderHome` (junto a
`bindAddToCartButtons(container)`, línea equivalente a la 346 actual) y en
`renderProducts` (junto a la línea equivalente a la 476 actual). Exponer:
`window.App.bindFavoriteButtons = bindFavoriteButtons;`

- [ ] **Step 4: Agregar el mismo botón en `renderProductDetail` (`views/catalog.js`)**

Dentro de `.detail-actions`, antes del botón "Agregar al Carrito", agregar (solo si
`Auth.isLogged() && Auth.getUser().role === 'client'`):
```js
                ${Auth.isLogged() && Auth.getUser().role === 'client' ? `
                  <button class="btn btn-outline btn-lg favorite-btn-detail ${Favorites.isFavorite(p.id) ? 'active' : ''}" id="detailFavoriteBtn" title="${Favorites.isFavorite(p.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                    <i class="${Favorites.isFavorite(p.id) ? 'fas' : 'far'} fa-heart"></i>
                  </button>
                ` : ''}
```
Y su listener, junto a los de `detailAddCart`:
```js
      const favBtn = document.getElementById('detailFavoriteBtn');
      if (favBtn) {
        favBtn.addEventListener('click', async () => {
          await Favorites.toggle(p.id);
          const nowFav = Favorites.isFavorite(p.id);
          favBtn.classList.toggle('active', nowFav);
          favBtn.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
        });
      }
```

- [ ] **Step 5: Crear `website/js/views/favorites.js`**

```js
/* website/js/views/favorites.js — Vista "Mis Favoritos" */
(function () {
  'use strict';

  async function renderFavorites(container) {
    if (!Auth.requireAuth()) return;
    if (Auth.getUser().role !== 'client') return; // el router ya lo bloquea antes, defensivo

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-heart" style="color:var(--red);"></i> Mis Favoritos</h1>
          <p>Productos que has guardado</p>
        </div>
        <div id="favoritesContainer" style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    `;

    await Favorites.load();
    const list = Favorites.getAll();
    const favContainer = document.getElementById('favoritesContainer');

    if (list.length === 0) {
      favContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-heart"></i>
          <h2>No tienes favoritos aun</h2>
          <p>Toca el corazon en un producto para guardarlo aqui</p>
          <a href="#/productos" class="btn btn-primary" style="border-radius:var(--radius-full);"><i class="fas fa-shopping-bag"></i> Ver Productos</a>
        </div>
      `;
      return;
    }

    // La API de favoritos devuelve `product_id`, no `id` — App.productCardHTML
    // espera `p.id`. Se mapea antes de reusar la misma card que el catálogo.
    favContainer.innerHTML = `
      <div class="products-grid">
        ${list.map(f => App.productCardHTML({ ...f, id: f.product_id })).join('')}
      </div>
    `;
    App.bindAddToCartButtons(favContainer);
    App.bindFavoriteButtons(favContainer);
  }

  window.Views = window.Views || {};
  window.Views.renderFavorites = renderFavorites;
})();
```

- [ ] **Step 6: Ruta y carga inicial en `app.js`**

En `router()`, agregar antes del `else { renderHome... }` final:
```js
    } else if (hash === '#/favoritos') {
      Views.renderFavorites(app);
```
En `init()`, después de `if (Auth.isLogged()) { await Auth.fetchProfile(); }`,
agregar:
```js
    await Favorites.load();
    Favorites.onChange(() => {
      // Re-renderizar la vista actual si el usuario está mirando el catálogo o favoritos,
      // para que el corazón se actualice en toda la página, no solo en el botón clickeado.
    });
```
(el comentario documenta por qué el callback existe vacío por ahora: el toggle local
en `bindFavoriteButtons`/`detailFavoriteBtn` ya actualiza el botón clickeado a mano;
no hace falta un re-render completo. Se deja el `onChange` enganchado para que
`views/favorites.js` u otra vista futura puedan suscribirse sin tocar `app.js` de
nuevo.)

- [ ] **Step 7: Header y menú móvil (`index.html`)**

En `.header-actions`, antes del botón `authToggle`, agregar:
```html
        <a href="#/favoritos" class="header-btn" id="favoritesBtn" title="Favoritos" style="display:none;">
          <i class="fas fa-heart"></i>
          <span class="header-btn-label d-none d-md-inline">Favoritos</span>
        </a>
```
En `.mobile-nav-links`, después del link de "Mis Pedidos":
```html
        <li><a href="#/favoritos" class="mobile-link" id="mobileFavoritesLink" style="display:none;"><i class="fas fa-heart"></i> Mis Favoritos</a></li>
```
En `auth.js`, función `updateUI()`, junto a donde se muestra/oculta `ordersBtn` y
`mobileOrdersLink`, agregar el mismo patrón para `favoritesBtn`/`mobileFavoritesLink`
(mostrar solo `if (isLogged())`, ocultar si no).

- [ ] **Step 8: CSS (`website/css/styles.css`)**

Agregar al final del archivo:
```css
/* ─── Favorite Button ──────────────────────────────────────────────── */
.favorite-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.9);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--gray-400);
  transition: var(--transition);
  z-index: 2;
}
.favorite-btn:hover { transform: scale(1.1); }
.favorite-btn.active { color: var(--red); }
.favorite-btn-detail.active { color: var(--red); border-color: var(--red); }
.favorite-btn-detail.active i { color: var(--red); }
```
`.product-card-img` ya existe y ya es el contenedor relativo de la imagen (confirmado
en `productCardHTML` — si no tuviera `position: relative` en el CSS actual, agregarlo
ahí también; verificar con `grep -n "\.product-card-img" website/css/styles.css`
antes de asumir).

- [ ] **Step 9: Verificar en navegador**

Playwright, logueado como `client`: en `#/productos`, click en el corazón de una
card → confirma que se pone rojo/relleno sin recargar la página, y que
`GET /api/favorites` (network tab, `mcp__playwright__browser_network_requests`)
refleja el cambio. Ir a `#/favoritos` → confirma que aparece el producto. Quitarlo
desde favoritos → confirma que desaparece de la lista sin recargar. Deslogueado (o
como `worker`): confirmar que el botón de corazón NO aparece en ninguna card.

- [ ] **Step 10: Commit** — omitido.

---

## Task 7: Notificaciones

**Files:**
- Create: `website/js/notifications.js`
- Create: `website/js/views/notifications.js`
- Modify: `website/js/app.js` (router: ruta `#/notificaciones`; `init()`: cargar y
  arrancar polling)
- Modify: `website/index.html` (script tag, badge de campana en header)
- Modify: `website/css/styles.css` (badge)

**Interfaces:**
- Consumes: `App.api`, `Auth.isLogged()`, `Auth.getHeaders()`.
- Produces: `Notifications.load()`, `Notifications.getUnreadCount()`,
  `Notifications.getAll()`, `Notifications.markRead(id)`,
  `Notifications.startPolling()`, `Notifications.stopPolling()`,
  `Notifications.onChange(cb)`. `Views.renderNotifications(container)`.

- [ ] **Step 1: Crear `website/js/notifications.js`**

```js
/* website/js/notifications.js — Notifications Module
   Polls GET /api/notifications (the backend has no WS push for this — see
   server/src/services/notification.service.js, it only writes to the DB) while
   the tab is visible, and exposes unread count + mark-as-read. */
const Notifications = (() => {
  const POLL_MS = 30000;
  let items = [];
  let unreadCount = 0;
  let listeners = [];
  let pollTimer = null;

  function notifyListeners() {
    listeners.forEach(fn => fn({ items, unreadCount }));
  }

  async function load() {
    if (!Auth.isLogged()) {
      items = [];
      unreadCount = 0;
      notifyListeners();
      return;
    }
    try {
      const res = await App.api('/api/notifications');
      items = res.data || [];
      unreadCount = res.unread_count || 0;
    } catch {
      // Silent — polling will retry; a toast every 30s on a flaky connection would be noisy.
    }
    notifyListeners();
  }

  function getUnreadCount() { return unreadCount; }
  function getAll() { return [...items]; }

  async function markRead(id) {
    const notif = items.find(n => n.id === id);
    if (notif && !notif.read_at) {
      notif.read_at = new Date().toISOString();
      unreadCount = Math.max(0, unreadCount - 1);
      notifyListeners();
    }
    try {
      await App.api('/api/notifications/' + id + '/read', { method: 'POST', headers: Auth.getHeaders() });
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  function startPolling() {
    stopPolling();
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && Auth.isLogged()) load();
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function onChange(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter(fn => fn !== callback); };
  }

  return { load, getUnreadCount, getAll, markRead, startPolling, stopPolling, onChange };
})();
```

- [ ] **Step 2: Crear `website/js/views/notifications.js`**

```js
/* website/js/views/notifications.js — Vista "Notificaciones" */
(function () {
  'use strict';

  const TYPE_ICONS = {
    order_status: 'fa-truck',
    order_assigned: 'fa-motorcycle',
    order_created: 'fa-receipt',
  };

  async function renderNotifications(container) {
    if (!Auth.requireAuth()) return;

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-bell" style="color:var(--orange);"></i> Notificaciones</h1>
        </div>
        <div id="notifContainer" style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    `;

    await Notifications.load();
    const list = Notifications.getAll();
    const notifContainer = document.getElementById('notifContainer');

    if (list.length === 0) {
      notifContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bell-slash"></i>
          <h2>No tienes notificaciones</h2>
          <p>Aqui veras las actualizaciones de tus pedidos</p>
        </div>
      `;
      return;
    }

    notifContainer.innerHTML = `
      <div class="orders-list">
        ${list.map(n => `
          <div class="order-card notif-card ${n.read_at ? '' : 'unread'}" data-notif-id="${n.id}">
            <div class="order-card-header">
              <span class="order-id"><i class="fas ${TYPE_ICONS[n.type] || 'fa-info-circle'}"></i> ${n.title}</span>
              ${n.read_at ? '' : '<span class="status-chip pending">Nueva</span>'}
            </div>
            <div class="order-card-body">
              <div style="font-size:13px;color:var(--gray-600);">${n.body}</div>
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:6px;">${App.formatDate(n.created_at)}</div>
          </div>
        `).join('')}
      </div>
    `;

    notifContainer.querySelectorAll('.notif-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.notifId;
        await Notifications.markRead(id);
        card.classList.remove('unread');
        const badge = card.querySelector('.status-chip.pending');
        if (badge) badge.remove();
      });
    });
  }

  window.Views = window.Views || {};
  window.Views.renderNotifications = renderNotifications;
})();
```

- [ ] **Step 3: Ruta en `app.js`**

En `router()`:
```js
    } else if (hash === '#/notificaciones') {
      Views.renderNotifications(app);
```

- [ ] **Step 4: Arrancar/parar polling en `init()` y en `Auth.onChange` (`app.js`)**

En `init()`, junto al bloque de `Favorites`:
```js
    if (Auth.isLogged()) { Notifications.startPolling(); }
```
Y ampliar el listener agregado en la Tarea 5 Step 4:
```js
    Auth.onChange(() => {
      if (Auth.isLogged()) { Notifications.startPolling(); } else { Notifications.stopPolling(); }
      router();
    });
```

- [ ] **Step 5: Badge de campana en header (`index.html` + `auth.js`)**

En `.header-actions`, junto al botón de favoritos agregado en la Tarea 6:
```html
        <a href="#/notificaciones" class="header-btn" id="notifBtn" title="Notificaciones" style="display:none;">
          <i class="fas fa-bell"></i>
          <span class="cart-badge" id="notifBadge" style="display:none;">0</span>
        </a>
```
En `auth.js` `updateUI()`, mostrar/ocultar `notifBtn` igual que `ordersBtn`. El
contenido del badge (`notifBadge`) no lo actualiza `auth.js` — lo actualiza
`Notifications.onChange`, suscrito una vez en `app.js` `init()`:
```js
    Notifications.onChange(({ unreadCount }) => {
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }
    });
```

- [ ] **Step 6: Verificar en navegador**

Playwright, logueado como `client` con al menos un pedido con cambios de estado
recientes (o generar uno: crear pedido → cambiar su estado vía
`PUT /api/orders/:id/status` con una cuenta admin en otra pestaña/petición directa
con `fetch` desde la consola, usando el token admin — esto es solo para la
verificación, no queda en el código). Confirmar que el badge muestra el conteo
correcto, que `#/notificaciones` lista los items, y que hacer click en uno baja el
conteo del badge sin recargar.

- [ ] **Step 7: Commit** — omitido.

---

## Task 8: Direcciones guardadas

**Files:**
- Create: `website/js/addresses.js`
- Create: `website/js/views/addresses.js`
- Modify: `website/js/views/shopping.js` (`renderCheckout`: reemplazar el campo de
  texto libre por selector de direcciones guardadas + opción "nueva dirección")
- Modify: `website/js/app.js` (router: ruta `#/direcciones`)
- Modify: `website/index.html` (script tag, link en menú móvil — no en header
  principal, ya está lleno; se accede desde el menú hamburguesa y desde el checkout)
- Modify: `website/css/styles.css`

**Interfaces:**
- Consumes: `App.api`, `Auth.getHeaders()`.
- Produces: `Addresses.load()`, `Addresses.getAll()`, `Addresses.create(data)`,
  `Addresses.update(id, data)`, `Addresses.remove(id)`, `Addresses.getDefault()`.
  `Views.renderAddresses(container)`.

- [ ] **Step 1: Crear `website/js/addresses.js`**

```js
/* website/js/addresses.js — Addresses Module (client's saved delivery addresses) */
const Addresses = (() => {
  let items = [];

  async function load() {
    if (!Auth.isLogged() || Auth.getUser().role !== 'client') { items = []; return items; }
    try {
      const res = await App.api('/api/addresses');
      items = res.data || [];
    } catch {
      items = [];
    }
    return items;
  }

  function getAll() { return [...items]; }
  function getDefault() { return items.find(a => a.is_default) || items[0] || null; }

  async function create(data) {
    const res = await App.api('/api/addresses', {
      method: 'POST',
      headers: Auth.getHeaders(),
      body: JSON.stringify(data),
    });
    items.push(res.data);
    if (res.data.is_default) items.forEach(a => { if (a.id !== res.data.id) a.is_default = false; });
    return res.data;
  }

  async function update(id, data) {
    const res = await App.api('/api/addresses/' + id, {
      method: 'PUT',
      headers: Auth.getHeaders(),
      body: JSON.stringify(data),
    });
    items = items.map(a => a.id === id ? res.data : a);
    if (res.data.is_default) items.forEach(a => { if (a.id !== id) a.is_default = false; });
    return res.data;
  }

  async function remove(id) {
    await App.api('/api/addresses/' + id, { method: 'DELETE', headers: Auth.getHeaders() });
    items = items.filter(a => a.id !== id);
  }

  return { load, getAll, getDefault, create, update, remove };
})();
```

- [ ] **Step 2: Crear `website/js/views/addresses.js`**

```js
/* website/js/views/addresses.js — Vista "Mis Direcciones" (CRUD) */
(function () {
  'use strict';

  function addressFormHTML(a = {}) {
    return `
      <div class="form-group">
        <label class="form-label">Etiqueta (ej: Casa, Trabajo)</label>
        <input type="text" class="form-input" id="addrLabel" value="${a.label || ''}" placeholder="Casa">
      </div>
      <div class="form-group">
        <label class="form-label">Direccion completa *</label>
        <input type="text" class="form-input" id="addrAddress" value="${a.address || ''}" placeholder="Cra 5 # 12-34">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Barrio</label>
          <input type="text" class="form-input" id="addrNeighborhood" value="${a.neighborhood || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Referencia</label>
          <input type="text" class="form-input" id="addrDetail" value="${a.detail || ''}">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px;">
        <input type="checkbox" id="addrIsDefault" ${a.is_default ? 'checked' : ''}> Usar como dirección predeterminada
      </label>
    `;
  }

  function readAddressForm() {
    return {
      label: document.getElementById('addrLabel').value.trim() || null,
      address: document.getElementById('addrAddress').value.trim(),
      neighborhood: document.getElementById('addrNeighborhood').value.trim() || null,
      detail: document.getElementById('addrDetail').value.trim() || null,
      is_default: document.getElementById('addrIsDefault').checked,
    };
  }

  async function renderAddresses(container) {
    if (!Auth.requireAuth()) return;

    container.innerHTML = `
      <div class="orders-page">
        <div class="page-title-bar">
          <h1><i class="fas fa-map-marker-alt" style="color:var(--green);"></i> Mis Direcciones</h1>
        </div>
        <div class="checkout-card mb-2">
          <h3>Agregar Nueva Dirección</h3>
          <div id="addrNewForm">${addressFormHTML()}</div>
          <button class="btn btn-primary mt-2" id="addrCreateBtn"><i class="fas fa-plus"></i> Guardar Dirección</button>
        </div>
        <div id="addressesList"></div>
      </div>
    `;

    document.getElementById('addrCreateBtn').addEventListener('click', async function () {
      const data = readAddressForm();
      if (!data.address) { App.toast('La dirección es obligatoria', 'error'); return; }
      this.disabled = true;
      try {
        await Addresses.create(data);
        App.toast('Dirección guardada');
        renderAddresses(container);
      } catch (err) {
        this.disabled = false;
        App.toast(err.message, 'error');
      }
    });

    await Addresses.load();
    renderList();

    function renderList() {
      const list = Addresses.getAll();
      const listEl = document.getElementById('addressesList');
      if (list.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><i class="fas fa-map-marker-alt"></i><p>No tienes direcciones guardadas todavia</p></div>`;
        return;
      }
      listEl.innerHTML = list.map(a => `
        <div class="checkout-card mb-2" data-address-id="${a.id}">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <strong>${a.label || 'Dirección'}</strong> ${a.is_default ? '<span class="status-chip confirmed">Predeterminada</span>' : ''}
              <p style="font-size:13px;color:var(--gray-600);margin-top:4px;">${a.address}${a.neighborhood ? ', ' + a.neighborhood : ''}</p>
              ${a.detail ? `<p style="font-size:12px;color:var(--gray-400);">${a.detail}</p>` : ''}
            </div>
            <button class="btn btn-outline btn-sm addr-delete-btn" data-id="${a.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.addr-delete-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Eliminar esta dirección?')) return;
          try {
            await Addresses.remove(this.dataset.id);
            App.toast('Dirección eliminada', 'warning');
            renderList();
          } catch (err) {
            App.toast(err.message, 'error');
          }
        });
      });
    }
  }

  window.Views = window.Views || {};
  window.Views.renderAddresses = renderAddresses;
})();
```

- [ ] **Step 3: Ruta en `app.js`**
```js
    } else if (hash === '#/direcciones') {
      Views.renderAddresses(app);
```

- [ ] **Step 4: Integrar selector en `renderCheckout` (`views/shopping.js`)**

Reemplazar el bloque `<!-- Address (for delivery) -->` actual (el `<div class="checkout-card mb-2" id="addressCard">` con el input `checkoutAddress` de texto libre) por:
```html
            <div class="checkout-card mb-2" id="addressCard">
              <h3><i class="fas fa-map-marker-alt"></i> Direccion de Entrega</h3>
              <div id="checkoutAddressSelector"></div>
              <a href="#/direcciones" style="font-size:13px;color:var(--green);display:inline-block;margin-top:8px;"><i class="fas fa-plus"></i> Agregar nueva dirección</a>
            </div>
```
Y en el JS de `renderCheckout`, después del `container.innerHTML = ...` inicial y
antes de `let fulfillmentType = 'delivery';`, cargar y pintar el selector:
```js
    (async () => {
      await Addresses.load();
      const addrs = Addresses.getAll();
      const selector = document.getElementById('checkoutAddressSelector');
      if (addrs.length === 0) {
        selector.innerHTML = `<p style="font-size:13px;color:var(--gray-500);">No tienes direcciones guardadas. <a href="#/direcciones" style="color:var(--green);">Agrega una</a> o usa el campo de abajo.</p>
          <div class="form-group mt-2"><input type="text" class="form-input" id="checkoutAddress" placeholder="Ej: Cra 5 # 12-34, Barrio Centro"></div>`;
        return;
      }
      selector.innerHTML = addrs.map((a, i) => `
        <label class="option-card ${i === 0 ? 'selected' : ''}" data-address-id="${a.id}" style="display:block;text-align:left;">
          <input type="radio" name="checkout_address" value="${a.id}" ${i === 0 ? 'checked' : ''} style="margin-right:8px;">
          <strong>${a.label || 'Dirección'}</strong><br>
          <span style="font-size:12px;color:var(--gray-500);">${a.address}${a.neighborhood ? ', ' + a.neighborhood : ''}</span>
        </label>
      `).join('') + `<a href="#/direcciones" style="font-size:12px;color:var(--green);display:inline-block;margin-top:8px;">+ Usar una dirección nueva</a>`;
    })();
```
Y en el listener de `placeOrderBtn`, reemplazar cómo se calcula `fullAddress`
(actualmente lee `#checkoutAddress`/`#checkoutNeighborhood`/`#checkoutRef`) por:
```js
      let fullAddress = 'Recogida en tienda';
      if (fulfillmentType === 'delivery') {
        const selectedRadio = document.querySelector('input[name="checkout_address"]:checked');
        if (selectedRadio) {
          const addr = Addresses.getAll().find(a => a.id === selectedRadio.value);
          fullAddress = addr.address + (addr.neighborhood ? ', ' + addr.neighborhood : '') + (addr.detail ? ' (' + addr.detail + ')' : '');
        } else {
          const freeText = document.getElementById('checkoutAddress');
          if (!freeText || !freeText.value.trim()) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
            App.toast('La dirección de entrega es obligatoria', 'error');
            return;
          }
          fullAddress = freeText.value.trim();
        }
      }
```
(esto reemplaza el bloque de validación de `address` que existía antes — la
validación "obligatoria" ahora vive dentro de esta misma rama, cubriendo tanto el
caso de dirección guardada como el de campo libre cuando no hay ninguna guardada).

- [ ] **Step 5:** Agregar `<script src="js/addresses.js"></script>` (junto a
  `favorites.js`/`notifications.js`) y `<script src="js/views/addresses.js"></script>`
  (junto a las otras vistas) en `index.html`. Agregar link en `.mobile-nav-links`:
```html
        <li><a href="#/direcciones" class="mobile-link" id="mobileAddressesLink" style="display:none;"><i class="fas fa-map-marker-alt"></i> Mis Direcciones</a></li>
```
mostrado/ocultado igual que los demás links de sesión en `auth.js` `updateUI()`.

- [ ] **Step 6: Verificar en navegador**

Playwright, logueado como `client`: `#/direcciones` → crear una dirección → confirma
que aparece en la lista. Ir a `#/carrito` → `#/checkout` → confirma que el selector
muestra esa dirección y queda seleccionada por defecto. Completar el pedido →
confirma en `#/mis-pedidos` que la dirección guardada en el pedido creado coincide
con la elegida. Volver a `#/direcciones` → eliminar la dirección → confirma que
desaparece.

- [ ] **Step 7: Commit** — omitido.

---

## Task 9: Código promocional en checkout

**Files:**
- Modify: `website/js/views/shopping.js` (`renderCheckout`: campo de código, validar,
  aplicar al resumen y al `POST /api/orders`)

**Interfaces:**
- Consumes: `App.api`, `Auth.getHeaders()`, `Cart.getSubtotal()`.

- [ ] **Step 1: Agregar el campo de código en el resumen de `renderCheckout`**

Dentro de `#checkoutSummaryCard`, entre `.summary-lines` y el botón
`placeOrderBtn`, agregar:
```html
              <div class="form-group mt-2" style="display:flex;gap:8px;">
                <input type="text" class="form-input" id="promoCodeInput" placeholder="Código promocional" style="text-transform:uppercase;">
                <button class="btn btn-outline" id="promoApplyBtn" type="button">Aplicar</button>
              </div>
              <div id="promoResult"></div>
```

- [ ] **Step 2: Estado y lógica de aplicación**

Junto a `let fulfillmentType = 'delivery';`, agregar:
```js
    let appliedPromo = null; // { id, name, description, discount }
```
Nuevo handler, junto al de `paymentOptions`:
```js
    document.getElementById('promoApplyBtn').addEventListener('click', async function () {
      const code = document.getElementById('promoCodeInput').value.trim().toUpperCase();
      const resultEl = document.getElementById('promoResult');
      if (!code) return;
      this.disabled = true;
      this.textContent = 'Validando...';
      try {
        const res = await App.api('/api/promotions/validate', {
          method: 'POST',
          headers: Auth.getHeaders(),
          body: JSON.stringify({ code, subtotal: Cart.getSubtotal() }),
        });
        appliedPromo = { code, ...res.data };
        resultEl.innerHTML = `<p style="font-size:13px;color:var(--green);margin-top:6px;"><i class="fas fa-check-circle"></i> ${res.data.description}</p>`;
        updateSummary();
      } catch (err) {
        appliedPromo = null;
        resultEl.innerHTML = `<p style="font-size:13px;color:var(--red);margin-top:6px;"><i class="fas fa-exclamation-circle"></i> ${err.message}</p>`;
        updateSummary();
      } finally {
        this.disabled = false;
        this.textContent = 'Aplicar';
      }
    });
```

- [ ] **Step 3: Reflejar el descuento en `updateSummary()`**

Reemplazar el cuerpo actual de `updateSummary()` por:
```js
    function updateSummary() {
      const dFee = Cart.getDeliveryFee(freeMin, fee, fulfillmentType);
      const discount = appliedPromo ? appliedPromo.discount : 0;
      const total = Cart.getSubtotal() + dFee - discount;
      const deliveryLine = document.getElementById('checkoutDeliveryLine');
      if (deliveryLine) {
        deliveryLine.innerHTML = dFee === 0
          ? `<span>Envio</span><span><span class="free-badge">GRATIS</span></span>`
          : `<span>Envio</span><span>${App.money(dFee)}</span>`;
      }
      let discountLine = document.getElementById('checkoutDiscountLine');
      if (discount > 0) {
        if (!discountLine) {
          discountLine = document.createElement('div');
          discountLine.id = 'checkoutDiscountLine';
          discountLine.className = 'summary-line discount';
          document.getElementById('checkoutTotalLine').before(discountLine);
        }
        discountLine.innerHTML = `<span>Descuento</span><span>-${App.money(discount)}</span>`;
      } else if (discountLine) {
        discountLine.remove();
      }
      const totalLine = document.getElementById('checkoutTotalLine');
      if (totalLine) totalLine.innerHTML = `<span>Total</span><span>${App.money(total)}</span>`;
    }
```

- [ ] **Step 4: Enviar `promo_code` en `POST /api/orders`**

En el `body: JSON.stringify({...})` del `fetch`/`api('/api/orders', ...)` dentro del
listener de `placeOrderBtn`, agregar:
```js
            promo_code: appliedPromo ? appliedPromo.code : undefined,
```

- [ ] **Step 5: Verificar en navegador**

Requiere una promoción activa en la base de datos de prueba — crear una vía API
directamente con una cuenta admin (`POST /api/promotions` con
`{ code: 'TEST10', type: 'porcentaje', value: 10, is_active: true }`) solo para la
verificación, no para dejarla en el sitio. En checkout: ingresar un código inválido →
confirma mensaje de error en rojo. Ingresar `TEST10` → confirma mensaje verde con la
descripción y que el total baja un 10%. Completar el pedido → confirmar en el detalle
del pedido (`#/mis-pedidos` → click) que la línea "Descuento" aparece con el monto
correcto (ya la soporta `openOrderDetail`, línea 1252 actual — sin cambios ahí).

- [ ] **Step 6: Commit** — omitido.

---

## Task 10: Calificar pedido + pantalla de bloqueo de rol

**Files:**
- Create: `website/js/views/role-blocked.js`
- Modify: `website/js/app.js` (`router()`: chequeo de rol antes de despachar
  cualquier hash)
- Modify: `website/js/views/account.js` (`openOrderDetail`: agregar selector de
  estrellas cuando el pedido está entregado/recogido y sin calificar)
- Modify: `website/css/styles.css` (estrellas)

**Interfaces:**
- Produces: `Views.renderRoleBlocked(container)`.

- [ ] **Step 1: Crear `website/js/views/role-blocked.js`**

```js
/* website/js/views/role-blocked.js — Pantalla para cuentas worker/admin en el sitio web */
(function () {
  'use strict';

  const ROLE_LABELS = { worker: 'repartidor', admin: 'administrador' };

  function renderRoleBlocked(container) {
    const user = Auth.getUser();
    const roleLabel = ROLE_LABELS[user.role] || user.role;

    container.innerHTML = `
      <div class="empty-state" style="min-height:60vh;display:flex;flex-direction:column;justify-content:center;">
        <i class="fas fa-user-shield" style="color:var(--orange);"></i>
        <h2>Hola, ${user.name}</h2>
        <p>Tu cuenta es de tipo <strong>${roleLabel}</strong>. Este sitio web es solo
        para clientes — usa la app Supermercados Go${user.role === 'admin' ? ' o el panel de administración' : ''}
        para gestionar tu cuenta.</p>
        <button class="btn btn-outline mt-3" id="roleBlockedLogout"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button>
      </div>
    `;

    document.getElementById('roleBlockedLogout').addEventListener('click', () => {
      Auth.logout();
    });
  }

  window.Views = window.Views || {};
  window.Views.renderRoleBlocked = renderRoleBlocked;
})();
```

- [ ] **Step 2: Chequeo centralizado en `router()` (`app.js`)**

Al inicio de `function router()`, justo después de calcular `hash` y antes de
`if (loader) loader.remove();` (o inmediatamente después, el orden entre estas dos
líneas no importa), agregar:
```js
    if (Auth.isLogged() && Auth.getUser().role !== 'client') {
      Views.renderRoleBlocked(app);
      return;
    }
```
(`app` ya está definido un par de líneas arriba como
`document.getElementById('app')` — reusar esa misma variable, no redeclarar.)

- [ ] **Step 3:** Agregar `<script src="js/views/role-blocked.js"></script>` en
  `index.html`, junto a las demás vistas.

- [ ] **Step 4: Selector de calificación en `openOrderDetail` (`views/account.js`)**

Después del bloque `${['pending', 'confirmed'].includes(o.status) ? ...}` (el botón
de cancelar), agregar:
```js
        ${['delivered', 'picked_up'].includes(o.status) && !o.rating ? `
          <div class="checkout-card mt-3" id="rateOrderBlock">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:8px;">¿Cómo estuvo tu pedido?</h4>
            <div class="rating-stars" id="ratingStars">
              ${[1, 2, 3, 4, 5].map(n => `<i class="far fa-star" data-star="${n}"></i>`).join('')}
            </div>
            <textarea class="form-textarea mt-2" id="ratingComment" placeholder="Comentario (opcional)" rows="2"></textarea>
            <button class="btn btn-primary btn-block mt-2" id="submitRatingBtn" disabled>Enviar Calificación</button>
          </div>
        ` : o.rating ? `
          <div class="checkout-card mt-3">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:8px;">Tu calificación</h4>
            <div class="rating-stars readonly">
              ${[1, 2, 3, 4, 5].map(n => `<i class="${n <= o.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
            </div>
            ${o.rating_comment ? `<p style="font-size:13px;color:var(--gray-600);margin-top:6px;">${o.rating_comment}</p>` : ''}
          </div>
        ` : ''}
```
Y su lógica, junto al listener de `cancelOrderBtn`:
```js
      // Rating
      let selectedRating = 0;
      const starsEl = document.getElementById('ratingStars');
      if (starsEl) {
        const submitBtn = document.getElementById('submitRatingBtn');
        starsEl.querySelectorAll('[data-star]').forEach(star => {
          star.addEventListener('click', () => {
            selectedRating = parseInt(star.dataset.star);
            starsEl.querySelectorAll('[data-star]').forEach(s => {
              s.className = parseInt(s.dataset.star) <= selectedRating ? 'fas fa-star' : 'far fa-star';
            });
            submitBtn.disabled = false;
          });
        });
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Enviando...';
          try {
            await App.api('/api/orders/' + orderId + '/rate', {
              method: 'POST',
              headers: Auth.getHeaders(),
              body: JSON.stringify({ rating: selectedRating, comment: document.getElementById('ratingComment').value.trim() || undefined }),
            });
            App.toast('¡Gracias por tu calificación!');
            openOrderDetail(orderId); // re-render to show the read-only stars
          } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Calificación';
            App.toast(err.message, 'error');
          }
        });
      }
```

- [ ] **Step 5: CSS de estrellas**

```css
/* ─── Rating Stars ──────────────────────────────────────────────────── */
.rating-stars { display: flex; gap: 6px; font-size: 24px; }
.rating-stars:not(.readonly) i { cursor: pointer; color: var(--gray-300); transition: var(--transition); }
.rating-stars:not(.readonly) i:hover { color: var(--gold); }
.rating-stars i.fas { color: var(--gold); }
.rating-stars.readonly i { cursor: default; }
```

- [ ] **Step 6: Verificar en navegador**

Playwright: login como `worker` (crear uno de prueba vía `POST /api/auth/register`
con `role: 'worker'`, o usar uno existente) → confirmar que cualquier ruta
(`#/`, `#/productos`, editar el hash a mano) siempre muestra la pantalla de bloqueo,
nunca el catálogo. Cerrar sesión desde ahí → confirmar que vuelve a home normal.
Con un pedido `client` en estado `delivered` (forzar el estado vía
`PUT /api/orders/:id/status` con cuenta admin, solo para la prueba): abrir su
detalle → confirmar que aparecen las estrellas, calificar → confirmar que pasa a
modo solo-lectura con las estrellas llenas correctas.

- [ ] **Step 7: Commit** — omitido.

---

## Task 11: Tracking en vivo (ubicación del repartidor)

**Files:**
- Create: `website/js/live-tracking.js`
- Modify: `website/index.html` (CDN de Leaflet en `<head>`, script tag del módulo)
- Modify: `website/js/views/account.js` (`openOrderDetail`: mapa cuando
  `status === 'in_transit'`)
- Modify: `website/css/styles.css` (tamaño del contenedor del mapa)

**Interfaces:**
- Produces: `LiveTracking.connect()`, `LiveTracking.disconnect()`,
  `LiveTracking.onLocation(orderId, cb)` → función para desuscribirse.

- [ ] **Step 1: Obtener el snippet oficial de Leaflet (CDN + integrity hash)**

Usar `WebFetch` sobre `https://leafletjs.com/download.html` para copiar el bloque
`<link>`/`<script>` con el hash `integrity` **tal como lo publica la documentación
oficial en este momento** — no escribir un hash de memoria, si está mal el navegador
bloquea la carga silenciosamente (SRI mismatch). Insertar ese bloque en
`website/index.html`, en el `<head>`, antes de `<link rel="stylesheet" href="css/styles.css">`.

- [ ] **Step 2: Crear `website/js/live-tracking.js`**

```js
/* website/js/live-tracking.js — WebSocket client for live worker location
   (server/src/services/ws.service.js → 'worker_location' event, sent to the
   order's owner while a worker transmits GPS during an in_transit delivery).
   Order status changes themselves are NOT pushed here — see Notifications. */
const LiveTracking = (() => {
  let ws = null;
  let listenersByOrder = new Map(); // orderId -> Set<callback>
  let reconnectTimer = null;
  let reconnectDelay = 1000;

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const token = Auth.getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);

    ws.addEventListener('open', () => { reconnectDelay = 1000; });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.event === 'worker_location' && msg.data && msg.data.order_id) {
        const cbs = listenersByOrder.get(msg.data.order_id);
        if (cbs) cbs.forEach(cb => cb(msg.data));
      }
    });

    ws.addEventListener('close', () => {
      ws = null;
      if (listenersByOrder.size > 0) {
        reconnectTimer = setTimeout(() => { connect(); reconnectDelay = Math.min(reconnectDelay * 2, 30000); }, reconnectDelay);
      }
    });

    ws.addEventListener('error', () => { /* 'close' fires right after — reconnection handled there */ });
  }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    listenersByOrder.clear();
  }

  function onLocation(orderId, callback) {
    if (!listenersByOrder.has(orderId)) listenersByOrder.set(orderId, new Set());
    listenersByOrder.get(orderId).add(callback);
    connect();
    return () => {
      const cbs = listenersByOrder.get(orderId);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) listenersByOrder.delete(orderId);
      }
      if (listenersByOrder.size === 0) disconnect();
    };
  }

  return { connect, disconnect, onLocation };
})();
```

- [ ] **Step 3: Mapa en `openOrderDetail` (`views/account.js`)**

Después del bloque de rating agregado en la Tarea 10, agregar:
```js
        ${o.status === 'in_transit' ? `
          <div class="checkout-card mt-3">
            <h4 style="font-size:14px;font-weight:700;margin-bottom:8px;"><i class="fas fa-motorcycle"></i> Ubicación del repartidor</h4>
            <div id="trackingMap" class="tracking-map"></div>
            <p id="trackingStatus" style="font-size:12px;color:var(--gray-400);margin-top:6px;">Esperando ubicación del repartidor...</p>
          </div>
        ` : ''}
```
Y su inicialización, al final de la función (después del bloque de rating, dentro
del mismo `try`):
```js
      const mapEl = document.getElementById('trackingMap');
      if (mapEl && o.status === 'in_transit') {
        const destLat = o.delivery_lat || 7.8939; // fallback: centro de Cúcuta
        const destLng = o.delivery_lng || -72.5078;
        const map = L.map('trackingMap').setView([destLat, destLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        L.marker([destLat, destLng]).addTo(map).bindPopup('Punto de entrega');
        let workerMarker = null;

        const unsubscribe = LiveTracking.onLocation(orderId, (data) => {
          const statusEl = document.getElementById('trackingStatus');
          if (statusEl) statusEl.textContent = 'Ubicación en vivo activa';
          if (!workerMarker) {
            workerMarker = L.marker([data.lat, data.lng], {
              icon: L.divIcon({ className: 'worker-marker', html: '<i class="fas fa-motorcycle"></i>' }),
            }).addTo(map).bindPopup('Repartidor');
          } else {
            workerMarker.setLatLng([data.lat, data.lng]);
          }
        });

        // Dejar de escuchar cuando se cierra el modal de detalle.
        const modalEl = document.getElementById('orderModal');
        const cleanup = () => { unsubscribe(); modalEl.removeEventListener('transitionend', cleanupOnClose); };
        function cleanupOnClose() { if (!modalEl.classList.contains('open')) cleanup(); }
        modalEl.addEventListener('transitionend', cleanupOnClose);
      }
```

- [ ] **Step 4:** Agregar `<script src="js/live-tracking.js"></script>` en
  `index.html`, después de `addresses.js` y antes de los `views/*.js` (no depende
  de ninguna vista, solo de `Auth`).

- [ ] **Step 5: CSS del mapa**

```css
/* ─── Live Tracking Map ─────────────────────────────────────────────── */
.tracking-map { width: 100%; height: 240px; border-radius: var(--radius); overflow: hidden; }
.worker-marker { font-size: 22px; color: var(--orange); text-shadow: 0 0 4px rgba(0,0,0,0.4); }
```

- [ ] **Step 6: Verificar en navegador**

Requiere simular el evento `worker_location` — no hay UI de worker en este sitio
para generarlo real. Verificación: forzar un pedido a `in_transit` (vía API con
cuenta admin, `PUT /api/orders/:id/status`), abrir su detalle como el cliente dueño
→ confirmar que el mapa se renderiza centrado en la dirección de entrega y el texto
"Esperando ubicación...". Desde la consola del navegador (Playwright
`browser_evaluate`, en la misma pestaña autenticada como ese cliente, ya que el
token de WS es el suyo), simular manualmente lo que enviaría un worker abriendo una
conexión aparte no es necesario — basta con confirmar que el `WebSocket` a `/ws` se
abre sin errores (revisar Network → WS en Playwright) y que cerrar el modal no deja
el socket abierto indefinidamente (confirmar `LiveTracking.disconnect` fue llamado
revisando que una nueva apertura del modal reconecta limpio, sin acumular
listeners — abrir/cerrar el modal 3 veces seguidas y confirmar que solo hay una
conexión WS activa).

- [ ] **Step 7: Commit** — omitido.

---

## Task 12: Pulido visual

**Files:**
- Modify: `website/css/styles.css`

**Interfaces:** ninguna (solo CSS).

- [ ] **Step 1: Auditar contraste sobre `--gold`**

`grep -n "var(--gold)" website/css/styles.css` — para cada regla que use
`background: var(--gold)` (o `--gold-light`) con texto encima, confirmar contraste
AA (4.5:1 para texto normal) usando el color de texto actual. `--gold` es `#FFD93D`
(luminosidad alta) — si el texto es blanco o un gris claro sobre ese fondo, no pasa
AA. Donde no pase, cambiar el color de texto a `var(--gray-900)` o `var(--dark)`
manteniendo el mismo fondo (no se toca la paleta, solo el texto encima de ella).

- [ ] **Step 2: Botones deshabilitados/loading consistentes**

`grep -n "btn.disabled = true" website/js/**/*.js` (todas las vistas, tras las
tareas anteriores) — confirmar que cada botón que dispara una petición async queda
`disabled` mientras espera Y su texto cambia a un estado de carga (`<span
class="spinner spinner-sm..."></span> ...`), consistente con el patrón ya usado en
`placeOrderBtn`. Donde falte (auditar especialmente los botones nuevos de las Tareas
6-11, que ya siguen el patrón, y los existentes en `renderAuthPage`/`openAuthModal`
si no lo tuvieran), agregarlo con el mismo patrón.

- [ ] **Step 3: Hero de home — jerarquía**

En `.hero` (o el selector equivalente usado por `renderHome`, confirmar el nombre
exacto de la clase con `grep -n "hero" website/css/styles.css`), aumentar el
`font-size` del título principal un nivel dentro de la escala tipográfica ya
existente (revisar qué variables de tamaño usa el resto del sistema — no inventar
valores nuevos sueltos) y asegurar que el CTA principal tenga suficiente
contraste/tamaño de touch-target (mínimo 44px de alto, estándar de accesibilidad
táctil) en viewport móvil.

- [ ] **Step 4: Verificar en navegador**

Playwright, capturar screenshot (`mcp__playwright__browser_take_screenshot`) de
home/productos/checkout en 375px y 1440px, revisión visual manual de que no hay
overlaps, texto cortado, o contraste ilegible. Confirmar con
`browser_evaluate` que no quedó ningún texto con contraste por debajo de AA en los
elementos tocados en el Step 1 (verificación manual leyendo los valores de color
computados, no hay herramienta automática de contraste en este toolset).

- [ ] **Step 5: Commit** — omitido.

---

## Task 13: QA final end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Flujo cliente completo**

Playwright contra el servidor local: registro nuevo `client` → login → buscar
producto → agregarlo a favoritos → agregarlo al carrito → ir a checkout → crear una
dirección nueva desde el link → seleccionarla → aplicar un código promo válido de
prueba → confirmar pedido → ver el pedido en `#/mis-pedidos` → abrir su detalle →
(forzando estado vía API admin a `delivered`) calificarlo con estrellas → confirmar
que la calificación quedó guardada al reabrir el detalle.

- [ ] **Step 2: Notificaciones**

Confirmar que el badge del header refleja notificaciones no leídas generadas por los
cambios de estado del pedido de la Step 1, y que abrir la vista de notificaciones y
hacer click en una la marca como leída (badge baja).

- [ ] **Step 3: Cuenta worker**

Login con una cuenta `worker` (registrar una nueva si no hay) → confirmar bloqueo en
TODAS las rutas (probar cambiando el hash manualmente a `#/checkout`, `#/favoritos`,
etc. — debe seguir bloqueado siempre) → cerrar sesión desde esa pantalla → confirmar
que vuelve a ver el sitio normal como visitante no logueado.

- [ ] **Step 4: Responsive**

Repetir el flujo del Step 1 (al menos: home → producto → carrito → checkout) en
viewport 375px, 768px, 1024px, 1440px. Confirmar que el menú hamburguesa (375px/768px)
da acceso a favoritos/notificaciones/direcciones/pedidos, y que en desktop
(1024px+) los iconos del header son visibles y no se solapan (con 2 iconos nuevos
agregados — favoritos y notificaciones — junto a carrito/pedidos/cuenta, confirmar
que el header no se desborda; si se ve apretado, es aceptable ocultar el label de
texto de "Favoritos"/"Notificaciones" en desktop y dejar solo el ícono, ya que
"Productos"/"Carrito" hacen lo mismo con `d-none d-md-inline` — usar el mismo patrón
si hace falta).

- [ ] **Step 5: Consola limpia**

`mcp__playwright__browser_console_messages` en cada pantalla visitada durante este
plan — cero errores. Warnings de librerías de terceros (Leaflet, Font Awesome) se
toleran si no afectan funcionalidad; cualquier error propio del código del sitio se
corrige antes de dar el plan por terminado.

- [ ] **Step 6: Reporte final**

Resumen corto al usuario: qué se agregó, qué se verificó, cualquier limitación
conocida (ej. si algún endpoint de prueba como la promoción `TEST10` quedó en la
base de datos de desarrollo y conviene borrarlo).

- [ ] **Step 7: Commit** — omitido (sin git en este proyecto).

---

## Self-review de este plan

- **Cobertura del spec:** favoritos ✓ (Task 6), notificaciones ✓ (Task 7),
  direcciones ✓ (Task 8), código promo ✓ (Task 9), calificación ✓ (Task 10,
  incorporada junto al bloqueo de rol porque ambas tocan el mismo
  `openOrderDetail`/`router()`), cancelar pedido — **ya existía en el código actual**,
  no se creó tarea nueva para eso, solo se mueve tal cual en la Task 4. Tracking en
  vivo ✓ (Task 11). Manejo de roles ✓ (Task 10). Visual ✓ (Task 12). QA ✓ (Task 13).
  División de `app.js` ✓ (Tasks 1-5).
- **Sin placeholders:** todas las tareas de features nuevas traen código completo;
  las tareas de extracción mecánica citan líneas exactas del archivo actual en vez de
  "mover lo correspondiente" vago.
- **Consistencia de tipos/nombres:** verificado que `App.*`/`Views.*`/`Favorites.*`/
  `Notifications.*`/`Addresses.*`/`LiveTracking.*` se usan con el mismo nombre en
  todas las tareas que los consumen (ej. `App.bindFavoriteButtons` definido en Task 6
  Step 3, usado en Task 6 Step 6 con el mismo nombre).
- **Desviación del spec original:** el spec proponía una vista `order-detail.js`
  separada; en la práctica el detalle de pedido es (y sigue siendo) un modal dentro
  de `views/account.js`, no una ruta — ajuste hecho al descubrir el código real
  durante la planificación, documentado aquí.
