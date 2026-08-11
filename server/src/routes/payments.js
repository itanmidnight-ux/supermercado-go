// src/routes/payments.js — Rutas de pagos
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware, apiAuth } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/payments/create-intent — Crear intención de pago [client]
 */
router.post('/create-intent', authMiddleware(['client']), (req, res) => {
  const { order_id, method } = req.body;
  if (!order_id || !method) {
    return res.status(400).json({ error: 'Los campos order_id y method son obligatorios' });
  }

  const validMethods = ['efectivo', 'nequi', 'daviplata', 'tarjeta', 'pse', 'bold'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: `Método de pago no válido. Métodos permitidos: ${validMethods.join(', ')}` });
  }

  const order = db.prepare('SELECT id, total, payment_status, user_id FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'No tiene permisos sobre este pedido' });
  if (order.payment_status === 'aprobado') return res.status(422).json({ error: 'Este pedido ya tiene un pago aprobado' });

  const paymentId = generateId();
  const now = nowBogota();

  // Insertar registro de pago
  db.prepare(`
    INSERT INTO payments (id, order_id, method, amount, status, created_at)
    VALUES (?, ?, ?, ?, 'pendiente', ?)
  `).run(paymentId, order_id, method, order.total, now);

  // Si es efectivo, aprobar inmediatamente
  if (method === 'efectivo') {
    db.prepare("UPDATE payments SET status = 'aprobado' WHERE id = ?").run(paymentId);
    db.prepare("UPDATE orders SET payment_method = ?, payment_status = 'pagado', updated_at = ? WHERE id = ?").run(method, now, order_id);
    return res.json({
      data: { payment_id: paymentId, status: 'aprobado', message: 'Pago en efectivo registrado. Se cobrará al entregar.' },
    });
  }

  // Para métodos electrónicos, simular respuesta de proveedor
  // En producción se integraría con Bold, Wompi, etc.
  res.json({
    data: {
      payment_id: paymentId,
      status: 'pendiente',
      amount: order.total,
      method,
      message: 'Intención de pago creada. Procesando...',
      // En producción se retornaría la URL de redirección del proveedor
    },
  });
});

/**
 * POST /api/payments/webhook — Webhook de proveedor de pagos (API Key)
 */
router.post('/webhook', apiAuth, (req, res) => {
  const { payment_id, status, provider_ref, raw_response } = req.body;

  if (!payment_id || !status) {
    return res.status(400).json({ error: 'Los campos payment_id y status son obligatorios' });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment_id);
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });

  const validStatuses = ['pendiente', 'aprobado', 'rechazado', 'reembolsado'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado de pago no válido' });
  }

  const now = nowBogota();
  db.prepare(`
    UPDATE payments SET status = ?, provider_ref = COALESCE(?, provider_ref), raw_response = COALESCE(?, raw_response)
    WHERE id = ?
  `).run(status, provider_ref, raw_response ? JSON.stringify(raw_response) : null, payment_id);

  // Actualizar estado del pedido
  if (status === 'aprobado') {
    db.prepare("UPDATE orders SET payment_status = 'pagado', payment_method = ?, updated_at = ? WHERE id = ?").run(payment.method, now, payment.order_id);
  } else if (status === 'rechazado') {
    db.prepare("UPDATE orders SET payment_status = 'rechazado', updated_at = ? WHERE id = ?").run(now, payment.order_id);
  } else if (status === 'reembolsado') {
    db.prepare("UPDATE orders SET payment_status = 'reembolsado', updated_at = ? WHERE id = ?").run(now, payment.order_id);
  }

  res.json({ message: 'Webhook procesado exitosamente' });
});

/**
 * GET /api/payments/order/:order_id — Obtener pagos de un pedido [client, admin]
 */
router.get('/order/:order_id', authMiddleware(['client', 'admin']), (req, res) => {
  const order = db.prepare('SELECT id, user_id FROM orders WHERE id = ?').get(req.params.order_id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  if (req.user.role === 'client' && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'No tiene permisos para ver los pagos de este pedido' });
  }

  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC').all(req.params.order_id);
  res.json({ data: payments });
});

module.exports = router;
