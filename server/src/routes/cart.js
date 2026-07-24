'use strict';
const express = require('express');
const router  = express.Router();
const { clientAuth, adminAuth } = require('../middleware/auth');
const { getDB, withTransaction } = require('../db/database');

// GET /api/cart — get my cart items
router.get('/', clientAuth, async (req, res, next) => {
  try {
    const { rows: items } = await getDB().query(`
      SELECT ci.*, p.name as product_name, p.price, p.available
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.client_username = $1
      ORDER BY ci.created_at ASC
    `, [req.user.username]);
    res.json({ items });
  } catch (e) { next(e); }
});

// POST /api/cart — add/update item
router.post('/', clientAuth, async (req, res, next) => {
  try {
    const { product_id, quantity, delivery_date } = req.body;
    if (!product_id || !quantity || quantity < 1)
      return res.status(400).json({ error: 'product_id y quantity requeridos' });
    const db = getDB();
    const { rows: prodRows } = await db.query('SELECT id FROM products WHERE id=$1 AND available=1', [product_id]);
    if (!prodRows[0]) return res.status(404).json({ error: 'Producto no disponible' });
    const { rows: existingRows } = await db.query(
      'SELECT id FROM cart_items WHERE client_username=$1 AND product_id=$2', [req.user.username, product_id]
    );
    const existing = existingRows[0];
    if (existing) {
      await db.query('UPDATE cart_items SET quantity=$1, delivery_date=$2 WHERE id=$3',
        [quantity, delivery_date || null, existing.id]);
    } else {
      await db.query('INSERT INTO cart_items (client_username, product_id, quantity, delivery_date) VALUES ($1,$2,$3,$4)',
        [req.user.username, product_id, quantity, delivery_date || null]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/cart/:product_id — remove item
router.delete('/:product_id', clientAuth, async (req, res, next) => {
  try {
    await getDB().query('DELETE FROM cart_items WHERE client_username=$1 AND product_id=$2',
      [req.user.username, req.params.product_id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// DELETE /api/cart — clear cart
router.delete('/', clientAuth, async (req, res, next) => {
  try {
    await getDB().query('DELETE FROM cart_items WHERE client_username=$1', [req.user.username]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/cart/checkout — place order from cart
// delivery_mode: 'gps' (comparte ubicación en tiempo real) o 'address'
// (dirección escrita a mano). Contra entrega SOLO se permite en modo 'gps'
// -- sin ubicación en tiempo real el trabajador no puede confirmar la
// entrega para cobrar en efectivo, es una regla de seguridad del negocio,
// no solo de la UI (se valida aquí, no solo en la app).
router.post('/checkout', clientAuth, async (req, res, next) => {
  try {
    const {
      payment_method, nequi_reference, payment_reference, delivery_date,
      delivery_mode, delivery_lat, delivery_lng, delivery_address,
    } = req.body;

    if (!['nequi', 'visa', 'contra_entrega'].includes(payment_method))
      return res.status(400).json({ error: 'payment_method debe ser nequi, visa o contra_entrega' });
    if (!['gps', 'address'].includes(delivery_mode))
      return res.status(400).json({ error: 'delivery_mode debe ser gps o address' });

    const reference = payment_reference || nequi_reference;
    if (payment_method === 'nequi' || payment_method === 'visa') {
      if (!reference || typeof reference !== 'string' || !reference.trim() || reference.length > 100)
        return res.status(400).json({ error: 'Referencia de pago inválida (máx 100 caracteres)' });
    }
    if (payment_method === 'contra_entrega' && delivery_mode !== 'gps')
      return res.status(400).json({ error: 'Pago contra entrega requiere compartir tu ubicación en tiempo real' });

    let lat = null, lng = null;
    if (delivery_mode === 'gps') {
      lat = Number(delivery_lat);
      lng = Number(delivery_lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return res.status(400).json({ error: 'Ubicación GPS inválida' });
    } else if (!delivery_address || typeof delivery_address !== 'string' || !delivery_address.trim() || delivery_address.length > 300) {
      return res.status(400).json({ error: 'Dirección de entrega inválida (máx 300 caracteres)' });
    }

    const db = getDB();
    const { rows: items } = await db.query(`
      SELECT ci.*, p.name as product_name, p.price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.client_username = $1
    `, [req.user.username]);

    if (!items.length) return res.status(400).json({ error: 'Carrito vacío' });

    const total        = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const finalDate     = delivery_date || items[0]?.delivery_date || null;
    const itemsSummary = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');
    const payLabels    = { nequi: 'Nequi', visa: 'Tarjeta Visa', contra_entrega: 'Contra entrega' };
    const payLabel     = payLabels[payment_method];
    const safeRef      = reference ? reference.trim() : null;
    // nequi/visa se confirman con una referencia -- se marcan pagados de
    // inmediato (misma logica que ya usaba Nequi); contra entrega se cobra
    // cuando el trabajador entrega, ahi queda en 0 hasta ese momento.
    const isPaid       = payment_method !== 'contra_entrega';
    const addrForOrder = delivery_mode === 'gps'
      ? 'Ubicación en tiempo real (ver mapa)'
      : String(delivery_address).trim();

    const { rows: clientRows } = await db.query('SELECT display_name, address, phone FROM users WHERE username=$1', [req.user.username]);
    const clientUser = clientRows[0];
    const clientName = clientUser?.display_name || req.user.username;
    // Telefono real del cliente (columna users.phone, pedida en el registro)
    // -- antes se usaba un placeholder falso "app:<username>" que dejaba al
    // trabajador sin forma de llamar o escribirle de verdad por WhatsApp.
    // Fallback solo para cuentas viejas creadas antes de pedir el celular.
    const realPhone  = clientUser?.phone || `app:${req.user.username}`;

    const order = await withTransaction(async (client) => {
      const { rows: existingCustRows } = await client.query('SELECT id FROM customers WHERE phone=$1', [realPhone]);
      const existingCust = existingCustRows[0];
      let customerId;
      if (existingCust) {
        await client.query('UPDATE customers SET name=$1 WHERE id=$2', [clientName, existingCust.id]);
        customerId = existingCust.id;
      } else {
        const { rows } = await client.query('INSERT INTO customers (phone, name) VALUES ($1,$2) RETURNING id', [realPhone, clientName]);
        customerId = rows[0].id;
      }

      const { rows: orderRows } = await client.query(`
        INSERT INTO orders (
          customer_id, product_name, delivery_address, wa_message, requested_at, status, is_fiado,
          delivery_mode, delivery_lat, delivery_lng, payment_method, payment_reference, paid
        )
        VALUES ($1,$2,$3,$4,now_iso(),'pending',0,$5,$6,$7,$8,$9,$10) RETURNING id
      `, [
        customerId, itemsSummary, addrForOrder, `[App] ${clientName} • ${payLabel}${safeRef ? ' ref:' + safeRef : ''}`,
        delivery_mode, lat, lng, payment_method, safeRef, isPaid ? 1 : 0,
      ]);
      const mainOrderId = orderRows[0].id;

      for (const item of items) {
        await client.query('INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES ($1,$2,$3,$4,$5)',
          [mainOrderId, item.product_id, item.product_name, item.price, item.quantity]);
      }

      const { rows: coRows } = await client.query(`
        INSERT INTO client_orders (
          client_username, items_json, total, payment_method, nequi_reference, delivery_date,
          delivery_mode, delivery_lat, delivery_lng, delivery_address
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [
        req.user.username,
        JSON.stringify(items.map(i => ({ id: i.product_id, name: i.product_name, price: i.price, qty: i.quantity }))),
        total, payment_method, safeRef, finalDate,
        delivery_mode, lat, lng, addrForOrder,
      ]);

      await client.query('DELETE FROM cart_items WHERE client_username=$1', [req.user.username]);
      return coRows[0];
    });

    res.status(201).json({ order });
  } catch (e) {
    res.status(500).json({ error: 'Error procesando pedido — intenta de nuevo' });
  }
});

// GET /api/cart/orders — admin list all client orders
router.get('/orders', adminAuth, async (req, res, next) => {
  try {
    const { rows: orders } = await getDB().query('SELECT * FROM client_orders ORDER BY created_at DESC');
    res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items_json) })) });
  } catch (e) { next(e); }
});

module.exports = router;
