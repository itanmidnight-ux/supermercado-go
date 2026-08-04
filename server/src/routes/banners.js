// src/routes/banners.js — CRUD de banners para el carrusel de la app
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/banners — Listar banners activos (público)
 * Los clientes usan este endpoint para el carrusel.
 * Admin puede ver todos con ?all=1
 */
router.get('/', (req, res) => {
  const db = require('../db').getDb();
  const isAdmin = req.query.all === '1';

  let query = 'SELECT * FROM banners';
  if (!isAdmin) {
    query += " WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= datetime('now','localtime')) AND (ends_at IS NULL OR ends_at >= datetime('now','localtime'))";
  }
  query += ' ORDER BY sort_order ASC';

  const banners = db.prepare(query).all();
  res.json({ banners });
});

/**
 * GET /api/banners/:id — Obtener un banner
 */
router.get('/:id', (req, res) => {
  const db = require('../db').getDb();
  const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!banner) return res.status(404).json({ error: 'Banner no encontrado' });
  res.json({ banner });
});

/**
 * POST /api/banners — Crear banner [admin]
 */
router.post('/', authMiddleware(['admin']), (req, res) => {
  const db = require('../db').getDb();
  const { title, subtitle, image_url, link_type, link_value, bg_color, text_color, sort_order, is_active, starts_at, ends_at } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO banners (id, title, subtitle, image_url, link_type, link_value, bg_color, text_color, sort_order, is_active, starts_at, ends_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, title?.trim(), subtitle?.trim() || null, image_url || null,
    link_type || 'none', link_value || null,
    bg_color || '#00B860', text_color || '#FFFFFF',
    sort_order ?? 0, is_active !== undefined ? (is_active ? 1 : 0) : 1,
    starts_at || null, ends_at || null, now, now
  );

  const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(id);
  res.status(201).json({ banner });
});

/**
 * PUT /api/banners/:id — Actualizar banner [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const db = require('../db').getDb();
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner no encontrado' });

  const { title, subtitle, image_url, link_type, link_value, bg_color, text_color, sort_order, is_active, starts_at, ends_at } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE banners SET
      title = ?, subtitle = ?, image_url = ?, link_type = ?, link_value = ?,
      bg_color = ?, text_color = ?, sort_order = ?, is_active = ?,
      starts_at = ?, ends_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title?.trim() || existing.title,
    subtitle?.trim() ?? existing.subtitle,
    image_url ?? existing.image_url,
    link_type ?? existing.link_type,
    link_value ?? existing.link_value,
    bg_color ?? existing.bg_color,
    text_color ?? existing.text_color,
    sort_order ?? existing.sort_order,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    starts_at ?? existing.starts_at,
    ends_at ?? existing.ends_at,
    now, req.params.id
  );

  const banner = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  res.json({ banner });
});

/**
 * DELETE /api/banners/:id — Eliminar banner [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const db = require('../db').getDb();
  const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Banner no encontrado' });

  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ message: 'Banner eliminado correctamente' });
});

/**
 * PUT /api/banners/reorder — Reordenar banners [admin]
 * Body: { order: ["id1", "id2", "id3"] }
 */
router.put('/reorder', authMiddleware(['admin']), (req, res) => {
  const db = require('../db').getDb();
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Se requiere un arreglo de IDs' });

  const updateStmt = db.prepare("UPDATE banners SET sort_order = ?, updated_at = datetime('now','localtime') WHERE id = ?");
  const txn = db.transaction(() => {
    order.forEach((id, index) => {
      updateStmt.run(index + 1, id);
    });
  });
  txn();

  res.json({ message: 'Banners reordenados' });
});

module.exports = router;