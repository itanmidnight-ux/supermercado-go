// src/routes/promotions.js — Rutas de promociones
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * POST /api/promotions/validate — Validar código de promoción [client]
 */
router.post('/validate', authMiddleware(['client']), (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'El código de promoción es obligatorio' });

  const promo = db.prepare('SELECT * FROM promotions WHERE code = ? AND is_active = 1').get(code);
  if (!promo) return res.status(404).json({ error: 'El código de promoción no es válido' });

  const nowIso = new Date().toISOString();
  if (promo.starts_at && promo.starts_at > nowIso) {
    return res.status(422).json({ error: 'La promoción aún no ha comenzado' });
  }
  if (promo.ends_at && promo.ends_at < nowIso) {
    return res.status(422).json({ error: 'La promoción ya ha expirado' });
  }
  if (promo.min_order && subtotal < promo.min_order) {
    return res.status(422).json({ error: `El pedido mínimo para esta promoción es $${promo.min_order.toLocaleString('es-CO')}` });
  }
  if (promo.max_uses && promo.uses >= promo.max_uses) {
    return res.status(422).json({ error: 'La promoción ya agotó sus usos disponibles' });
  }

  // Calcular descuento
  let discount = 0;
  let description = '';
  switch (promo.type) {
    case 'porcentaje':
      discount = roundCOP((subtotal || 0) * (promo.value / 100));
      description = `${promo.value}% de descuento`;
      break;
    case 'monto_fijo':
      discount = roundCOP(promo.value);
      description = `$${promo.value.toLocaleString('es-CO')} de descuento`;
      break;
    case 'envio_gratis':
      discount = 0;
      description = 'Envío gratis';
      break;
    case '2x1':
      description = 'Promoción 2x1 (aplica en el checkout)';
      break;
  }

  res.json({
    data: {
      id: promo.id,
      name: promo.name,
      type: promo.type,
      description,
      discount,
      discount_applied: discount,
    },
  });
});

/**
 * GET /api/promotions — Listar promociones [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const promotions = db.prepare('SELECT * FROM promotions ORDER BY created_at DESC').all();
  res.json({ data: promotions });
});

/**
 * POST /api/promotions — Crear promoción [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const { code, name, type, value, min_order, max_uses, starts_at, ends_at } = req.body;
  if (!code || !name || !type || value === undefined) {
    return res.status(400).json({ error: 'Los campos code, name, type y value son obligatorios' });
  }

  const validTypes = ['porcentaje', 'monto_fijo', 'envio_gratis', '2x1'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo no válido. Permitidos: ${validTypes.join(', ')}` });
  }

  const id = generateId();
  const now = nowBogota();

  try {
    db.prepare(`
      INSERT INTO promotions (id, code, name, type, value, min_order, max_uses, starts_at, ends_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code.toUpperCase().trim(), name, type, value, min_order || 0, max_uses || null, starts_at || null, ends_at || null, now);

    const promo = db.prepare('SELECT * FROM promotions WHERE id = ?').get(id);
    res.status(201).json({ data: promo, message: 'Promoción creada exitosamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una promoción con ese código' });
    }
    throw err;
  }
});

/**
 * PUT /api/promotions/:id — Actualizar promoción [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const promo = db.prepare('SELECT id FROM promotions WHERE id = ?').get(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });

  const fields = ['name', 'type', 'value', 'min_order', 'max_uses', 'starts_at', 'ends_at', 'is_active'];
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
  db.prepare(`UPDATE promotions SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
  res.json({ data: updated, message: 'Promoción actualizada exitosamente' });
});

/**
 * DELETE /api/promotions/:id — Desactivar promoción [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const promo = db.prepare('SELECT id FROM promotions WHERE id = ?').get(req.params.id);
  if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });

  db.prepare('UPDATE promotions SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Promoción desactivada exitosamente' });
});

module.exports = router;
