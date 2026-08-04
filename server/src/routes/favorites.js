// src/routes/favorites.js — Rutas de favoritos [client]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/favorites — Listar favoritos del usuario [client]
 */
router.get('/', authMiddleware(['client']), (req, res) => {
  const favorites = db.prepare(`
    SELECT f.id, f.created_at, p.id as product_id, p.name, p.description, p.price,
      p.compare_price, p.offer_price, p.is_offer, p.image, p.unit, p.stock, p.brand,
      p.is_active, p.is_weighed, p.category_id
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.json({ data: favorites });
});

/**
 * POST /api/favorites/:productId — Agregar a favoritos [client]
 */
router.post('/:productId', authMiddleware(['client']), (req, res) => {
  const { productId } = req.params;

  // Verificar que el producto existe
  const product = db.prepare('SELECT id FROM products WHERE id = ? AND is_active = 1').get(productId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user.id, productId);
  if (existing) return res.status(200).json({ message: 'Ya está en favoritos' });

  const id = generateId();
  const now = nowBogota();

  try {
    db.prepare('INSERT INTO favorites (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?)')
      .run(id, req.user.id, productId, now);
    res.status(201).json({ message: 'Agregado a favoritos' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(200).json({ message: 'Ya está en favoritos' });
    }
    throw err;
  }
});

/**
 * DELETE /api/favorites/:productId — Quitar de favoritos [client]
 */
router.delete('/:productId', authMiddleware(['client']), (req, res) => {
  const result = db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?')
    .run(req.user.id, req.params.productId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Favorito no encontrado' });
  }
  res.json({ message: 'Eliminado de favoritos' });
});

module.exports = router;
