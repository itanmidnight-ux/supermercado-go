'use strict';
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { getDB }     = require('../db/database');
const { adminAuth, clientAuth } = require('../middleware/auth');
const { sanitizeText } = require('../utils/sanitize');
const { normalizeAndValidatePhone } = require('../utils/phone');

const PICS_DIR = path.join(process.env.APPDATA || process.env.HOME, 'pedidos-bot', 'profile-pics');
fs.mkdirSync(PICS_DIR, { recursive: true });
const picUpload = multer({
  dest: PICS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, f, cb) => cb(null, f.mimetype.startsWith('image/')),
});

const SALT = 10;
const SAFE_FIELDS = 'id, username, display_name, role, active, address, created_at';

// GET /api/users — list all (admin only)
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { rows: users } = await getDB().query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY id`);
    res.json({ users });
  } catch (e) { next(e); }
});

// POST /api/users — create user (admin only)
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { username, pin, password, display_name, address, role = 'worker' } = req.body;
    const credential = password !== undefined ? String(password) : (pin !== undefined ? String(pin) : '');

    if (!username || typeof username !== 'string' || username.trim().length < 2)
      return res.status(400).json({ error: 'username requerido (mín 2 chars)' });
    if (!credential.length)
      return res.status(400).json({ error: 'contraseña requerida' });
    if (!['admin', 'worker', 'client'].includes(role))
      return res.status(400).json({ error: 'role debe ser admin, worker o client' });

    const db   = getDB();
    const name = username.trim().toLowerCase();

    const { rows: existing } = await db.query('SELECT id FROM users WHERE username = $1', [name]);
    if (existing[0]) return res.status(409).json({ error: 'Usuario ya existe' });

    const credHash = await bcrypt.hash(credential, SALT);

    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash, pin, display_name, role, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, credHash, credHash, display_name ? sanitizeText(display_name, 100) : name, role, address ? sanitizeText(address, 300) : null]
    );

    const { rows: userRows } = await db.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id = $1`, [rows[0].id]);
    res.status(201).json({ user: userRows[0] });
  } catch (e) { next(e); }
});

// GET /api/users/me — datos propios para la pestaña de perfil. No es una
// red social: el cliente no puede editar nombre/apodo/dirección/bio (por
// eso ni siquiera se devuelven para edición), solo ve lo esencial.
// IMPORTANTE: debe registrarse ANTES de PUT/DELETE /:id -- Express matchea
// rutas en orden de registro y "/me" calza con el patrón "/:id" (id="me"),
// lo que forzaría adminAuth sobre cualquier cliente que solo quiere ver o
// editar su propio perfil.
router.get('/me', clientAuth, async (req, res, next) => {
  try {
    const { rows } = await getDB().query(
      'SELECT id, username, display_name, role, email, phone, profile_pic FROM users WHERE id=$1', [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: rows[0] });
  } catch (e) { next(e); }
});

// PUT /api/users/me — SOLO permite cambiar el correo, y únicamente si se
// confirma la contraseña actual (evita que un token robado baste para
// secuestrar la cuenta cambiando el correo de recuperación). Nombre,
// apodo, dirección y descripción no son editables -- no es una red social.
router.put('/me', clientAuth, async (req, res, next) => {
  try {
    const { email, current_password } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
      return res.status(400).json({ error: 'Correo inválido' });
    if (!current_password)
      return res.status(400).json({ error: 'Confirma tu contraseña actual para cambiar el correo' });

    const db = getDB();
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    const match = await bcrypt.compare(String(current_password), user.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    const newEmail = String(email).trim().toLowerCase().slice(0, 200);
    try {
      await db.query('UPDATE users SET email=$1 WHERE id=$2', [newEmail, req.user.id]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ese correo ya está en uso por otra cuenta' });
      throw e;
    }
    res.json({ ok: true, email: newEmail });
  } catch (e) { next(e); }
});

// PUT /api/users/:id — update display_name, password, role, active, address (admin only)
router.put('/:id', adminAuth, async (req, res, next) => {
  try {
    const db   = getDB();
    const id   = parseInt(req.params.id, 10);
    const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = userRows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (req.user.id === id && req.body.active === 0)
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });

    const updates = [];
    const vals    = [];

    if (req.body.display_name !== undefined) { vals.push(sanitizeText(req.body.display_name, 100)); updates.push(`display_name=$${vals.length}`); }
    if (req.body.role !== undefined) {
      if (!['admin', 'worker', 'client'].includes(req.body.role))
        return res.status(400).json({ error: 'role debe ser admin, worker o client' });
      vals.push(req.body.role); updates.push(`role=$${vals.length}`);
    }
    if (req.body.active       !== undefined) { vals.push(req.body.active ? 1 : 0); updates.push(`active=$${vals.length}`); }
    if (req.body.address      !== undefined) { vals.push(req.body.address?.trim() || null); updates.push(`address=$${vals.length}`); }
    const newCredential = req.body.password !== undefined ? String(req.body.password)
                        : req.body.pin      !== undefined ? String(req.body.pin) : undefined;
    if (newCredential !== undefined) {
      const credHash = await bcrypt.hash(newCredential, SALT);
      vals.push(credHash); updates.push(`password_hash=$${vals.length}`);
      vals.push(credHash); updates.push(`pin=$${vals.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });

    vals.push(id);
    await db.query(`UPDATE users SET ${updates.join(',')} WHERE id=$${vals.length}`, vals);
    const { rows: updatedRows } = await db.query(`SELECT ${SAFE_FIELDS} FROM users WHERE id=$1`, [id]);
    res.json({ user: updatedRows[0] });
  } catch (e) { next(e); }
});

// DELETE /api/users/:id — hard delete (admin only, cannot delete self)
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.id === id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    const db = getDB();
    try {
      const result = await db.query('DELETE FROM users WHERE id=$1', [id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json({ ok: true });
    } catch (e) {
      // FK (orders.claimed_by, login_events.user_id, etc) impide borrar un
      // usuario con historial -- es el comportamiento correcto (preservar
      // trazabilidad de pedidos/sesiones), no un error real del servidor.
      // codigo 23503 = foreign_key_violation (estandar SQLSTATE de Postgres).
      if (e.code === '23503') {
        return res.status(409).json({ error: 'No se puede eliminar: el usuario tiene pedidos o sesiones registradas. Desactívalo en su lugar.' });
      }
      throw e;
    }
  } catch (e) { next(e); }
});

// GET /api/users/clients — list client users (admin only). Incluye
// order_count (via customers.phone) para la ficha de detalle del panel.
router.get('/clients', adminAuth, async (req, res, next) => {
  try {
    const { rows: clients } = await getDB().query(`
      SELECT u.id, u.username, u.display_name, u.email, u.phone, u.address,
        u.profile_pic, u.active, u.created_at, COALESCE(oc.order_count, 0) AS order_count
      FROM users u
      LEFT JOIN (
        SELECT c.phone, COUNT(*) AS order_count
        FROM orders o JOIN customers c ON c.id = o.customer_id
        GROUP BY c.phone
      ) oc ON oc.phone = u.phone
      WHERE u.role = 'client'
      ORDER BY u.created_at DESC
    `);
    res.json({ clients: clients.map(c => ({ ...c, order_count: Number(c.order_count) })) });
  } catch (e) { next(e); }
});

// PUT /api/users/me/phone — igual que el correo: exige contraseña actual.
router.put('/me/phone', clientAuth, async (req, res, next) => {
  try {
    const { phone, current_password } = req.body;
    const normalized = normalizeAndValidatePhone(phone);
    if (!normalized)
      return res.status(400).json({ error: 'Número de celular inválido (celular colombiano de 10 dígitos)' });
    if (!current_password)
      return res.status(400).json({ error: 'Confirma tu contraseña actual para cambiar el número' });

    const db = getDB();
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    const match = await bcrypt.compare(String(current_password), user.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

    try {
      await db.query('UPDATE users SET phone=$1 WHERE id=$2', [normalized, req.user.id]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Ese número ya está en uso por otra cuenta' });
      throw e;
    }
    res.json({ ok: true, phone: normalized });
  } catch (e) { next(e); }
});

// PUT /api/users/me/password — change own password
router.put('/me/password', clientAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'current_password y new_password requeridos' });
    if (String(new_password).length < 8)
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres' });
    const db   = getDB();
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    const match = await bcrypt.compare(String(current_password), user.password_hash);
    if (!match) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(String(new_password), 10);
    await db.query('UPDATE users SET password_hash=$1, pin=$2 WHERE id=$3', [hash, hash, req.user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/users/me/profile-pic — upload profile photo
router.post('/me/profile-pic', clientAuth, picUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });
    const ext     = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const newName = `${req.user.username}_${Date.now()}.${ext}`;
    const newPath = path.join(PICS_DIR, newName);
    try { fs.renameSync(req.file.path, newPath); } catch { fs.copyFileSync(req.file.path, newPath); fs.unlinkSync(req.file.path); }
    await getDB().query('UPDATE users SET profile_pic=$1 WHERE id=$2', [newName, req.user.id]);
    res.json({ filename: newName });
  } catch (e) { next(e); }
});

// GET /api/users/profile-pic/:filename — serve profile pic
router.get('/profile-pic/:filename', clientAuth, (req, res) => {
  const fp = path.join(PICS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(fp)) return res.status(404).end();
  res.sendFile(fp);
});

// DELETE /api/users/me/profile-pic — delete own profile pic
router.delete('/me/profile-pic', clientAuth, async (req, res, next) => {
  try {
    const db   = getDB();
    const { rows } = await db.query('SELECT profile_pic FROM users WHERE id=$1', [req.user.id]);
    const user = rows[0];
    if (user?.profile_pic) {
      try { fs.unlinkSync(path.join(PICS_DIR, user.profile_pic)); } catch {}
    }
    await db.query('UPDATE users SET profile_pic=NULL WHERE id=$1', [req.user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
