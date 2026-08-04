// src/routes/categories.js — Rutas de categorías (CRUD)
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/categories — Listar categorías activas
 * Público
 */
router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) as product_count
    FROM categories c
    WHERE c.is_active = 1
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();

  res.json({ data: categories });
});

/**
 * POST /api/categories — Crear categoría [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const { name, description, image, sort_order } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
  }

  const id = generateId();
  const now = nowBogota();

  db.prepare(`
    INSERT INTO categories (id, name, description, image, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description || '', image || null, sort_order || 0, now);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json({ data: category, message: 'Categoría creada exitosamente' });
});

/**
 * PUT /api/categories/:id — Actualizar categoría [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  const { name, description, image, sort_order, is_active } = req.body;
  const now = nowBogota();

  db.prepare(`
    UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description),
      image = COALESCE(?, image), sort_order = COALESCE(?, sort_order),
      is_active = CASE WHEN ? IS NOT NULL THEN ? ELSE is_active END
    WHERE id = ?
  `).run(name, description, image, sort_order != null ? sort_order : null, is_active, is_active, req.params.id);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ data: updated, message: 'Categoría actualizada exitosamente' });
});

/**
 * DELETE /api/categories/:id — Desactivar categoría [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!category) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  // Verificar si hay productos activos en esta categoría
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND is_active = 1').get(req.params.id);
  if (productCount.count > 0) {
    return res.status(409).json({ error: 'No se puede desactivar la categoría porque tiene productos activos asociados' });
  }

  db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Categoría desactivada exitosamente' });
});

module.exports = router;
