// src/routes/suppliers.js — Rutas de proveedores CRUD [admin]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/suppliers — Listar proveedores [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC').all();
  res.json({ data: suppliers });
});

/**
 * POST /api/suppliers — Crear proveedor [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const { name, nit, contact_name, phone, email, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });

  const id = generateId();
  const now = nowBogota();

  db.prepare(`
    INSERT INTO suppliers (id, name, nit, contact_name, phone, email, address, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, nit || null, contact_name || null, phone || null, email || null, address || null, notes || null, now);

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  res.status(201).json({ data: supplier, message: 'Proveedor creado exitosamente' });
});

/**
 * GET /api/suppliers/:id — Obtener proveedor [admin]
 */
router.get('/:id', authMiddleware(['admin']), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json({ data: supplier });
});

/**
 * PUT /api/suppliers/:id — Actualizar proveedor [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const fields = ['name', 'nit', 'contact_name', 'phone', 'email', 'address', 'notes', 'is_active'];
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
  db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  res.json({ data: updated, message: 'Proveedor actualizado exitosamente' });
});

/**
 * DELETE /api/suppliers/:id — Desactivar proveedor [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const supplier = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

  db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Proveedor desactivado exitosamente' });
});

module.exports = router;
