// src/routes/orders.js — Rutas de pedidos (CRUD + flujo de estados)
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const inventoryService = require('../services/inventory.service');
const notificationService = require('../services/notification.service');
const whatsappService = require('../services/whatsapp.service');
const wsService = require('../services/ws.service');
const config = require('../config');

const router = Router();

// Transiciones válidas de estado
const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['assigned', 'picked_up', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  picked_up: [],
};

/**
 * POST /api/orders — Crear nuevo pedido [client]
 */
router.post('/', authMiddleware(['client']), (req, res) => {
  const { items, delivery_address, delivery_lat, delivery_lng, fulfillment_type, notes, promo_code, scheduled_for } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe contener al menos un producto' });
  }

  try {
    const result = runInTransaction((dbTx) => {
      const now = nowBogota();
      const orderId = generateId();
      const userId = req.user.id;

      // Obtener datos del cliente
      const user = dbTx.prepare('SELECT name, phone FROM users WHERE id = ?').get(userId);

      // Calcular items y totales
      let subtotal = 0;
      let taxTotal = 0;
      const orderItems = [];

      for (const item of items) {
        const product = dbTx.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
        if (!product) {
          throw new Error(`Producto no encontrado o inactivo: ${item.product_id}`);
        }

        const qty = Number(item.qty) || 1;
        if (qty <= 0) throw new Error('La cantidad debe ser mayor a 0');

        // Verificar stock
        if (product.stock < qty) {
          throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}`);
        }

        const unitPrice = roundCOP(product.price);
        const discount = 0;
        const taxRate = product.tax_rate || 0;
        const lineTotal = roundCOP(unitPrice * qty);
        const taxAmount = roundCOP(lineTotal * taxRate);

        orderItems.push({
          id: generateId(),
          order_id: orderId,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          unit: product.unit || 'un',
          qty,
          unit_price: unitPrice,
          discount,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          line_total: lineTotal,
        });

        subtotal += lineTotal;
        taxTotal += taxAmount;

        // Descontar stock
        inventoryService.registrarMovimiento(dbTx, {
          productId: product.id,
          type: 'venta',
          qty: -qty,
          unitCost: product.cost || 0,
          referenceType: 'order',
          referenceId: orderId,
          userId,
        });
      }

      subtotal = roundCOP(subtotal);
      taxTotal = roundCOP(taxTotal);

      // Calcular tarifa de envío
      let deliveryFee = roundCOP(config.delivery.feeDefault);
      if (fulfillment_type === 'pickup') {
        deliveryFee = 0;
      } else if (subtotal >= config.delivery.freeMin) {
        deliveryFee = 0;
      }

      // Aplicar código de promoción
      let discount = 0;
      if (promo_code) {
        const promo = dbTx.prepare('SELECT * FROM promotions WHERE code = ? AND is_active = 1').get(promo_code);
        if (!promo) {
          throw new Error('El código de promoción no es válido');
        }
        const nowIso = new Date().toISOString();
        if (promo.starts_at && promo.starts_at > nowIso) throw new Error('La promoción aún no ha comenzado');
        if (promo.ends_at && promo.ends_at < nowIso) throw new Error('La promoción ya ha expirado');
        if (promo.min_order && subtotal < promo.min_order) throw new Error(`El pedido mínimo para esta promoción es $${promo.min_order.toLocaleString('es-CO')}`);
        if (promo.max_uses && promo.uses >= promo.max_uses) throw new Error('La promoción ya agotó sus usos disponibles');

        if (promo.type === 'porcentaje') {
          discount = roundCOP(subtotal * (promo.value / 100));
        } else if (promo.type === 'monto_fijo') {
          discount = roundCOP(promo.value);
        } else if (promo.type === 'envio_gratis') {
          deliveryFee = 0;
        }

        // Incrementar uso de la promoción
        dbTx.prepare('UPDATE promotions SET uses = uses + 1 WHERE id = ?').run(promo.id);
      }

      discount = roundCOP(discount);
      const total = roundCOP(subtotal - discount + taxTotal + deliveryFee);

      // Generar código de recogida si es pickup
      let pickupCode = null;
      if (fulfillment_type === 'pickup') {
        pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }

      // Insertar pedido
      dbTx.prepare(`
        INSERT INTO orders (
          id, user_id, status, subtotal, delivery_fee, discount, tax_total, total,
          payment_method, delivery_address, delivery_lat, delivery_lng,
          fulfillment_type, pickup_code, scheduled_for,
          client_name, client_phone, notes, created_at, updated_at
        ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, 'efectivo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, userId, subtotal, deliveryFee, discount, taxTotal, total,
        delivery_address || null, delivery_lat || null, delivery_lng || null,
        fulfillment_type || 'delivery', pickupCode, scheduled_for || null,
        user.name, user.phone, notes || null, now, now
      );

      // Insertar order_items
      const insertItem = dbTx.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, product_name, product_sku, unit, qty,
          unit_price, discount, tax_rate, tax_amount, line_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const oi of orderItems) {
        insertItem.run(oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_sku, oi.unit, oi.qty, oi.unit_price, oi.discount, oi.tax_rate, oi.tax_amount, oi.line_total, now);
      }

      // Registrar en historial
      dbTx.prepare(`
        INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
        VALUES (?, ?, 'pending', ?, 'Pedido creado', ?)
      `).run(generateId(), orderId, userId, now);

      // Notificar
      notificationService.createNotification(dbTx, userId, 'Pedido creado', `Tu pedido #${orderId.substring(0, 8)} ha sido recibido`, 'order_created', JSON.stringify({ order_id: orderId }));

      return { orderId, total, delivery_fee: deliveryFee, discount, pickup_code: pickupCode };
    });

    // Notificar vía WhatsApp
    whatsappService.sendOrderConfirmation(result.orderId);

    // Notificar admins vía WebSocket
    wsService.sendToAdmins('new_order', { order_id: result.orderId });

    const order = db.prepare(`
      SELECT o.*, u.name as client_name, u.phone as client_phone
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `).get(result.orderId);

    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(result.orderId);

    res.status(201).json({ data: order, message: 'Pedido creado exitosamente' });
  } catch (err) {
    if (err.message.includes('Stock insuficiente') || err.message.includes('Producto no encontrado') || err.message.includes('promoción')) {
      return res.status(422).json({ error: err.message });
    }
    console.error('[ORDERS] Error al crear pedido:', err.message);
    res.status(500).json({ error: 'Error al crear el pedido. Intente nuevamente.' });
  }
});

/**
 * GET /api/orders — Listar pedidos
 * client: propios, admin: todos, worker: asignados
 */
router.get('/', authMiddleware(), (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const role = req.user.role;

  let where = 'WHERE 1=1';
  const params = [];

  if (role === 'client') {
    where += ' AND o.user_id = ?';
    params.push(req.user.id);
  } else if (role === 'worker') {
    where += ' AND o.worker_id = ?';
    params.push(req.user.id);
  }

  if (status) {
    const statuses = status.split(',');
    const placeholders = statuses.map(() => '?').join(',');
    where += ` AND o.status IN (${placeholders})`;
    params.push(...statuses);
  }

  const count = db.prepare(`SELECT COUNT(*) as total FROM orders o ${where}`).get(...params);
  const orders = db.prepare(`
    SELECT o.id, o.status, o.subtotal, o.delivery_fee, o.discount, o.tax_total, o.total,
           o.payment_method, o.payment_status, o.fulfillment_type, o.scheduled_for,
           o.worker_id, o.client_name, o.worker_name, o.created_at, o.updated_at,
           u_w.name as worker_name
    FROM orders o
    LEFT JOIN users u_w ON u_w.id = o.worker_id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    data: orders,
    pagination: { page: Number(page), limit: Number(limit), total: count.total, pages: Math.ceil(count.total / Number(limit)) },
  });
});

/**
 * GET /api/orders/:id — Detalle de pedido con items
 */
router.get('/:id', authMiddleware(), (req, res) => {
  const order = db.prepare(`
    SELECT o.*, u_c.name as client_name, u_c.phone as client_phone,
           u_w.name as worker_name, u_w.phone as worker_phone
    FROM orders o
    LEFT JOIN users u_c ON u_c.id = o.user_id
    LEFT JOIN users u_w ON u_w.id = o.worker_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }

  // Verificar permisos: client solo puede ver sus pedidos
  if (req.user.role === 'client' && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'No tiene permisos para ver este pedido' });
  }

  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

  res.json({ data: order });
});

/**
 * PUT /api/orders/:id/status — Cambiar estado del pedido [admin, worker]
 */
router.put('/:id/status', authMiddleware(['admin', 'worker']), (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'El campo "status" es obligatorio' });

  const validStatuses = Object.keys(VALID_TRANSITIONS);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado no válido. Estados permitidos: ${validStatuses.join(', ')}` });
  }

  try {
    const result = runInTransaction((dbTx) => {
      const order = dbTx.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) throw new Error('Pedido no encontrado');

      // Verificar transición válida
      const allowed = VALID_TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        throw new Error(`No se puede cambiar de "${order.status}" a "${status}". Transiciones permitidas: ${allowed.join(', ')}`);
      }

      const now = nowBogota();

      // Actualizar estado
      dbTx.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id);

      // Si es pickup y cambia a ready, registrar pickup_ready_at
      if (status === 'ready' && order.fulfillment_type === 'pickup') {
        dbTx.prepare('UPDATE orders SET pickup_ready_at = ? WHERE id = ?').run(now, req.params.id);
        whatsappService.sendOrderReadyForPickup(req.params.id, order.pickup_code);
      }

      // Si es in_transit, notificar al cliente
      if (status === 'in_transit') {
        // Obtener nombre del trabajador
        const worker = dbTx.prepare('SELECT name FROM users WHERE id = ?').get(order.worker_id || req.user.id);
        if (worker) {
          dbTx.prepare('UPDATE orders SET worker_name = ? WHERE id = ?').run(worker.name, req.params.id);
          whatsappService.sendOrderOnTheWay(req.params.id, worker.name);
        }
      }

      // Si es delivered, notificar
      if (status === 'delivered') {
        whatsappService.sendOrderDelivered(req.params.id);
      }

      // Registrar en historial
      dbTx.prepare(`
        INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(generateId(), req.params.id, status, req.user.id, null, now);

      return order;
    });

    // Notificar cambio de estado (push + WebSocket)
    notificationService.sendOrderStatusChange(req.params.id, status);

    const updated = db.prepare(`
      SELECT o.*, u_w.name as worker_name
      FROM orders o LEFT JOIN users u_w ON u_w.id = o.worker_id
      WHERE o.id = ?
    `).get(req.params.id);
    updated.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    res.json({ data: updated, message: `Estado del pedido actualizado a "${status}"` });
  } catch (err) {
    if (err.message.includes('Pedido no encontrado')) return res.status(404).json({ error: err.message });
    if (err.message.includes('No se puede cambiar')) return res.status(422).json({ error: err.message });
    throw err;
  }
});

/**
 * POST /api/orders/:id/cancel — Cancelar pedido [client, admin]
 */
router.post('/:id/cancel', authMiddleware(['client', 'admin']), (req, res) => {
  const { reason } = req.body;
  const now = nowBogota();

  try {
    const result = runInTransaction((dbTx) => {
      const order = dbTx.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) throw new Error('Pedido no encontrado');

      // Client solo puede cancelar sus pedidos pendientes/confirmados
      if (req.user.role === 'client' && order.user_id !== req.user.id) {
        throw new Error('No tiene permisos para cancelar este pedido');
      }
      if (req.user.role === 'client' && !['pending', 'confirmed'].includes(order.status)) {
        throw new Error('Solo se pueden cancelar pedidos pendientes o confirmados');
      }

      // Restituir stock
      const items = dbTx.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      for (const item of items) {
        if (item.status !== 'devuelto' && item.qty > 0) {
          inventoryService.registrarMovimiento(dbTx, {
            productId: item.product_id,
            type: 'devolucion',
            qty: item.qty,
            referenceType: 'order',
            referenceId: order.id,
            userId: req.user.id,
            reason: `Cancelación de pedido: ${reason || 'Sin motivo'}`,
          });
        }
      }

      // Actualizar estado
      dbTx.prepare(`
        UPDATE orders SET status = 'cancelled', cancelled_reason = ?, cancelled_by = ?, updated_at = ?
        WHERE id = ?
      `).run(reason || 'Cancelado por el cliente', req.user.id, now, order.id);

      // Historial
      dbTx.prepare(`
        INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
        VALUES (?, ?, 'cancelled', ?, ?, ?)
      `).run(generateId(), order.id, req.user.id, reason || 'Pedido cancelado', now);

      return order;
    });

    notificationService.sendOrderStatusChange(req.params.id, 'cancelled');

    res.json({ message: 'Pedido cancelado exitosamente' });
  } catch (err) {
    if (err.message.includes('Pedido no encontrado') || err.message.includes('permisos') || err.message.includes('Solo se pueden')) {
      return res.status(422).json({ error: err.message });
    }
    throw err;
  }
});

/**
 * POST /api/orders/:id/rate — Calificar pedido [client]
 */
router.post('/:id/rate', authMiddleware(['client']), (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'La calificación debe ser un número entre 1 y 5' });
  }

  const order = db.prepare('SELECT id, user_id, status FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'No puede calificar este pedido' });
  if (order.status !== 'delivered' && order.status !== 'picked_up') {
    return res.status(422).json({ error: 'Solo se pueden calificar pedidos entregados o recogidos' });
  }

  db.prepare('UPDATE orders SET rating = ?, rating_comment = ?, updated_at = ? WHERE id = ?').run(rating, comment || null, nowBogota(), req.params.id);
  res.json({ message: 'Calificación registrada exitosamente' });
});

/**
 * POST /api/orders/:id/assign — Asignar trabajador a pedido [admin]
 */
router.post('/:id/assign', authMiddleware(['admin']), (req, res) => {
  const { worker_id } = req.body;
  if (!worker_id) return res.status(400).json({ error: 'El campo "worker_id" es obligatorio' });

  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!['confirmed', 'preparing', 'ready'].includes(order.status)) {
    return res.status(422).json({ error: 'El pedido debe estar confirmado, preparándose o listo para asignar un trabajador' });
  }

  const worker = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'worker' AND is_active = 1").get(worker_id);
  if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado o inactivo' });

  const now = nowBogota();
  db.prepare(`
    UPDATE orders SET worker_id = ?, worker_name = ?, status = 'assigned', updated_at = ? WHERE id = ?
  `).run(worker_id, worker.name, now, req.params.id);

  // Historial
  db.prepare(`
    INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
    VALUES (?, ?, 'assigned', ?, ?, ?)
  `).run(generateId(), req.params.id, req.user.id, `Trabajador asignado: ${worker.name}`, now);

  notificationService.sendOrderStatusChange(req.params.id, 'assigned');

  res.json({ message: `Trabajador ${worker.name} asignado exitosamente` });
});

/**
 * POST /api/orders/:id/items/:itemId/substitute — Sustituir item [worker]
 */
router.post('/:id/items/:itemId/substitute', authMiddleware(['worker']), (req, res) => {
  const { product_id, qty } = req.body;
  if (!product_id || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Se requiere product_id y qty para la sustitución' });
  }

  try {
    const result = runInTransaction((dbTx) => {
      const order = dbTx.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) throw new Error('Pedido no encontrado');

      const item = dbTx.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(req.params.itemId, req.params.id);
      if (!item) throw new Error('Item del pedido no encontrado');

      // Restituir stock del producto original
      inventoryService.registrarMovimiento(dbTx, {
        productId: item.product_id,
        type: 'devolucion',
        qty: item.qty,
        referenceType: 'order',
        referenceId: order.id,
        userId: req.user.id,
        reason: 'Sustitución de producto en pedido',
      });

      // Descontar stock del producto sustituto
      const newProduct = dbTx.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
      if (!newProduct) throw new Error('Producto sustituto no encontrado');

      inventoryService.registrarMovimiento(dbTx, {
        productId: newProduct.id,
        type: 'venta',
        qty: -Number(qty),
        referenceType: 'order',
        referenceId: order.id,
        userId: req.user.id,
        reason: 'Sustitución en pedido',
      });

      // Actualizar item
      const unitPrice = roundCOP(newProduct.price);
      const lineTotal = roundCOP(unitPrice * Number(qty));

      dbTx.prepare(`
        UPDATE order_items SET product_id = ?, product_name = ?, product_sku = ?,
          qty = ?, unit_price = ?, line_total = ?, status = 'sustituido'
        WHERE id = ?
      `).run(newProduct.id, newProduct.name, newProduct.sku, Number(qty), unitPrice, lineTotal, req.params.itemId);

      // Recalcular total del pedido
      recalcOrderTotal(dbTx, order.id);

      return { message: 'Producto sustituido exitosamente' };
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('no encontrado') || err.message.includes('Stock insuficiente')) {
      return res.status(422).json({ error: err.message });
    }
    throw err;
  }
});

/**
 * POST /api/orders/:id/items/:itemId/missing — Marcar item como faltante [worker]
 */
router.post('/:id/items/:itemId/missing', authMiddleware(['worker']), (req, res) => {
  try {
    const result = runInTransaction((dbTx) => {
      const order = dbTx.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
      if (!order) throw new Error('Pedido no encontrado');

      const item = dbTx.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(req.params.itemId, req.params.id);
      if (!item) throw new Error('Item del pedido no encontrado');

      // Restituir stock
      inventoryService.registrarMovimiento(dbTx, {
        productId: item.product_id,
        type: 'devolucion',
        qty: item.qty,
        referenceType: 'order',
        referenceId: order.id,
        userId: req.user.id,
        reason: 'Producto faltante en inventario',
      });

      // Marcar como faltante y quitar del total
      dbTx.prepare(`
        UPDATE order_items SET status = 'faltante', line_total = 0 WHERE id = ?
      `).run(req.params.itemId);

      // Recalcular total
      recalcOrderTotal(dbTx, order.id);

      return { message: 'Producto marcado como faltante' };
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('no encontrado')) return res.status(422).json({ error: err.message });
    throw err;
  }
});

/**
 * POST /api/orders/:id/pickup-confirm — Confirmar recogida por código [worker]
 */
router.post('/:id/pickup-confirm', authMiddleware(['worker']), (req, res) => {
  const { pickup_code } = req.body;
  if (!pickup_code) return res.status(400).json({ error: 'El código de recogida es obligatorio' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.fulfillment_type !== 'pickup') return res.status(422).json({ error: 'Este pedido no es de tipo recogida' });
  if (order.pickup_code !== pickup_code.toUpperCase()) return res.status(422).json({ error: 'Código de recogida incorrecto' });

  const now = nowBogota();
  db.prepare("UPDATE orders SET status = 'picked_up', updated_at = ? WHERE id = ?").run(now, req.params.id);

  db.prepare(`
    INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
    VALUES (?, ?, 'picked_up', ?, 'Recogida confirmada con código', ?)
  `).run(generateId(), req.params.id, req.user.id, now);

  notificationService.sendOrderStatusChange(req.params.id, 'picked_up');

  res.json({ message: 'Recogida confirmada exitosamente' });
});

/**
 * GET /api/orders/:id/history — Historial de cambios de estado [admin, owner]
 */
router.get('/:id/history', authMiddleware(), (req, res) => {
  const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  // Solo admin o dueño del pedido
  if (req.user.role !== 'admin' && req.user.id !== order.user_id) {
    return res.status(403).json({ error: 'No tiene permisos para ver el historial de este pedido' });
  }

  const history = db.prepare(`
    SELECT oh.*, u.name as changed_by_name
    FROM order_history oh
    LEFT JOIN users u ON u.id = oh.changed_by
    WHERE oh.order_id = ?
    ORDER BY oh.created_at ASC
  `).all(req.params.id);

  res.json({ data: history });
});

// ─── Helper: recalcular total de pedido ──────────────────────
function recalcOrderTotal(dbTx, orderId) {
  const items = dbTx.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    subtotal += item.line_total;
    taxTotal += item.tax_amount;
  }
  subtotal = roundCOP(subtotal);
  taxTotal = roundCOP(taxTotal);

  const order = dbTx.prepare('SELECT delivery_fee, discount FROM orders WHERE id = ?').get(orderId);
  const total = roundCOP(subtotal - (order.discount || 0) + taxTotal + (order.delivery_fee || 0));

  dbTx.prepare('UPDATE orders SET subtotal = ?, tax_total = ?, total = ?, updated_at = ? WHERE id = ?').run(subtotal, taxTotal, total, nowBogota(), orderId);
}

module.exports = router;
