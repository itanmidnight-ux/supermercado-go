// src/routes/users.js — Rutas de gestión de usuarios [admin]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const { hashPassword } = require('../utils/passwords');
const { v4: uuidv4 } = require('uuid');

const router = Router();

/**
 * GET /api/users — Listar usuarios [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = 'WHERE 1=1';
  const params = [];

  if (role) { where += ' AND u.role = ?'; params.push(role); }
  if (search) { where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const count = db.prepare(`SELECT COUNT(*) as total FROM users u ${where}`).get(...params);
  const users = db.prepare(`
    SELECT id, name, email, phone, role, avatar, is_active, earnings,
           doc_type, doc_number, last_login_at, created_at
    FROM users u
    ${where}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), offset);

  res.json({
    data: users,
    pagination: { page: Number(page), limit: Number(limit), total: count.total, pages: Math.ceil(count.total / Number(limit)) },
  });
});

/**
 * POST /api/users — Crear usuario [admin]
 */
router.post('/', authMiddleware(['admin']), async (req, res) => {
  const { name, email, phone, password, role, avatar } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }

  const validRoles = ['admin', 'worker', 'client'];
  const userRole = validRoles.includes(role) ? role : 'client';

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const hashedPassword = await hashPassword(password);
  const id = uuidv4();
  const now = nowBogota();

  db.prepare(`
    INSERT INTO users (id, name, email, phone, password, role, avatar, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, name, email, phone || null, hashedPassword, userRole, avatar || null, now, now);

  const user = db.prepare(`
    SELECT id, name, email, phone, role, avatar, is_active, created_at
    FROM users WHERE id = ?
  `).get(id);

  res.status(201).json({ data: user, message: 'Usuario creado exitosamente' });
});

/**
 * GET /api/users/:id — Obtener usuario por ID [admin]
 */
router.get('/:id', authMiddleware(['admin']), (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, phone, role, avatar, is_active, earnings,
           doc_type, doc_number, must_change_password, accepted_privacy_at,
           last_login_at, fcm_token, created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ data: user });
});

/**
 * PUT /api/users/:id — Actualizar usuario [admin]
 */
router.put('/:id', authMiddleware(['admin']), (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const allowed = ['name', 'email', 'phone', 'role', 'avatar', 'is_active', 'earnings', 'doc_type', 'doc_number'];
  const sets = [];
  const values = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  sets.push('updated_at = ?');
  values.push(nowBogota());
  values.push(req.params.id);

  try {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare(`
      SELECT id, name, email, phone, role, avatar, is_active, earnings,
             doc_type, doc_number, updated_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    res.json({ data: updated, message: 'Usuario actualizado exitosamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo o teléfono' });
    }
    throw err;
  }
});

/**
 * DELETE /api/users/:id — Desactivar usuario [admin]
 */
router.delete('/:id', authMiddleware(['admin']), (req, res) => {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // No permitir desactivar al último admin
  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1").get();
    if (adminCount.count <= 1) {
      return res.status(409).json({ error: 'No se puede desactivar al último administrador del sistema' });
    }
  }

  db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(nowBogota(), req.params.id);
  res.json({ message: 'Usuario desactivado exitosamente' });
});

/**
 * PUT /api/users/profile — Actualizar perfil propio
 */
router.put('/profile', authMiddleware(), (req, res) => {
  const allowed = ['name', 'email', 'phone', 'avatar', 'doc_type', 'doc_number', 'fcm_token'];
  const sets = [];
  const values = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (sets.length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  sets.push('updated_at = ?');
  values.push(nowBogota());
  values.push(req.user.id);

  try {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare(`
      SELECT id, name, email, phone, role, avatar, is_active, doc_type, doc_number, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);
    res.json({ data: updated, message: 'Perfil actualizado exitosamente' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo o teléfono' });
    }
    throw err;
  }
});

module.exports = router;
