// src/routes/inventory.js — Rutas de gestión de inventario [admin]
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const inventoryService = require('../services/inventory.service');

const router = Router();

/**
 * GET /api/inventory/movements — Listar movimientos [admin]
 */
router.get('/movements', authMiddleware(['admin']), (req, res) => {
  const { product_id, type, from, to, page = 1, limit = 20 } = req.query;
  const result = inventoryService.getMovements(db, { product_id, type, from, to, page, limit });
  res.json(result);
});

/**
 * POST /api/inventory/adjust — Ajustar stock manualmente [admin]
 */
router.post('/adjust', authMiddleware(['admin']), (req, res) => {
  const { product_id, qty, reason } = req.body;
  if (!product_id || qty === undefined || qty === null) {
    return res.status(400).json({ error: 'Se requieren product_id y qty para el ajuste' });
  }

  try {
    const result = runInTransaction((dbTx) => {
      return inventoryService.adjustStock(dbTx, product_id, qty, reason, req.user.id);
    });
    res.json({ data: result, message: 'Ajuste de inventario registrado exitosamente' });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/count — Conteo físico de inventario [admin]
 */
router.post('/count', authMiddleware(['admin']), (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de items con product_id y counted' });
  }

  try {
    const result = runInTransaction((dbTx) => {
      return inventoryService.physicalCount(dbTx, items, req.user.id);
    });
    res.json({ data: result, message: 'Conteo físico procesado exitosamente' });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/low-stock — Productos con stock bajo [admin]
 */
router.get('/low-stock', authMiddleware(['admin']), (req, res) => {
  const data = inventoryService.getLowStock(db);
  res.json({ data });
});

/**
 * GET /api/inventory/expiring — Productos próximos a vencer [admin]
 */
router.get('/expiring', authMiddleware(['admin']), (req, res) => {
  const days = Number(req.query.days) || 30;
  const data = inventoryService.getExpiring(db, days);
  res.json({ data });
});

/**
 * GET /api/inventory/kardex/:product_id — Kardex de producto [admin]
 */
router.get('/kardex/:product_id', authMiddleware(['admin']), (req, res) => {
  const { from, to } = req.query;
  const data = inventoryService.getKardex(db, req.params.product_id, from, to);
  res.json({ data });
});

/**
 * GET /api/inventory/valuation — Valorización del inventario [admin]
 */
router.get('/valuation', authMiddleware(['admin']), (req, res) => {
  const data = inventoryService.getValuation(db);
  res.json({ data });
});

module.exports = router;
