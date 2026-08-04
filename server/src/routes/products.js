// src/routes/products.js — Rutas de productos (CRUD + búsqueda)
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const config = require('../config');

const router = Router();

/**
 * GET /api/products — Listar productos con paginación y filtros
 * Público: no requiere autenticación
 */
router.get('/', (req, res) => {
  const { category_id, search, offer, min_price, max_price, page = 1, limit = 30 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'WHERE p.is_active = 1';
  const params = [];

  if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
  if (search) { where += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (offer === 'true' || offer === '1') { where += ' AND p.is_offer = 1 AND p.offer_price IS NOT NULL'; }
  if (min_price) { where += ' AND p.price >= ?'; params.push(Number(min_price)); }
  if (max_price) { where += ' AND p.price <= ?'; params.push(Number(max_price)); }

  const count = db.prepare(`SELECT COUNT(*) as total FROM products p ${where}`).get(...params);

  const products = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.compare_price, p.stock, p.unit,
           p.sku, p.barcode, p.category_id, p.image, p.is_offer, p.offer_price, p.brand,
           p.is_weighed, p.tax_rate, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    data: products,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: count.total,
      pages: Math.ceil(count.total / Number(limit)),
    },
  });
});

/**
 * GET /api/products/:id — Obtener producto por ID
 */
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  res.json({ data: product });
});

/**
 * POST /api/products — Crear producto [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const { name, description, price, cost, compare_price, stock, stock_min, stock_max,
    sku, barcode, category_id, image, unit, tax_rate, is_weighed,
    is_offer, offer_price, brand, expiry_date, supplier_id } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
  }

  const now = nowBogota();
  const id = generateId();

  try {
    db.prepare(`
      INSERT INTO products (
        id, name, description, price, cost, compare_price, stock, stock_min, stock_max,
        sku, barcode, category_id, image, unit, tax_rate, is_weighed,
        is_offer, offer_price, brand, expiry_date, supplier_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description || '', roundCOP(price), roundCOP(cost || 0), roundCOP(compare_price || 0),
      stock || 0, stock_min || 0, stock_max || null,
      sku || null, barcode || null, category_id || null, image || null, unit || 'un',
      tax_rate || 0, is_weighed ? 1 : 0,
      is_offer ? 1 : 0, offer_price ? roundCOP(offer_price) : null, brand || null,
      expiry_date || null, supplier_id || null, now, now
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.status(201).json({ data: product, message: 'Producto creado exitosamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    throw err;
  }
});

/**
 * PUT /api/products/:id — Actualizar producto [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  const fields = [
    'name', 'description', 'price', 'cost', 'compare_price', 'stock', 'stock_min', 'stock_max',
    'sku', 'barcode', 'category_id', 'image', 'unit', 'tax_rate', 'is_weighed',
    'is_offer', 'offer_price', 'brand', 'expiry_date', 'supplier_id', 'is_active',
  ];

  const sets = [];
  const values = [];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(
        ['price', 'cost', 'compare_price', 'offer_price'].includes(field)
          ? roundCOP(req.body[field])
          : req.body[field]
      );
    }
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  sets.push("updated_at = ?");
  values.push(nowBogota());
  values.push(req.params.id);

  try {
    db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ data: updated, message: 'Producto actualizado exitosamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' });
    }
    throw err;
  }
});

/**
 * DELETE /api/products/:id — Desactivar producto [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  db.prepare("UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?").run(nowBogota(), req.params.id);
  res.json({ message: 'Producto desactivado exitosamente' });
});

/**
 * GET /api/products/search — Búsqueda rápida de productos
 */
router.get('/search', (req, res) => {
  const { q, category, min, max, offer } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'El parámetro "q" es obligatorio para la búsqueda' });
  }

  let where = 'WHERE p.is_active = 1 AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
  const params = [`%${q}%`, `%${q}%`, `%${q}%`];

  if (category) { where += ' AND p.category_id = ?'; params.push(category); }
  if (min) { where += ' AND p.price >= ?'; params.push(Number(min)); }
  if (max) { where += ' AND p.price <= ?'; params.push(Number(max)); }
  if (offer === 'true' || offer === '1') { where += ' AND p.is_offer = 1'; }

  const products = db.prepare(`
    SELECT p.id, p.name, p.description, p.price, p.stock, p.unit, p.image, p.is_offer, p.offer_price, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where}
    ORDER BY p.name ASC
    LIMIT 50
  `).all(...params);

  res.json({ data: products });
});

/**
 * GET /api/products/barcode/:code — Buscar producto por código de barras [admin, worker]
 */
router.get('/barcode/:code', authMiddleware(['admin', 'worker']), (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.barcode = ?
  `).get(req.params.code);

  if (!product) {
    return res.status(404).json({ error: 'No se encontró ningún producto con ese código de barras' });
  }

  res.json({ data: product });
});

module.exports = router;
