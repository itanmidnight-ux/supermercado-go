# Alertas de stock bajo — diseño

## Problema

La columna `products.low_stock_threshold` existe en el schema, y `GET /api/analytics/products`
ya arma una lista `needs_attention` con razón `low_stock` cuando `stock <= low_stock_threshold`.
El Flutter admin (`android-app`) incluso tiene íconos distintos para esa razón. Pero **ningún
formulario ni endpoint de escritura permite setear `low_stock_threshold`**: ni
`validateProduct`/INSERT/UPDATE en `server/src/routes/products.js`, ni
`productos-form.ejs` (admin-panel web), ni el form de producto en Android. La columna
queda NULL para siempre → la alerta nunca dispara con datos reales.

Es una funcionalidad a medio construir, no código muerto: se termina, no se borra.

## Alcance

1. **Backend** (`server/src/routes/products.js`): `low_stock_threshold` editable
   (validación INTEGER ≥ 0 opcional, incluido en INSERT y UPDATE).
2. **Admin-panel web** (`server/src/admin-panel/`):
   - Input `low_stock_threshold` en `productos-form.ejs` + `formToProductBody` en `app.js`.
   - Vista nueva `/alertas` (EJS) que llama `GET /api/analytics/products` y lista
     `needs_attention`. Link fijo "⚠️ Alertas" en `partials/header.ejs` (sin contador en
     vivo para no meter una query extra en cada carga de página — solo se consulta al
     entrar a `/alertas`).
3. **dashboard.py (GTK)**: tarjeta/indicador de stock bajo en un módulo existente
   (Ventas o Datos), leyendo el mismo endpoint HTTP (mismo patrón que ya usa el archivo
   para consultar estado del bot vía `urllib.request`).
4. **Notificación WhatsApp al dueño**: al hacer `PUT /api/products/:id`, si el stock
   cruza el umbral hacia abajo (antes > threshold, después ≤ threshold), se llama
   `raiseAlert('low_stock', mensaje)` (`server/src/utils/securityAlert.js`, ya existente
   — mismo canal que usan `bot_disconnected`/`backup_failed`/`brute_force`). Resuelve
   solo el teléfono admin (`users.phone WHERE role='admin'`) e inserta en `messages`
   (`direction='outbound', sent=0`); el bot ya la drena sin cambios en `waBot.js`. No
   hace falta setting nuevo.

## Fuera de alcance

- Form de producto en Android (`products_screen.dart`) — sigue sin campo de stock/threshold,
  no se toca en esta pasada.
- Umbral global — se mantiene por producto (diseño ya existente de la columna).
- Contador en vivo en el header — se evita para no agregar una query en cada request admin.

## Riesgos / decisiones

- `raiseAlert` ya atrapa sus propios errores y no lanza — llamarla sin `await` (o con
  `await` dentro de su propio try/catch, como hacen `auth.js`/`securityMonitor.js`) no
  puede romper la respuesta de guardado del producto.
- Si ningún admin tiene `phone` registrado, `raiseAlert` solo loguea un warning — no
  falla. Comportamiento ya existente, no requiere manejo especial acá.
