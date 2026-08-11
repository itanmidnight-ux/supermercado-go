// src/routes/purchases.js — Rutas de compras a proveedores [admin]
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const inventoryService = require('../services/inventory.service');

const router = Router();

/**
 * GET /api/purchases — Listar compras [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const purchases = db.prepare(`
    SELECT p.*, s.name as supplier_name, u.name as user_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `).all();

  // Adjuntar items
  for (const purchase of purchases) {
    purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').get(purchase.id);
  }

  res.json({ data: purchases });
});

/**
 * POST /api/purchases — Crear compra [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const { supplier_id, invoice_number, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La compra debe contener al menos un producto' });
  }

  try {
    const result = runInTransaction((dbTx) => {
      const now = nowBogota();
      const purchaseId = generateId();

      let subtotal = 0;
      for (const item of items) {
        const qty = Number(item.qty) || 1;
        const unitCost = roundCOP(item.unit_cost || 0);
        const lineTotal = roundCOP(unitCost * qty);
        subtotal += lineTotal;
      }
      subtotal = roundCOP(subtotal);
      const taxTotal = 0;
      const total = roundCOP(subtotal + taxTotal);

      dbTx.prepare(`
        INSERT INTO purchases (id, supplier_id, invoice_number, subtotal, tax_total, total, status, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
      `).run(purchaseId, supplier_id || null, invoice_number || null, subtotal, taxTotal, total, req.user.id, now);

      for (const item of items) {
        const qty = Number(item.qty) || 1;
        const unitCost = roundCOP(item.unit_cost || 0);
        const lineTotal = roundCOP(unitCost * qty);

        dbTx.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, qty, unit_cost, line_total)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateId(), purchaseId, item.product_id, qty, unitCost, lineTotal);
      }

      return { purchase_id: purchaseId, total };
    });

    res.status(201).json({ data: result, message: 'Compra registrada exitosamente' });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * GET /api/purchases/:id — Detalle de compra [admin]
 */
router.get('/:id', authMiddleware(['admin']), (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, s.name as supplier_name, u.name as user_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!purchase) return res.status(404).json({ error: 'Compra no encontrada' });
  purchase.items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);

  res.json({ data: purchase });
});

/**
 * PUT /api/purchases/:id — Actualizar compra [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const purchase = db.prepare('SELECT id FROM purchases WHERE id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Compra no encontrada' });

  const fields = ['supplier_id', 'invoice_number', 'status'];
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
  db.prepare(`UPDATE purchases SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  res.json({ message: 'Compra actualizada exitosamente' });
});

/**
 * DELETE /api/purchases/:id — Anular compra [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND status = ?').get(req.params.id, 'pendiente');
  if (!purchase) return res.status(404).json({ error: 'Compra no encontrada o ya procesada' });

  db.prepare("UPDATE purchases SET status = 'anulada' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Compra anulada exitosamente' });
});

/**
 * POST /api/purchases/:id/receive — Recibir compra y agregar stock [admin]
 */
router.post('/:id/receive', authMiddleware(['admin']), (req, res) => {
  try {
    const result = runInTransaction((dbTx) => {
      const purchase = dbTx.prepare('SELECT * FROM purchases WHERE id = ? AND status = ?').get(req.params.id, 'pendiente');
      if (!purchase) throw new Error('Compra no encontrada o ya fue recibida/anulada');

      const items = dbTx.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
      const now = nowBogota();

      for (const item of items) {
        // Registrar entrada de inventario
        inventoryService.registrarMovimiento(dbTx, {
          productId: item.product_id,
          type: 'compra',
          qty: item.qty,
          unitCost: item.unit_cost,
          referenceType: 'purchase',
          referenceId: purchase.id,
          userId: req.user.id,
          reason: `Compra: ${purchase.invoice_number || purchase.id}`,
        });
      }

      dbTx.prepare("UPDATE purchases SET status = 'recibida', received_at = ? WHERE id = ?").run(now, purchase.id);

      return { message: 'Compra recibida exitosamente. Stock actualizado.' };
    });

    res.json(result);
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

module.exports = router;
