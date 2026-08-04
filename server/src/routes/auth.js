// src/routes/auth.js — Rutas de autenticación (registro, login, perfil)
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const config = require('../config');

const router = Router();

/**
 * POST /api/auth/register — Registro de nuevo usuario
 */
router.post('/register', validateBody({
  required: ['name', 'email', 'phone', 'password'],
  rules: {
    email: (v) => !/\S+@\S+\.\S+/.test(v) ? 'El formato del correo electrónico es inválido' : null,
    password: (v) => v.length < 6 ? 'La contraseña debe tener al menos 6 caracteres' : null,
    role: (v) => v && !['client', 'worker'].includes(v) ? 'Rol no válido para registro público' : null,
  }
}), (req, res) => {
  const { name, email, phone, password, role = 'client' } = req.body;
  const now = nowBogota();

  try {
    // Verificar si el email ya existe
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    }

    // Verificar si el teléfono ya existe
    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingPhone) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese número de teléfono' });
    }

    // Hashear contraseña
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const userId = generateId();

    db.prepare(`
      INSERT INTO users (id, name, email, phone, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, email.toLowerCase().trim(), phone, hash, role, now, now);

    // Generar token
    const token = jwt.sign(
      { id: userId, role, email: email.toLowerCase().trim() },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    const user = db.prepare('SELECT id, name, email, phone, role, avatar, is_active, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ message: 'Cuenta creada exitosamente', token, user });
  } catch (err) {
    console.error('[AUTH] Error en registro:', err.message);
    res.status(500).json({ error: 'Error al crear la cuenta. Intente nuevamente.' });
  }
});

/**
 * POST /api/auth/login — Inicio de sesión
 */
router.post('/login', validateBody({
  required: ['email', 'password'],
}), (req, res) => {
  const { email, password } = req.body;

  try {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email.toLowerCase().trim(), hash);

    if (!user) {
      return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Su cuenta ha sido desactivada. Contacte al administrador.' });
    }

    // Actualizar último login
    const now = nowBogota();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    // Generar token
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        is_active: user.is_active,
        must_change_password: user.must_change_password,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[AUTH] Error en login:', err.message);
    res.status(500).json({ error: 'Error al iniciar sesión. Intente nuevamente.' });
  }
});

/**
 * POST /api/auth/change-password — Cambiar contraseña
 */
router.post('/change-password', authMiddleware(), validateBody({
  required: ['old_password', 'new_password'],
  rules: {
    new_password: (v) => v.length < 6 ? 'La nueva contraseña debe tener al menos 6 caracteres' : null,
  }
}), (req, res) => {
  const { old_password, new_password } = req.body;
  const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.user.id);

  const oldHash = crypto.createHash('sha256').update(old_password).digest('hex');
  if (user.password !== oldHash) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }

  const newHash = crypto.createHash('sha256').update(new_password).digest('hex');
  const now = nowBogota();

  db.prepare('UPDATE users SET password = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(newHash, now, req.user.id);

  res.json({ message: 'Contraseña actualizada exitosamente' });
});

/**
 * GET /api/auth/me — Obtener perfil del usuario actual
 */
router.get('/me', authMiddleware(), (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, phone, role, avatar, is_active, earnings, doc_type, doc_number,
           must_change_password, accepted_privacy_at, last_login_at, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ user });
});

/**
 * POST /api/auth/privacy-accept — Aceptar política de privacidad
 */
router.post('/privacy-accept', authMiddleware(), (req, res) => {
  const now = nowBogota();
  db.prepare('UPDATE users SET accepted_privacy_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.user.id);
  res.json({ message: 'Política de privacidad aceptada' });
});

module.exports = router;
