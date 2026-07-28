# Alertas de Stock Bajo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminar la funcionalidad de alerta de stock bajo (columna `low_stock_threshold` ya existe pero nunca fue editable) y mostrarla en admin-panel web + dashboard.py GTK, con notificación WhatsApp al admin cuando un producto cruza el umbral.

**Architecture:** El backend Node/Express ya calcula `needs_attention` (razón `low_stock`) en `GET /api/analytics/products` — solo falta poder escribir `low_stock_threshold`. Admin-panel web (EJS) consume la API vía `apiRequest` (patrón ya usado en `/productos`). dashboard.py consulta Postgres directo vía `query()` (patrón ya usado en `SalesModule`/`OrdersModule`), no la API HTTP. La notificación reusa `raiseAlert(kind, message)` (`server/src/utils/securityAlert.js`), ya usado por `bot_disconnected`/`backup_failed`/`brute_force` — mismo canal, sin tocar `waBot.js`.

**Tech Stack:** Node 20 + Express + PostgreSQL (backend), EJS (admin-panel), Python 3 + GTK3 + Cairo + psycopg2 (dashboard.py), Jest + Supertest (tests backend).

## Global Constraints

- No tocar `android-app` (Flutter) — spec lo deja fuera de alcance.
- No agregar settings nuevos — reusar `raiseAlert` (ya resuelve el teléfono admin desde `users.phone`).
- `low_stock_threshold` es INTEGER opcional, mismo patrón de nullabilidad que `stock` (`campo ?? null` en destructuring, `COALESCE($n, col)` en UPDATE).
- dashboard.py usa `query(sql, params)` (Postgres directo, solo lectura, nunca lanza) — no `http_get` — para mantener consistencia con el resto de `SalesModule`/`OrdersModule`.
- Cada task termina con verificación ejecutada (test Jest para backend; `python3 -m py_compile` + arranque real para dashboard.py; `node -c` para EJS/JS del admin-panel).

---

### Task 1: Backend — `low_stock_threshold` editable

**Files:**
- Modify: `server/src/routes/products.js:29-61` (`validateProduct`), `:112-132` (POST), `:134-171` (PUT)
- Test: `server/test/product-low-stock.test.js` (crear)

**Interfaces:**
- Produces: `products.low_stock_threshold` ahora aceptado en `POST /api/products` y `PUT /api/products/:id`, validado como INTEGER ≥ 0 u `null`.

- [ ] **Step 1: Escribir test que falla**

```js
'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('product-low-stock');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function loginAdmin() {
  const res = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  return res.body.token;
}

describe('low_stock_threshold editable', () => {
  let token;
  beforeAll(async () => { token = await loginAdmin(); });

  test('POST /api/products acepta low_stock_threshold', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Arroz 500g', price: 3500, stock: 20, low_stock_threshold: 5 });
    expect(res.status).toBe(200);
    expect(res.body.low_stock_threshold).toBe(5);
  });

  test('PUT /api/products/:id actualiza low_stock_threshold', async () => {
    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Aceite 1L', price: 8000, stock: 10, low_stock_threshold: 2 });
    const res = await request(app).put(`/api/products/${created.body.id}`).set('Authorization', `Bearer ${token}`)
      .send({ low_stock_threshold: 3 });
    expect(res.status).toBe(200);
    expect(res.body.low_stock_threshold).toBe(3);
  });

  test('low_stock_threshold negativo es rechazado', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Prod Invalido', price: 1000, low_stock_threshold: -1 });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Correr test, confirmar que falla**

Run: `cd server && npx jest product-low-stock -v`
Expected: FAIL — `low_stock_threshold` no viaja al INSERT/UPDATE, columna queda `null`, `expect(...).toBe(5)` falla.

- [ ] **Step 3: Implementar**

En `validateProduct` (`server/src/routes/products.js:29`), agregar el parámetro y su chequeo:

```js
function validateProduct({ name, price, aliases, category, description, sku, stock, low_stock_threshold }) {
  // ... (validaciones existentes de name/price/aliases/category/description/sku/stock sin cambios)
  if (low_stock_threshold !== undefined && low_stock_threshold !== null) {
    if (typeof low_stock_threshold !== 'number' || isNaN(low_stock_threshold) || low_stock_threshold < 0 || low_stock_threshold > 1_000_000)
      return 'low_stock_threshold debe ser número positivo menor a 1,000,000';
  }
  return null;
}
```

En `POST /` (línea 112-132), agregar a la destructuración, a la llamada de `validateProduct`, al INSERT y a los params:

```js
const { name, price, aliases, category, description, sku, stock, low_stock_threshold } = req.body;
if (!name || price == null) return res.status(400).json({ error: 'name y price requeridos' });
const err = validateProduct({ name, price, aliases, category, description, sku, stock, low_stock_threshold });
if (err) return res.status(400).json({ error: err });
const db = getDB();
const { rows } = await db.query(`INSERT INTO products (name, price, aliases, category, description, sku, stock, low_stock_threshold)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
  [
    sanitizeText(name, 150), price, JSON.stringify(aliases || []),
    category ? sanitizeText(category, 80) : null,
    description ? sanitizeText(description, 2000) : null,
    sku ? sanitizeText(sku, 60) : null,
    stock ?? null,
    low_stock_threshold ?? null,
  ]);
```

En `PUT /:id` (línea 134-171), agregar a la destructuración, validación, UPDATE y params:

```js
const { name, price, aliases, available, favorite, no_fiado, category, description, sku, stock, low_stock_threshold } = req.body;
const err = validateProduct({ name, price, aliases, category, description, sku, stock, low_stock_threshold });
if (err) return res.status(400).json({ error: err });
const db = getDB();
const { rows } = await db.query(`UPDATE products SET
  name        = COALESCE($1, name),
  price       = COALESCE($2, price),
  aliases     = COALESCE($3, aliases),
  available   = COALESCE($4, available),
  favorite    = COALESCE($5, favorite),
  no_fiado    = COALESCE($6, no_fiado),
  category    = COALESCE($7, category),
  description = COALESCE($8, description),
  sku         = COALESCE($9, sku),
  stock       = COALESCE($10, stock),
  low_stock_threshold = COALESCE($11, low_stock_threshold)
  WHERE id = $12 RETURNING *`,
  [
    name   ? sanitizeText(name, 150) : null,
    price  ?? null,
    aliases ? JSON.stringify(aliases) : null,
    available ?? null,
    favorite  ?? null,
    no_fiado  ?? null,
    category !== undefined ? (category ? sanitizeText(category, 80) : null) : null,
    description !== undefined ? (description ? sanitizeText(description, 2000) : null) : null,
    sku !== undefined ? (sku ? sanitizeText(sku, 60) : null) : null,
    stock ?? null,
    low_stock_threshold ?? null,
    id,
  ]);
```

- [ ] **Step 4: Correr test, confirmar que pasa**

Run: `cd server && npx jest product-low-stock -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/products.js server/test/product-low-stock.test.js
git commit -m "feat: low_stock_threshold editable en API de productos"
```

---

### Task 2: Backend — notificar WhatsApp al cruzar umbral

**Files:**
- Modify: `server/src/routes/products.js:134-171` (PUT, agregado en Task 1)
- Test: `server/test/product-low-stock.test.js` (agregar tests)

**Interfaces:**
- Consumes: `raiseAlert(kind, message)` de `server/src/utils/securityAlert.js` (ya existe, firma `async (kind: string, message: string) => void`, nunca lanza).
- Produces: fila en `messages` (`direction='outbound', sent=0, type='security_alert'`) cuando `stock` pasa de `> low_stock_threshold` a `<= low_stock_threshold` en un mismo PUT.

- [ ] **Step 1: Agregar test que falla**

Agregar a `server/test/product-low-stock.test.js`:

```js
const { getDB } = require('../src/db/database');

async function lastAlertFor(db, phone) {
  const { rows } = await db.query(`
    SELECT * FROM messages WHERE phone=$1 AND direction='outbound' AND type='security_alert'
    ORDER BY id DESC LIMIT 1
  `, [phone]);
  return rows[0];
}

test('cruzar el umbral hacia abajo encola alerta WhatsApp al admin', async () => {
  const db = getDB();
  await db.query(`UPDATE users SET phone='573001112233' WHERE username='jesus'`);

  const created = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Leche 1L', price: 4000, stock: 10, low_stock_threshold: 5 });

  const res = await request(app).put(`/api/products/${created.body.id}`).set('Authorization', `Bearer ${token}`)
    .send({ stock: 3 });
  expect(res.status).toBe(200);

  const msg = await lastAlertFor(db, '573001112233');
  expect(msg).toBeTruthy();
  expect(msg.content).toMatch(/leche 1l/i);
  expect(msg.content).toMatch(/3/);
});
```

- [ ] **Step 2: Correr test, confirmar que falla**

Run: `cd server && npx jest product-low-stock -v`
Expected: FAIL — no se encola ninguna fila en `messages`, `msg` es `undefined`.

- [ ] **Step 3: Implementar**

En `server/src/routes/products.js`, importar arriba (junto a los demás `require`):

```js
const { raiseAlert } = require('../utils/securityAlert');
```

En el handler `PUT /:id`, antes del UPDATE, leer el estado previo; después del UPDATE, comparar y notificar:

```js
router.put('/:id', adminAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const { name, price, aliases, available, favorite, no_fiado, category, description, sku, stock, low_stock_threshold } = req.body;
    const err = validateProduct({ name, price, aliases, category, description, sku, stock, low_stock_threshold });
    if (err) return res.status(400).json({ error: err });
    const db = getDB();
    const { rows: beforeRows } = await db.query('SELECT stock, low_stock_threshold FROM products WHERE id=$1', [id]);
    const before = beforeRows[0];
    const { rows } = await db.query(`UPDATE products SET
      name        = COALESCE($1, name),
      price       = COALESCE($2, price),
      aliases     = COALESCE($3, aliases),
      available   = COALESCE($4, available),
      favorite    = COALESCE($5, favorite),
      no_fiado    = COALESCE($6, no_fiado),
      category    = COALESCE($7, category),
      description = COALESCE($8, description),
      sku         = COALESCE($9, sku),
      stock       = COALESCE($10, stock),
      low_stock_threshold = COALESCE($11, low_stock_threshold)
      WHERE id = $12 RETURNING *`,
      [
        name   ? sanitizeText(name, 150) : null,
        price  ?? null,
        aliases ? JSON.stringify(aliases) : null,
        available ?? null,
        favorite  ?? null,
        no_fiado  ?? null,
        category !== undefined ? (category ? sanitizeText(category, 80) : null) : null,
        description !== undefined ? (description ? sanitizeText(description, 2000) : null) : null,
        sku !== undefined ? (sku ? sanitizeText(sku, 60) : null) : null,
        stock ?? null,
        low_stock_threshold ?? null,
        id,
      ]);
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'No encontrado' });
    if (before && product.low_stock_threshold != null &&
        before.stock > product.low_stock_threshold && product.stock <= product.low_stock_threshold) {
      raiseAlert('low_stock', `${product.name}: quedan ${product.stock} unidades (mínimo ${product.low_stock_threshold})`)
        .catch(() => {}); // raiseAlert ya loguea sus propios errores, no debe romper esta respuesta
    }
    res.json({ ...product, aliases: JSON.parse(product.aliases || '[]') });
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Correr test, confirmar que pasa**

Run: `cd server && npx jest product-low-stock -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Correr suite completa (no romper nada)**

Run: `cd server && npx jest`
Expected: todos los tests existentes siguen en PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/products.js server/test/product-low-stock.test.js
git commit -m "feat: notifica WhatsApp al admin cuando un producto cruza el umbral de stock bajo"
```

---

### Task 3: Admin-panel web — campo editable en el formulario

**Files:**
- Modify: `server/src/admin-panel/views/productos-form.ejs:32` (junto al input de `stock`)
- Modify: `server/src/admin-panel/app.js:126-140` (`formToProductBody`)

**Interfaces:**
- Consumes: Task 1 (`low_stock_threshold` aceptado por la API).

- [ ] **Step 1: Agregar el input en el form**

En `productos-form.ejs`, justo después de la línea del input `stock` (línea 32):

```html
<input type="number" name="stock" value="<%= product && product.stock !== null && product.stock !== undefined ? product.stock : '' %>" min="0" placeholder="Sin límite">
<label>Alertar cuando el stock baje de</label>
<input type="number" name="low_stock_threshold" value="<%= product && product.low_stock_threshold !== null && product.low_stock_threshold !== undefined ? product.low_stock_threshold : '' %>" min="0" placeholder="Sin alerta">
```

- [ ] **Step 2: Incluir el campo en `formToProductBody`**

En `server/src/admin-panel/app.js:126`:

```js
function formToProductBody(body) {
  const out = {
    name: (body.name || '').trim(),
    price: body.price !== undefined && body.price !== '' ? Number(body.price) : undefined,
    category: body.category || null,
    description: body.description || null,
    sku: body.sku || null,
    stock: body.stock !== undefined && body.stock !== '' ? Number(body.stock) : null,
    low_stock_threshold: body.low_stock_threshold !== undefined && body.low_stock_threshold !== '' ? Number(body.low_stock_threshold) : null,
    available: body.available === 'on' ? 1 : 0,
    favorite: body.favorite === 'on' ? 1 : 0,
    no_fiado: body.no_fiado === 'on' ? 1 : 0,
  };
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node -c server/src/admin-panel/app.js`
Expected: sin output (OK).

- [ ] **Step 4: Verificar manualmente**

Run: `bash deploy-linux.sh --start` (o el servidor ya activo), entrar a `http://localhost:3002/productos/nuevo`, crear un producto con "Alertar cuando el stock baje de" = 5, guardar, reabrir el producto y confirmar que el valor persiste.

- [ ] **Step 5: Commit**

```bash
git add server/src/admin-panel/views/productos-form.ejs server/src/admin-panel/app.js
git commit -m "feat: campo de umbral de stock bajo en el form de producto (admin-panel)"
```

---

### Task 4: Admin-panel web — vista de alertas

**Files:**
- Create: `server/src/admin-panel/views/alertas.ejs`
- Modify: `server/src/admin-panel/app.js` (nueva ruta `GET /alertas`)
- Modify: `server/src/admin-panel/views/partials/header.ejs` (link de navegación)

**Interfaces:**
- Consumes: `GET /api/analytics/products` (ya existe, `adminAuth`) vía `apiRequest(req.adminToken, 'GET', '/api/analytics/products')` — mismo patrón que la ruta `/productos`.

- [ ] **Step 1: Agregar la ruta**

En `server/src/admin-panel/app.js`, junto a la ruta `/productos` (línea 59):

```js
app.get('/alertas', async (req, res) => {
  const { ok, data } = await apiRequest(req.adminToken, 'GET', '/api/analytics/products');
  render(req, res, 'alertas', {
    needsAttention: ok && Array.isArray(data?.needs_attention) ? data.needs_attention : [],
    error: ok ? null : 'No se pudo cargar las alertas.',
  });
});
```

- [ ] **Step 2: Crear la vista**

`server/src/admin-panel/views/alertas.ejs` (misma estructura que `productos-lista.ejs`: include de header con `csrf`, include de footer al final):

```html
<%- include('partials/header', { csrf }) %>

<h1>⚠️ Alertas</h1>
<% if (error) { %><p class="error"><%= error %></p><% } %>

<% if (needsAttention.length) { %>
  <ul class="alertas-lista">
    <% needsAttention.forEach(function(item) { %>
      <li class="alerta-<%= item.reason %>">
        <strong><%= item.name %></strong> — <%= item.detail %>
        <span class="alerta-tag"><%= item.reason === 'low_stock' ? 'Stock bajo' : 'Baja demanda' %></span>
      </li>
    <% }); %>
  </ul>
<% } else { %>
  <div class="empty-state">
    <div style="font-size: 3rem; margin-bottom: .5rem;">✅</div>
    <p style="font-size: 1.05rem;">Sin alertas — todo el inventario está por encima del mínimo configurado.</p>
  </div>
<% } %>

<%- include('partials/footer') %>
```

- [ ] **Step 3: Agregar link en el header**

En `server/src/admin-panel/views/partials/header.ejs:16-17`, junto al link existente a `/productos`:

```html
<a href="/productos">Productos</a>
<a href="/productos/nuevo">+ Nuevo</a>
<a href="/alertas">⚠️ Alertas</a>
```

- [ ] **Step 4: Verificar sintaxis**

Run: `node -c server/src/admin-panel/app.js`
Expected: sin output (OK).

- [ ] **Step 5: Verificar manualmente**

Entrar a `http://localhost:3002/alertas` logueado como admin, confirmar que lista productos con stock bajo el umbral configurado en Task 3 (crear un producto con stock=2, threshold=5 para verlo aparecer).

- [ ] **Step 6: Commit**

```bash
git add server/src/admin-panel/views/alertas.ejs server/src/admin-panel/app.js server/src/admin-panel/views/partials/header.ejs
git commit -m "feat: vista de alertas de stock bajo en admin-panel"
```

---

### Task 5: dashboard.py — badge visual en el sidebar (mecanismo genérico + fix de bug existente)

**Files:**
- Modify: `dashboard.py:5153-5179` (`_add_module`)
- Modify: `dashboard.py:5039-5046` (registro de módulos)
- Modify: `dashboard.py:2106-2123` (`OrdersModule.refresh`)

**Interfaces:**
- Produces: `MainWindow.set_badge(key: str, count: int)` — actualiza (o esconde si `count == 0`) el badge del botón de sidebar registrado con ese `key`.

**Contexto:** `_add_module` ya acepta un parámetro `badge_key` (usado hoy solo en `'orders'`, línea 5040) pero nunca lo usa — no crea ningún widget de badge. El CSS `.sidebar-btn .badge` (línea 175) ya existe, listo, sin consumidor. Esta task cierra ese hueco y de paso lo deja disponible para stock bajo (Task 6).

- [ ] **Step 1: Reescribir `_add_module` para crear el badge**

En `dashboard.py:5153`, reemplazar el cuerpo del método:

```python
def _add_module(self, key, label, ModuleClass, badge_key=None):
    """Agrega un botón al sidebar y registra el módulo instanciado."""
    btn = Gtk.Button()
    row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
    lbl = Gtk.Label(label=label)
    lbl.set_xalign(0)
    row.pack_start(lbl, True, True, 0)
    badge = None
    if badge_key:
        badge = Gtk.Label(label='')
        badge.get_style_context().add_class('badge')
        badge.set_no_show_all(True)  # arranca oculto hasta el primer refresh con count>0
        row.pack_start(badge, False, False, 0)
        self.module_badges[badge_key] = badge
    btn.add(row)
    btn.get_style_context().add_class('sidebar-btn')
    btn.set_relief(Gtk.ReliefStyle.NONE)
    btn.connect('clicked', lambda *_: self.switch_module(key))
    self.sidebar.pack_start(btn, False, False, 1)
    self.module_buttons[key] = btn
    self.modules[key] = ModuleClass(self)
    self.content_stack.add_named(self.modules[key].box, key)

def set_badge(self, key, count):
    """Actualiza el badge numerico de un boton del sidebar (oculto si count<=0)."""
    badge = self.module_badges.get(key)
    if not badge:
        return
    if count and count > 0:
        badge.set_text(str(count))
        badge.set_visible(True)
    else:
        badge.set_visible(False)
```

En `dashboard.py:5004-5005`, agregar la nueva línea junto a las que ya inicializan `module_buttons`/`modules`:

```python
self.module_buttons = {}
self.module_badges = {}
self.modules = {}
```

- [ ] **Step 2: Wirear el badge de pedidos pendientes (fix del bug existente)**

En `OrdersModule.refresh` (`dashboard.py:2117-2122`), agregar la última línea:

```python
if stats:
    p, c, e, t = stats[0]
    self.card_pending.set_value(str(p))
    self.card_claimed.set_value(str(c))
    self.card_camino.set_value(str(e))
    self.card_today.set_value(str(t))
    self.parent.set_badge('orders', p)
```

- [ ] **Step 3: Verificar sintaxis**

Run: `python3 -m py_compile dashboard.py`
Expected: sin output (OK, sin `SyntaxError`).

- [ ] **Step 4: Verificar manualmente**

Run: `python3 dashboard.py` (con servidor Node corriendo y Postgres con al menos un pedido `pending`). Confirmar: el botón "Pedidos activos" del sidebar muestra un badge numérico rojo con el conteo de pendientes, y desaparece si no hay pendientes.

- [ ] **Step 5: Commit**

```bash
git add dashboard.py
git commit -m "fix: implementa el badge de sidebar (badge_key existía sin uso) y lo conecta a pedidos pendientes"
```

---

### Task 6: dashboard.py — tarjeta y badge de stock bajo en Ventas

**Files:**
- Modify: `dashboard.py:5042` (registro de `SalesModule`, agregar `badge_key='sales'`)
- Modify: `dashboard.py:1734` (`SalesModule.__init__`, agregar sección de stock bajo)
- Modify: `dashboard.py:1818` (`SalesModule.refresh`, agregar consulta + poblar sección + badge)

**Interfaces:**
- Consumes: `query(sql, params)` (Postgres directo, ya existe), `MainWindow.set_badge(key, count)` (Task 5).

- [ ] **Step 1: Registrar el badge_key del módulo**

En `dashboard.py:5042`:

```python
self._add_module('sales',   'Ventas', SalesModule, badge_key='sales')
```

- [ ] **Step 2: Agregar la sección de stock bajo al layout**

En `SalesModule.__init__` (`dashboard.py:1734`), después del bloque "Top productos" (antes de que termine `__init__`, alrededor de la línea 1816):

```python
        # ─── Stock bajo ───────────────────────────────────────────────
        stock_title = Gtk.Label(label='STOCK BAJO EL MÍNIMO CONFIGURADO', xalign=0)
        stock_title.get_style_context().add_class('section-title')
        self.box.pack_start(stock_title, False, False, 0)

        self.stock_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.box.pack_start(self.stock_box, False, False, 0)

        self.stock_empty_label = Gtk.Label(label='Sin alertas de stock — todo por encima del mínimo ✓')
        self.stock_empty_label.get_style_context().add_class('empty-state')
        self.stock_box.pack_start(self.stock_empty_label, False, False, 0)
```

- [ ] **Step 3: Poblar la sección en `refresh()`**

En `SalesModule.refresh` (`dashboard.py:1818`), al final del método:

```python
        # Stock bajo
        for w in self.stock_box.get_children():
            self.stock_box.remove(w)
        low_stock = query("""
            SELECT name, stock, low_stock_threshold FROM products
            WHERE stock IS NOT NULL AND low_stock_threshold IS NOT NULL AND stock <= low_stock_threshold
            ORDER BY stock ASC
        """)
        if low_stock:
            for name, stock, threshold in low_stock:
                row = Gtk.Box(spacing=8)
                lbl = Gtk.Label(label=f'⚠️ {name} — quedan {stock} (mínimo {threshold})', xalign=0)
                row.pack_start(lbl, True, True, 0)
                self.stock_box.pack_start(row, False, False, 0)
            self.stock_box.show_all()
        else:
            self.stock_box.pack_start(self.stock_empty_label, False, False, 0)
            self.stock_empty_label.show()
        self.parent.set_badge('sales', len(low_stock))
```

- [ ] **Step 4: Verificar sintaxis**

Run: `python3 -m py_compile dashboard.py`
Expected: sin output (OK).

- [ ] **Step 5: Verificar manualmente**

Con al menos un producto en threshold (creado en Task 3), abrir `python3 dashboard.py`, ir a "Ventas", confirmar que aparece la fila de stock bajo y que el sidebar muestra el badge numérico en "Ventas". Bajar el stock por encima del umbral y refrescar — confirmar que desaparece la fila y el badge.

- [ ] **Step 6: Commit**

```bash
git add dashboard.py
git commit -m "feat: tarjeta y badge de stock bajo en el módulo Ventas de dashboard.py"
```

---

### Task 7: Actualizar README

**Files:**
- Modify: `README.md` (tabla de endpoints / sección de features, si existe una lista de capacidades del admin)

- [ ] **Step 1: Agregar la nueva capacidad**

En la tabla "API endpoints principales" de `README.md`, agregar filas para `GET /api/analytics/products` si no está ya documentada, y una mención breve de la alerta de stock bajo (admin-panel `/alertas`, badge en dashboard.py, notificación WhatsApp).

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: documenta alertas de stock bajo en README"
```
