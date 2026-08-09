// src/routes/worker-location.js — Endpoints de ubicación del trabajador
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// POST /api/worker-location — Guardar ubicación del worker
router.post('/', authMiddleware(['worker']), (req, res) => {
  try {
    const db = getDb();
    const { order_id, lat, lng } = req.body;
    const worker_id = req.user.id;

    if (!order_id || !lat || !lng) {
      return res.status(400).json({ error: 'order_id, lat y lng son requeridos' });
    }

    // Guardar en tabla de historial
    db.prepare(`
      INSERT INTO worker_locations (worker_id, order_id, lat, lng, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(worker_id, order_id, lat, lng);

    // Actualizar ubicación actual en la orden
    db.prepare(`
      UPDATE orders SET worker_lat = ?, worker_lng = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(lat, lng, order_id);

    res.json({ ok: true });
  } catch (err) {
    console.error('[WORKER-LOCATION] Error:', err.message);
    res.status(500).json({ error: 'Error al guardar ubicación' });
  }
});

// GET /api/worker-location/:orderId — Obtener ubicación actual del worker para una orden
router.get('/:orderId', authMiddleware(['admin', 'client', 'worker']), (req, res) => {
  try {
    const db = getDb();
    const { orderId } = req.params;

    const order = db.prepare(`
      SELECT worker_lat, worker_lng, worker_id, status, assigned_to
      FROM orders WHERE id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Obtener nombre del worker
    let workerName = null;
    if (order.worker_id || order.assigned_to) {
      const workerId = order.worker_id || order.assigned_to;
      const worker = db.prepare('SELECT name, phone FROM users WHERE id = ?').get(workerId);
      if (worker) {
        workerName = worker.name;
      }
    }

    res.json({
      data: {
        lat: order.worker_lat,
        lng: order.worker_lng,
        worker_name: workerName,
        status: order.status,
        is_delivering: order.status === 'delivering' || order.status === 'in_transit',
      }
    });
  } catch (err) {
    console.error('[WORKER-LOCATION] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener ubicación' });
  }
});

// GET /api/worker-location/history/:orderId — Historial de ubicaciones
router.get('/history/:orderId', authMiddleware(['admin']), (req, res) => {
  try {
    const db = getDb();
    const { orderId } = req.params;

    const locations = db.prepare(`
      SELECT wl.*, u.name as worker_name
      FROM worker_locations wl
      LEFT JOIN users u ON wl.worker_id = u.id
      WHERE wl.order_id = ?
      ORDER BY wl.created_at ASC
    `).all(orderId);

    res.json({ data: locations });
  } catch (err) {
    console.error('[WORKER-LOCATION] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// POST /api/worker-location/save-customer — Guardar ubicación del cliente
router.post('/save-customer', authMiddleware(['client']), (req, res) => {
  try {
    const db = getDb();
    const { order_id, lat, lng } = req.body;

    if (!order_id || !lat || !lng) {
      return res.status(400).json({ error: 'order_id, lat y lng son requeridos' });
    }

    db.prepare(`
      UPDATE orders SET customer_lat = ?, customer_lng = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(lat, lng, order_id, req.user.id);

    res.json({ ok: true });
  } catch (err) {
    console.error('[WORKER-LOCATION] Error:', err.message);
    res.status(500).json({ error: 'Error al guardar ubicación del cliente' });
  }
});

module.exports = router;
