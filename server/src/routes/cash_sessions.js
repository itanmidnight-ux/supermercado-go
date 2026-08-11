// src/routes/cash_sessions.js — Rutas de sesiones de caja [admin, worker]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/cash-sessions/open — Abrir sesión de caja [admin, worker]
 */
router.post('/open', authMiddleware(['admin', 'worker']), (req, res) => {
  const { opening_amount } = req.body;

  // Verificar si hay sesión abierta
  const openSession = db.prepare(`
    SELECT id FROM cash_sessions WHERE user_id = ? AND closed_at IS NULL
  `).get(req.user.id);

  if (openSession) {
    return res.status(422).json({ error: 'Ya tiene una sesión de caja abierta. Ciérrela antes de abrir otra.' });
  }

  const id = generateId();
  const now = nowBogota();

  db.prepare(`
    INSERT INTO cash_sessions (id, user_id, opened_at, opening_amount)
    VALUES (?, ?, ?, ?)
  `).run(id, req.user.id, now, roundCOP(opening_amount || 0));

  const session = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(id);
  res.status(201).json({ data: session, message: 'Sesión de caja abierta exitosamente' });
});

/**
 * POST /api/cash-sessions/close — Cerrar sesión de caja [admin, worker]
 */
router.post('/close', authMiddleware(['admin', 'worker']), (req, res) => {
  const { counted_amount, notes } = req.body;

  const session = db.prepare(`
    SELECT * FROM cash_sessions WHERE user_id = ? AND closed_at IS NULL
  `).get(req.user.id);

  if (!session) {
    return res.status(422).json({ error: 'No tiene una sesión de caja abierta' });
  }

  const now = nowBogota();
  const counted = roundCOP(counted_amount || 0);

  // Calcular monto esperado
  const payments = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.method = 'efectivo'
      AND p.status = 'aprobado'
      AND o.worker_id = ?
      AND p.created_at >= ?
  `).get(req.user.id, session.opened_at);

  const expected = roundCOP(session.opening_amount + payments.total);
  const difference = roundCOP(counted - expected);

  db.prepare(`
    UPDATE cash_sessions
    SET closed_at = ?, counted_amount = ?, expected_amount = ?, difference = ?, notes = ?
    WHERE id = ?
  `).run(now, counted, expected, difference, notes || null, session.id);

  const updated = db.prepare('SELECT * FROM cash_sessions WHERE id = ?').get(session.id);
  res.json({ data: updated, message: 'Sesión de caja cerrada exitosamente' });
});

/**
 * GET /api/cash-sessions — Listar sesiones de caja [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const { user_id, status } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (user_id) { where += ' AND cs.user_id = ?'; params.push(user_id); }
  if (status === 'open') { where += ' AND cs.closed_at IS NULL'; }
  else if (status === 'closed') { where += ' AND cs.closed_at IS NOT NULL'; }

  const sessions = db.prepare(`
    SELECT cs.*, u.name as user_name
    FROM cash_sessions cs
    LEFT JOIN users u ON u.id = cs.user_id
    ${where}
    ORDER BY cs.opened_at DESC
    LIMIT 100
  `).all(...params);

  res.json({ data: sessions });
});

module.exports = router;
