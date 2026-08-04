// src/routes/notifications.js — Rutas de notificaciones [client]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/notifications — Listar notificaciones [client]
 */
router.get('/', authMiddleware(), (req, res) => {
  const { unread } = req.query;

  let where = 'WHERE n.user_id = ?';
  const params = [req.user.id];

  if (unread === 'true' || unread === '1') {
    where += ' AND n.read_at IS NULL';
  }

  const notifications = db.prepare(`
    SELECT n.* FROM notifications n
    ${where}
    ORDER BY n.created_at DESC
    LIMIT 50
  `).all(...params);

  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id);

  res.json({ data: notifications, unread_count: unreadCount.count });
});

/**
 * POST /api/notifications/:id/read — Marcar notificación como leída [client]
 */
router.post('/:id/read', authMiddleware(), (req, res) => {
  const notification = db.prepare('SELECT id, user_id FROM notifications WHERE id = ?').get(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notificación no encontrada' });
  if (notification.user_id !== req.user.id) return res.status(403).json({ error: 'No tiene permisos sobre esta notificación' });

  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(nowBogota(), req.params.id);
  res.json({ message: 'Notificación marcada como leída' });
});

module.exports = router;
