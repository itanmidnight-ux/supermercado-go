// src/routes/addresses.js — Rutas de direcciones de clientes [client]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/addresses — Listar direcciones del usuario [client]
 */
router.get('/', authMiddleware(['client']), (req, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);
  res.json({ data: addresses });
});

/**
 * POST /api/addresses — Crear dirección [client]
 */
router.post('/', authMiddleware(['client']), (req, res) => {
  const { label, address, detail, neighborhood, city, lat, lng, is_default } = req.body;
  if (!address) return res.status(400).json({ error: 'La dirección es obligatoria' });

  const id = generateId();
  const now = nowBogota();

  // Si es la primera dirección o se marca como default, quitar default a otras
  if (is_default) {
    db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  }

  db.prepare(`
    INSERT INTO addresses (id, user_id, label, address, detail, neighborhood, city, lat, lng, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, label || null, address, detail || null, neighborhood || null, city || 'Cúcuta', lat || null, lng || null, is_default ? 1 : 0, now);

  const addr = db.prepare('SELECT * FROM addresses WHERE id = ?').get(id);
  res.status(201).json({ data: addr, message: 'Dirección creada exitosamente' });
});

/**
 * PUT /api/addresses/:id — Actualizar dirección [client]
 */
router.put('/:id', authMiddleware(['client']), (req, res) => {
  const addr = db.prepare('SELECT id, user_id FROM addresses WHERE id = ?').get(req.params.id);
  if (!addr) return res.status(404).json({ error: 'Dirección no encontrada' });
  if (addr.user_id !== req.user.id) return res.status(403).json({ error: 'No tiene permisos sobre esta dirección' });

  const fields = ['label', 'address', 'detail', 'neighborhood', 'city', 'lat', 'lng', 'is_default'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });

  values.push(req.params.id);
  db.prepare(`UPDATE addresses SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM addresses WHERE id = ?').get(req.params.id);
  res.json({ data: updated, message: 'Dirección actualizada exitosamente' });
});

/**
 * DELETE /api/addresses/:id — Eliminar dirección [client]
 */
router.delete('/:id', authMiddleware(['client']), (req, res) => {
  const addr = db.prepare('SELECT id, user_id FROM addresses WHERE id = ?').get(req.params.id);
  if (!addr) return res.status(404).json({ error: 'Dirección no encontrada' });
  if (addr.user_id !== req.user.id) return res.status(403).json({ error: 'No tiene permisos sobre esta dirección' });

  db.prepare('DELETE FROM addresses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Dirección eliminada exitosamente' });
});

module.exports = router;
