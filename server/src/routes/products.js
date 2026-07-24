const express = require('express');
const router = express.Router();
const multer = require('multer');
const { jwtAuth, adminAuth, clientAuth } = require('../middleware/auth');
const { getDB } = require('../db/database');
const { sanitizeText } = require('../utils/sanitize');
const { createStore, USE_S3 } = require('../utils/storage');

// Disco local o S3-compatible segun S3_BUCKET (ver utils/storage.js) -- el
// resto de este archivo no sabe ni le importa cual de los dos es.
const productImages = createStore('product-images');

// multer en memoria (no diskStorage): el archivo pasa por productImages.save()
// sea cual sea el backend, en vez de asumir que siempre hay disco local.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/'))
      return cb(Object.assign(new Error('Solo imágenes (jpg, png, webp, gif)'), { status: 400 }));
    cb(null, true);
  },
});
function generatedFilename(originalname) {
  return `${Date.now()}-${originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function validateProduct({ name, price, aliases, category, description, sku, stock }) {
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200)
      return 'name debe ser texto de 1-200 caracteres';
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || isNaN(price) || price < 0 || price > 100_000_000)
      return 'price debe ser número positivo menor a 100,000,000';
  }
  if (aliases !== undefined) {
    if (!Array.isArray(aliases) || aliases.length > 20)
      return 'aliases debe ser array de máximo 20 elementos';
    if (aliases.some(a => typeof a !== 'string' || a.length > 100))
      return 'cada alias debe ser texto de máximo 100 caracteres';
  }
  if (category !== undefined && category !== null) {
    if (typeof category !== 'string' || category.length > 80)
      return 'category debe ser texto de máximo 80 caracteres';
  }
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > 2000)
      return 'description debe ser texto de máximo 2000 caracteres';
  }
  if (sku !== undefined && sku !== null) {
    if (typeof sku !== 'string' || sku.length > 60)
      return 'sku debe ser texto de máximo 60 caracteres';
  }
  if (stock !== undefined && stock !== null) {
    if (typeof stock !== 'number' || isNaN(stock) || stock < 0 || stock > 1_000_000)
      return 'stock debe ser número positivo menor a 1,000,000';
  }
  return null;
}

router.get('/', clientAuth, async (req, res, next) => {
  try {
    const { rows } = await getDB().query(`
      SELECT p.*, string_agg(pi.filename, ',') AS image_filenames
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      GROUP BY p.id
      ORDER BY p.favorite DESC, p.name ASC
    `);
    res.json(rows.map(p => ({
      ...p,
      aliases: JSON.parse(p.aliases || '[]'),
      images: p.image_filenames ? p.image_filenames.split(',') : [],
      image_filenames: undefined,
    })));
  } catch (e) { next(e); }
});

// GET /api/products/public — catálogo sin autenticar, para que el sitio
// web permita navegar y armar el carrito como invitado (el login solo se
// pide al momento de pagar). Solo campos de catálogo -- nada de stock/sku
// (detalle interno de inventario, sin motivo para exponerlo a anónimos).
router.get('/public', async (req, res, next) => {
  try {
    const { rows } = await getDB().query(`
      SELECT p.id, p.name, p.price, p.aliases, p.available, p.favorite,
             p.no_fiado, p.category, p.description,
             string_agg(pi.filename, ',') AS image_filenames
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id
      WHERE p.available = 1
      GROUP BY p.id
      ORDER BY p.favorite DESC, p.name ASC
    `);
    res.json(rows.map(p => ({
      ...p,
      aliases: JSON.parse(p.aliases || '[]'),
      images: p.image_filenames ? p.image_filenames.split(',') : [],
      image_filenames: undefined,
    })));
  } catch (e) { next(e); }
});

router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { name, price, aliases, category, description, sku, stock } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'name y price requeridos' });
    const err = validateProduct({ name, price, aliases, category, description, sku, stock });
    if (err) return res.status(400).json({ error: err });
    const db = getDB();
    const { rows } = await db.query(`INSERT INTO products (name, price, aliases, category, description, sku, stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        sanitizeText(name, 150), price, JSON.stringify(aliases || []),
        category ? sanitizeText(category, 80) : null,
        description ? sanitizeText(description, 2000) : null,
        sku ? sanitizeText(sku, 60) : null,
        stock ?? null,
      ]);
    const product = rows[0];
    res.json({ ...product, aliases: JSON.parse(product.aliases || '[]') });
  } catch (e) { next(e); }
});

router.put('/:id', adminAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const { name, price, aliases, available, favorite, no_fiado, category, description, sku, stock } = req.body;
    const err = validateProduct({ name, price, aliases, category, description, sku, stock });
    if (err) return res.status(400).json({ error: err });
    const db = getDB();
    const { rows } = await db.query(`UPDATE products SET
      name        = COALESCE($1, name),
      price       = COALESCE($2, price),
      aliases     = COALESCE($3, aliases),
      available   = COALESCE($4, available),
      favorite    = COALESCE($5, favorite),
      no_fiado    = COALESCE($6, no_fiado),
      category    = COALESCE($7, category),
      description = COALESCE($8, description),
      sku         = COALESCE($9, sku),
      stock       = COALESCE($10, stock)
      WHERE id = $11 RETURNING *`,
      [
        name   ? sanitizeText(name, 150) : null,
        price  ?? null,
        aliases ? JSON.stringify(aliases) : null,
        available ?? null,
        favorite  ?? null,
        no_fiado  ?? null,
        category !== undefined ? (category ? sanitizeText(category, 80) : null) : null,
        description !== undefined ? (description ? sanitizeText(description, 2000) : null) : null,
        sku !== undefined ? (sku ? sanitizeText(sku, 60) : null) : null,
        stock ?? null,
        id,
      ]);
    const product = rows[0];
    if (!product) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ...product, aliases: JSON.parse(product.aliases || '[]') });
  } catch (e) { next(e); }
});

router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const db = getDB();
    // Delete associated images from storage
    const { rows: imgs } = await db.query('SELECT filename FROM product_images WHERE product_id=$1', [id]);
    await Promise.all(imgs.map(img => productImages.delete(img.filename)));
    await db.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// POST /api/products/:id/images — upload product image (admin only)
router.post('/:id/images', adminAuth, upload.single('image'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
    const db = getDB();
    const { rows } = await db.query('SELECT id FROM products WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    const filename = generatedFilename(req.file.originalname);
    await productImages.save(filename, req.file.buffer);
    await db.query('INSERT INTO product_images (product_id, filename) VALUES ($1,$2)', [id, filename]);
    res.status(201).json({ filename });
  } catch (e) { next(e); }
});

// DELETE /api/products/:id/images/:filename — delete product image (admin only)
router.delete('/:id/images/:filename', adminAuth, async (req, res, next) => {
  try {
    const { id, filename } = req.params;
    const db = getDB();
    const { rows } = await db.query('SELECT id FROM product_images WHERE product_id=$1 AND filename=$2', [id, filename]);
    const img = rows[0];
    if (!img) return res.status(404).json({ error: 'Imagen no encontrada' });
    await productImages.delete(filename);
    await db.query('DELETE FROM product_images WHERE id=$1', [img.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Serve product images (authenticated)
// Sin auth a propósito: son fotos de producto (marketing, no datos de
// negocio), y el catálogo público (/public) las necesita para el modo
// invitado del sitio web. filename siempre pasa por path.basename, así
// que no hay traversal ni forma de listar archivos ajenos al store.
router.get('/images/:filename', async (req, res, next) => {
  try {
    const filename = require('path').basename(req.params.filename);
    if (!(await productImages.exists(filename))) return res.status(404).json({ error: 'No encontrado' });
    if (USE_S3) return res.send(await productImages.read(filename));
    res.sendFile(productImages.localPath(filename));
  } catch (e) { next(e); }
});

// ── Reseñas ──────────────────────────────────────────────────
// GET /api/products/:id/reviews — solo reseñas de 3 a 5 estrellas (las
// malas nunca se muestran públicamente, es una regla de negocio, no un
// filtro de UI -- el servidor jamás las devuelve).
router.get('/:id/reviews', clientAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const db = getDB();

    const { rows } = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.display_name
       FROM product_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1 AND r.rating >= 3
       ORDER BY r.created_at DESC LIMIT 100`,
      [id]
    );
    const { rows: summaryRows } = await db.query(
      `SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0)::float AS average
       FROM product_reviews WHERE product_id = $1 AND rating >= 3`,
      [id]
    );

    res.json({
      reviews: rows.map(r => ({
        id:         r.id,
        rating:     r.rating,
        comment:    r.comment,
        created_at: r.created_at,
        author:     (r.display_name || 'Cliente').trim().split(/\s+/)[0] || 'Cliente',
      })),
      count:   summaryRows[0].count,
      average: summaryRows[0].average,
    });
  } catch (e) { next(e); }
});

// POST /api/products/:id/reviews — { rating, comment } -- una reseña por
// cliente/producto (upsert: volver a enviar reemplaza la anterior).
router.post('/:id/reviews', clientAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    const rating = parseInt(req.body?.rating, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'rating debe ser un número entre 1 y 5' });
    const comment = req.body?.comment ? sanitizeText(String(req.body.comment), 500) : null;

    const db = getDB();
    const { rows: prodRows } = await db.query('SELECT id FROM products WHERE id = $1', [id]);
    if (!prodRows[0]) return res.status(404).json({ error: 'Producto no encontrado' });

    await db.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, user_id) DO UPDATE
       SET rating = $3, comment = $4, created_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      [id, req.user.id, rating, comment]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.productImages = productImages;
