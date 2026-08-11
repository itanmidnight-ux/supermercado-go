// src/routes/auth.js — Rutas de autenticación (registro, login, perfil, forgot-password)
// bcrypt con migración transparente desde hashes SHA-256 legacy
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { sendMail, passwordResetEmail, passwordResetConfirm } = require('../utils/mailer');
const config = require('../config');

const router = Router();

// ─── Rate Limiting Anti Brute-Force ────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 minutos
  max: 10,                         // 10 intentos
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.' },
  keyGenerator: (req) => {
    // Usar email + IP para detectar ataques contra una misma cuenta
    const email = (req.body?.email || '').toLowerCase().trim();
    const ip = rateLimit.ipKeyGenerator(req);
    return ip + '::' + email;
  },
});

// ─── POST /api/auth/register ──────────────────────────────
router.post('/register', validateBody({
  required: ['name', 'email', 'phone', 'password'],
  rules: {
    email: (v) => !/\S+@\S+\.\S+/.test(v) ? 'El formato del correo electrónico es inválido' : null,
    password: (v) => typeof v !== 'string' || v.length < 12 ? 'La contraseña debe tener al menos 12 caracteres' : null,
    role: (v) => v && !['client', 'worker'].includes(v) ? 'Rol no válido para registro público' : null,
  }
}), async (req, res) => {
  const { name, email, phone, password, role = 'client' } = req.body;
  const now = nowBogota();

  try {
    // Verificar si el email ya existe
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingEmail) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    }

    // Verificar si el teléfono ya existe
    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingPhone) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese número de teléfono' });
    }

    // Hashear contraseña con bcrypt
    const hash = await hashPassword(password);
    const userId = generateId();

    db.prepare(`
      INSERT INTO users (id, name, email, phone, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, email.toLowerCase().trim(), phone, hash, role, now, now);

    // Generar token
    const token = jwt.sign(
      { id: userId, role, email: email.toLowerCase().trim() },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn, algorithm: 'HS256', issuer: config.jwtIssuer, audience: config.jwtAudience }
    );

    const user = db.prepare('SELECT id, name, email, phone, role, avatar, is_active, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ message: 'Cuenta creada exitosamente', token, user });
  } catch (err) {
    console.error('[AUTH] Error en registro:', err.message);
    res.status(500).json({ error: 'Error al crear la cuenta. Intente nuevamente.' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────
/**
 * Login con rate limiting y migración automática de hashes SHA-256 → bcrypt.
 */
router.post('/login', loginLimiter, validateBody({
  required: ['email', 'password'],
}), async (req, res) => {
  const { email, password } = req.body;

  try {
    // Buscar usuario solo por email (NO por hash para soportar migración)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

    if (!user) {
      // Timming constant: delay artificial para evitar timing attacks
      await new Promise(r => setTimeout(r, 150));
      return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    // Verificar contraseña (soporta bcrypt y SHA-256 legacy con migración)
    const result = await verifyPassword(password, user.password);

    if (!result.match) {
      return res.status(401).json({ error: 'Correo electrónico o contraseña incorrectos' });
    }

    // Migración automática: si el hash era SHA-256, actualizarlo a bcrypt
    if (result.migrated && result.newHash) {
      console.log(`[AUTH] Migrando contraseña de usuario ${user.id} a bcrypt`);
      db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
        .run(result.newHash, nowBogota(), user.id);
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
      { expiresIn: config.jwtExpiresIn, algorithm: 'HS256', issuer: config.jwtIssuer, audience: config.jwtAudience }
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

// ─── POST /api/auth/change-password ──────────────────────────────
router.post('/change-password', authMiddleware(), validateBody({
  required: ['old_password', 'new_password'],
  rules: {
    new_password: (v) => typeof v !== 'string' || v.length < 12 ? 'La nueva contraseña debe tener al menos 12 caracteres' : null,
  }
}), async (req, res) => {
  const { old_password, new_password } = req.body;
  const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Verificar contraseña actual
  const verify = await verifyPassword(old_password, user.password);
  if (!verify.match) {
    return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
  }

  // Hashear nueva con bcrypt
  const newHash = await hashPassword(new_password);
  const now = nowBogota();

  db.prepare('UPDATE users SET password = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
    .run(newHash, now, req.user.id);

  res.json({ message: 'Contraseña actualizada exitosamente' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────
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

// ─── POST /api/auth/privacy-accept ───────────────────────────────
router.post('/privacy-accept', authMiddleware(), (req, res) => {
  const now = nowBogota();
  db.prepare('UPDATE users SET accepted_privacy_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.user.id);
  res.json({ message: 'Política de privacidad aceptada' });
});

// ─── POST /api/auth/verify-pin ────────────────────────────────────
router.post('/verify-pin', authMiddleware(), (req, res) => {
  const { pin } = req.body;
  const userId = req.user.id;

  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'El código PIN debe tener 4 dígitos' });
  }

  // Solo admin y worker necesitan PIN
  if (!['admin', 'worker'].includes(req.user.role)) {
    return res.json({ verified: true, message: 'No se requiere PIN para este rol' });
  }

  const user = db.prepare('SELECT pin_code, pin_attempts, pin_blocked_until FROM users WHERE id = ?').get(userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // Si no tiene PIN asignado, permitir acceso
  if (!user.pin_code) {
    db.prepare('UPDATE users SET pin_verified = 1 WHERE id = ?').run(userId);
    return res.json({ verified: true, message: 'PIN no requerido' });
  }

  // Verificar si está bloqueado
  if (user.pin_blocked_until) {
    const blockedUntil = new Date(user.pin_blocked_until);
    if (blockedUntil > new Date()) {
      const minutes = Math.ceil((blockedUntil - new Date()) / 60000);
      return res.status(423).json({
        error: `Cuenta bloqueada. Intenta de nuevo en ${minutes} minuto(s).`,
        blocked: true,
        remainingMinutes: minutes,
      });
    }
    // Si el bloqueo expiró, resetear intentos
    db.prepare('UPDATE users SET pin_attempts = 0, pin_blocked_until = NULL WHERE id = ?').run(userId);
  }

  // Verificar PIN con comparación de tiempo constante (timing-safe)
  const pinBuffer = Buffer.from(pin, 'utf8');
  const storedPinBuffer = Buffer.from(String(user.pin_code), 'utf8');
  const pinMatch = pinBuffer.length === storedPinBuffer.length
    && crypto.timingSafeEqual(pinBuffer, storedPinBuffer);

  if (pinMatch) {
    // PIN correcto: resetear intentos y marcar verificado
    db.prepare('UPDATE users SET pin_attempts = 0, pin_verified = 1, pin_blocked_until = NULL WHERE id = ?').run(userId);
    return res.json({ verified: true, message: 'PIN verificado correctamente' });
  }

  // PIN incorrecto: incrementar intentos
  const newAttempts = (user.pin_attempts || 0) + 1;
  const maxAttempts = 3;

  if (newAttempts >= maxAttempts) {
    // Bloquear por 15 minutos
    const blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET pin_attempts = ?, pin_blocked_until = ? WHERE id = ?')
      .run(newAttempts, blockedUntil, userId);
    return res.status(423).json({
      error: 'Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.',
      blocked: true,
      remainingMinutes: 15,
    });
  }

  // Incrementar intentos
  db.prepare('UPDATE users SET pin_attempts = ? WHERE id = ?').run(newAttempts, userId);
  const remaining = maxAttempts - newAttempts;
  return res.status(401).json({
    error: `PIN incorrecto. Te quedan ${remaining} intento(s).`,
    verified: false,
    attemptsRemaining: remaining,
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────
// Envía código de recuperación por correo electrónico
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hora
  max: 5,                     // 5 solicitudes por hora
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en una hora.' },
});

router.post('/forgot-password', forgotPasswordLimiter, validateBody({
  required: ['email'],
  rules: {
    email: (v) => !/\S+@\S+\.\S+/.test(v) ? 'El formato del correo electrónico es inválido' : null,
  }
}), async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const now = nowBogota();

  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND is_active = 1').get(normalizedEmail);

    // Siempre devolver el mismo mensaje para no revelar si el email existe
    const successMsg = 'Si existe una cuenta con ese correo, recibirás un código de recuperación.';

    if (!user) {
      return res.json({ message: successMsg });
    }

    // Generar código de 6 dígitos
    const resetCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutos

    // Guardar en la tabla password_resets
    db.prepare(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `).run();

    // Invalidar códigos anteriores del mismo usuario
    db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    // Insertar nuevo código
    const resetId = generateId();
    db.prepare(`
      INSERT INTO password_resets (id, user_id, code, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(resetId, user.id, resetCode, expiresAt, now);

    // Enviar correo
    const { subject, html } = passwordResetEmail(user.name, resetCode, config.business.name);
    const result = await sendMail({ to: user.email, subject, html });

    if (result.sent) {
      console.log(`[AUTH] Código de recuperación enviado a ${user.email}`);
    } else {
      console.warn(`[AUTH] No se pudo enviar correo a ${user.email}: ${result.reason}`);
      // En desarrollo, devolver el código para pruebas
      if (config.nodeEnv === 'development') {
        return res.json({ message: successMsg, _devCode: resetCode });
      }
    }

    res.json({ message: successMsg });
  } catch (err) {
    console.error('[AUTH] Error en forgot-password:', err.message);
    res.status(500).json({ error: 'Error procesando la solicitud. Intenta nuevamente.' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────
// Valida el código y establece la nueva contraseña
router.post('/reset-password', validateBody({
  required: ['email', 'code', 'new_password'],
  rules: {
    email: (v) => !/\S+@\S+\.\S+/.test(v) ? 'El formato del correo electrónico es inválido' : null,
    code: (v) => !/^\d{6}$/.test(v) ? 'El código debe ser de 6 dígitos' : null,
    new_password: (v) => typeof v !== 'string' || v.length < 12 ? 'La nueva contraseña debe tener al menos 12 caracteres' : null,
  }
}), async (req, res) => {
  const { email, code, new_password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const now = nowBogota();

  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? AND is_active = 1').get(normalizedEmail);

    if (!user) {
      return res.status(400).json({ error: 'Código inválido o expirado.' });
    }

    // Buscar código válido
    const resetRecord = db.prepare(`
      SELECT id, expires_at FROM password_resets
      WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(user.id, code, now);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Código inválido o expirado. Solicita uno nuevo.' });
    }

    // Hashear nueva contraseña
    const newHash = await hashPassword(new_password);

    // Actualizar contraseña
    db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, user.id);

    // Marcar código como usado
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

    // Enviar correo de confirmación
    const { subject, html } = passwordResetConfirm(user.name, config.business.name);
    await sendMail({ to: user.email, subject, html });

    res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('[AUTH] Error en reset-password:', err.message);
    res.status(500).json({ error: 'Error al restablecer la contraseña. Intenta nuevamente.' });
  }
});

// ─── POST /api/auth/set-pin ────────────────────────────────────────
router.post('/set-pin', authMiddleware(), (req, res) => {
  const { pin } = req.body;
  const userId = req.user.id;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'El código PIN debe ser exactamente 4 dígitos' });
  }

  // Solo admin puede cambiar PINs de otros (o uno mismo)
  if (req.user.role !== 'admin') {
    // Worker solo puede cambiar su propio PIN
    const targetId = req.body.user_id || userId;
    if (targetId !== userId) {
      return res.status(403).json({ error: 'No tienes permisos para cambiar el PIN de otro usuario' });
    }
  }

  const targetId = req.body.user_id || userId;
  db.prepare('UPDATE users SET pin_code = ?, pin_attempts = 0, pin_blocked_until = NULL WHERE id = ?')
    .run(pin, targetId);

  res.json({ message: 'PIN actualizado correctamente' });
});

module.exports = router;
